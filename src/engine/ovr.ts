/* ------------------------------------------------------------------ */
/* K-Profile rating engine                                             */
/* Tier 1  Atomic sub-attributes roll up into 5 parent categories.     */
/* Tier 2  Ranked Role Decay: role scores are sorted best-first and    */
/*         combined with normalized geometric decay weights, so        */
/*         specialists are judged on their craft and all-rounders      */
/*         earn every extra role — no stacking exploits, no penalty    */
/*         for versatility.                                            */
/* Tier 3  Popularity Drift: a subtle modifier of at most ±driftMax.   */
/* ------------------------------------------------------------------ */

export type Gender = "Male" | "Female";
export type CategoryKey = "vocal" | "rap" | "dance" | "stage" | "visual";

export interface SubAttrDef {
  key: string;
  label: string;
}

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  subs: SubAttrDef[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: "vocal",
    label: "Vocal",
    subs: [
      { key: "vocal.technique", label: "Technique" },
      { key: "vocal.range", label: "Range" },
      { key: "vocal.tone", label: "Tone color" },
      { key: "vocal.stability", label: "Live stability" },
    ],
  },
  {
    key: "rap",
    label: "Rap",
    subs: [
      { key: "rap.flow", label: "Flow" },
      { key: "rap.speed", label: "Speed" },
      { key: "rap.lyricism", label: "Lyricism" },
      { key: "rap.delivery", label: "Delivery" },
    ],
  },
  {
    key: "dance",
    label: "Dance",
    subs: [
      { key: "dance.precision", label: "Precision" },
      { key: "dance.power", label: "Power" },
      { key: "dance.flexibility", label: "Flexibility" },
      { key: "dance.musicality", label: "Musicality" },
    ],
  },
  {
    key: "stage",
    label: "Stage Presence",
    subs: [
      { key: "stage.charisma", label: "Charisma" },
      { key: "stage.expression", label: "Expression" },
      { key: "stage.engagement", label: "Fan engagement" },
      { key: "stage.energy", label: "Energy" },
    ],
  },
  {
    key: "visual",
    label: "Visual",
    subs: [
      { key: "visual.harmony", label: "Facial harmony" },
      { key: "visual.aura", label: "Aura" },
      { key: "visual.styling", label: "Styling range" },
      { key: "visual.camera", label: "Camera presence" },
    ],
  },
];

export const ALL_SUB_KEYS = CATEGORIES.flatMap((c) => c.subs.map((s) => s.key));

export interface RoleDef {
  id: string;
  label: string;
}

export const ROLES: RoleDef[] = [
  { id: "mainVocal", label: "Main Vocalist" },
  { id: "leadVocal", label: "Lead Vocalist" },
  { id: "mainRapper", label: "Main Rapper" },
  { id: "mainDancer", label: "Main Dancer" },
  { id: "leadDancer", label: "Lead Dancer" },
  { id: "visual", label: "Visual" },
  { id: "center", label: "Center" },
  { id: "leader", label: "Leader" },
  { id: "allRounder", label: "All-Rounder" },
];

export const roleLabel = (id: string) =>
  ROLES.find((r) => r.id === id)?.label ?? id;

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface Idol {
  id: number;
  stageName: string;
  realName?: string;
  group: string;
  gender: Gender;
  generation: 1 | 2 | 3 | 4 | 5;
  debutYear?: number;
  agency?: string;
  bio: string;
  photo?: string;
  /** storage object path in the idol-cards bucket (Supabase-backed) */
  photoPath?: string;
  photoKind?: "image" | "video";
  roles: string[]; // ranked, index 0 = primary
  attrs: Record<string, number>; // atomic key -> 50..99
  popularity: number; // 0..100 pts
  customFields: CustomField[];
}

export interface EngineConfig {
  /** relative weights per atomic sub-attribute, grouped by category */
  subWeights: Record<CategoryKey, Record<string, number>>;
  /** role archetype matrix: category emphasis per role (relative) */
  roleMatrix: Record<string, Record<CategoryKey, number>>;
  /** geometric decay factor between ranked roles (0.25–0.85) */
  roleDecay: number;
  /** maximum OVR points popularity can drift, plus or minus */
  driftMax: number;
  /** how members pull group combined stats: by popularity or equal */
  groupWeightMode: "popularity" | "equal";
}

export const DEFAULT_CONFIG: EngineConfig = {
  subWeights: {
    vocal: { "vocal.technique": 30, "vocal.range": 20, "vocal.tone": 25, "vocal.stability": 25 },
    rap: { "rap.flow": 30, "rap.speed": 15, "rap.lyricism": 25, "rap.delivery": 30 },
    dance: { "dance.precision": 30, "dance.power": 25, "dance.flexibility": 15, "dance.musicality": 30 },
    stage: { "stage.charisma": 35, "stage.expression": 25, "stage.engagement": 20, "stage.energy": 20 },
    visual: { "visual.harmony": 30, "visual.aura": 30, "visual.styling": 15, "visual.camera": 25 },
  },
  roleMatrix: {
    mainVocal: { vocal: 55, rap: 5, dance: 10, stage: 20, visual: 10 },
    leadVocal: { vocal: 45, rap: 5, dance: 20, stage: 20, visual: 10 },
    mainRapper: { vocal: 5, rap: 55, dance: 15, stage: 20, visual: 5 },
    mainDancer: { vocal: 10, rap: 5, dance: 55, stage: 20, visual: 10 },
    leadDancer: { vocal: 15, rap: 5, dance: 45, stage: 20, visual: 15 },
    visual: { vocal: 10, rap: 5, dance: 10, stage: 25, visual: 50 },
    center: { vocal: 10, rap: 5, dance: 20, stage: 35, visual: 30 },
    leader: { vocal: 20, rap: 10, dance: 20, stage: 30, visual: 20 },
    allRounder: { vocal: 20, rap: 20, dance: 20, stage: 20, visual: 20 },
  },
  roleDecay: 0.5,
  driftMax: 2,
  groupWeightMode: "popularity",
};

/* ----------------------------- math ------------------------------- */

const weightedMean = (pairs: [number, number][]) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 0;
  return pairs.reduce((s, [v, w]) => s + v * w, 0) / total;
};

/** Tier 1 — one parent category from its atomic sub-attributes */
export function categoryScore(idol: Idol, cat: CategoryDef, cfg: EngineConfig): number {
  const weights = cfg.subWeights[cat.key];
  return weightedMean(cat.subs.map((s) => [idol.attrs[s.key] ?? 50, weights[s.key] ?? 1]));
}

export function categoryScores(idol: Idol, cfg: EngineConfig): Record<CategoryKey, number> {
  const out = {} as Record<CategoryKey, number>;
  for (const cat of CATEGORIES) out[cat.key] = categoryScore(idol, cat, cfg);
  return out;
}

/** How well one role archetype fits this idol's category profile */
export function roleScore(cats: Record<CategoryKey, number>, roleId: string, cfg: EngineConfig): number {
  const row = cfg.roleMatrix[roleId] ?? cfg.roleMatrix.allRounder;
  return weightedMean(
    (Object.keys(row) as CategoryKey[]).map((k) => [cats[k], row[k]])
  );
}

export interface OvrBreakdown {
  cats: Record<CategoryKey, number>;
  /** ranked best-first with the normalized decay weight actually applied */
  roleScores: { roleId: string; score: number; weight: number }[];
  base: number;
  drift: number;
  ovr: number;
}

/** Full three-tier calculation */
export function computeOvr(idol: Idol, cfg: EngineConfig): OvrBreakdown {
  const cats = categoryScores(idol, cfg);

  // Tier 2 — Ranked Role Decay
  const scored = idol.roles
    .map((roleId) => ({ roleId, score: roleScore(cats, roleId, cfg) }))
    .sort((a, b) => b.score - a.score);

  let base: number;
  let roleScores: OvrBreakdown["roleScores"];
  if (scored.length === 0) {
    base =
      (Object.values(cats) as number[]).reduce((s, v) => s + v, 0) /
      CATEGORIES.length;
    roleScores = [];
  } else {
    const raw = scored.map((_, i) => Math.pow(cfg.roleDecay, i));
    const total = raw.reduce((s, w) => s + w, 0);
    roleScores = scored.map((r, i) => ({ ...r, weight: raw[i] / total }));
    base = roleScores.reduce((s, r) => s + r.score * r.weight, 0);
  }

  // Tier 3 — Popularity Drift
  const drift = ((idol.popularity - 50) / 50) * cfg.driftMax;
  const ovr = Math.max(40, Math.min(99, Math.round(base + drift)));

  return { cats, roleScores, base, drift, ovr };
}

export const ovrOf = (idol: Idol, cfg: EngineConfig) => computeOvr(idol, cfg).ovr;

/** Photocard rarity tier by OVR — drives the foil treatment */
export function tierOf(ovr: number): "holo" | "prism" | "core" | "rookie" {
  if (ovr >= 90) return "holo";
  if (ovr >= 85) return "prism";
  if (ovr >= 78) return "core";
  return "rookie";
}
