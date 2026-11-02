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

export type RoleFamily = "vocal" | "rap" | "dance" | "visual" | "center";

export type ScoringRoleId =
  | "mainVocal"
  | "leadVocal"
  | "subVocalist"
  | "mainRapper"
  | "leadRapper"
  | "subRapper"
  | "mainDancer"
  | "leadDancer"
  | "subDancer"
  | "visual"
  | "center";

export interface RoleDef {
  id: string;
  label: string;
  family: RoleFamily | null;
}

export const ROLES: RoleDef[] = [
  { id: "mainVocal", label: "Main Vocalist", family: "vocal" },
  { id: "leadVocal", label: "Lead Vocalist", family: "vocal" },
  { id: "subVocalist", label: "Sub Vocalist", family: "vocal" },
  { id: "mainRapper", label: "Main Rapper", family: "rap" },
  { id: "leadRapper", label: "Lead Rapper", family: "rap" },
  { id: "subRapper", label: "Sub Rapper", family: "rap" },
  { id: "mainDancer", label: "Main Dancer", family: "dance" },
  { id: "leadDancer", label: "Lead Dancer", family: "dance" },
  { id: "subDancer", label: "Sub Dancer", family: "dance" },
  { id: "visual", label: "Visual", family: "visual" },
  { id: "center", label: "Center", family: "center" },
  { id: "leader", label: "Leader", family: null },
];

export const SCORING_ROLES = ROLES.filter(
  (r): r is RoleDef & { id: ScoringRoleId; family: RoleFamily } => r.family !== null
);

/**
 * Tags that never enter the rating math. Leadership is not a skill
 * stereotype across the five categories, so the tag stays visible
 * everywhere (sheets, tables, filters) but is skipped by computeOvr.
 */
export const NON_SCORING_ROLES = ["leader"];

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
    subVocalist: { vocal: 35, rap: 5, dance: 25, stage: 25, visual: 10 },
    mainRapper: { vocal: 5, rap: 55, dance: 15, stage: 20, visual: 5 },
    leadRapper: { vocal: 10, rap: 45, dance: 20, stage: 20, visual: 5 },
    subRapper: { vocal: 10, rap: 35, dance: 25, stage: 25, visual: 5 },
    mainDancer: { vocal: 10, rap: 5, dance: 55, stage: 20, visual: 10 },
    leadDancer: { vocal: 15, rap: 5, dance: 45, stage: 20, visual: 15 },
    subDancer: { vocal: 15, rap: 5, dance: 35, stage: 25, visual: 20 },
    visual: { vocal: 10, rap: 5, dance: 10, stage: 25, visual: 50 },
    center: { vocal: 10, rap: 5, dance: 20, stage: 35, visual: 30 },
    leader: { vocal: 20, rap: 10, dance: 20, stage: 30, visual: 20 },
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
  const row = cfg.roleMatrix[roleId];
  if (!row) {
    throw new Error(`Unknown or degenerate role in roleMatrix: ${roleId}`);
  }
  return weightedMean(
    (Object.keys(row) as CategoryKey[]).map((k) => [cats[k], row[k]])
  );
}

export interface ArchetypeDef {
  title: string;
  description: string;
}

export interface ArchetypeResult {
  key: string;
  title: string;
  description: string;
  threshold: number;
  activeCategories: CategoryKey[];
}

export const ARCHETYPES: Record<string, ArchetypeDef> = {
  // Lapisan 1: Spesialis Murni (1 Sumbu Aktif — 5 Tipe)
  "vocal": { title: "The Vocal Maestro", description: "Penguasa teknik suara murni" },
  "rap": { title: "The Wordsmith", description: "Penenun rima, tempo, dan lirik" },
  "dance": { title: "The Dance Dynamo", description: "Penari murni berenergi kinetik tinggi" },
  "stage": { title: "The Stage Commander", description: "Pengendali formasi dan pusat gravitasi panggung" },
  "visual": { title: "The Visual Muse", description: "Inspirasi estetika visual dan pesona kamera" },

  // Lapisan 2: Dua Keahlian / Dual Focus (2 Sumbu Aktif — 10 Tipe)
  "vocal+rap": { title: "The Melodic Rapper", description: "Keahlian berimbang antara menyanyi merdu dan melantunkan rap" },
  "vocal+dance": { title: "The Stage Engine", description: "Motor penggerak penampilan langsung yang stabil" },
  "vocal+stage": { title: "The Vocal Anchor", description: "Pondasi suara utama dengan karisma panggung dominan" },
  "vocal+visual": { title: "The Visual Siren", description: "Penyanyi dengan daya pikat vokal dan visual menawan" },
  "rap+dance": { title: "The Rhythm Striker", description: "Penyerang ritme cepat lewat tarian tajam dan rap" },
  "rap+stage": { title: "The Stage Disruptor", description: "Rapper yang mendominasi dan menggebrak suasana panggung" },
  "rap+visual": { title: "The Trendsetter", description: "Rapper berpenampilan khas yang memimpin gaya dan tren grup" },
  "dance+stage": { title: "The Pacesetter", description: "Penari berenergi tinggi yang mengatur tempo panggung seluruh grup" },
  "dance+visual": { title: "The Graceful Performer", description: "Penari dengan ekspresi panggung dan estetika gerak yang memikat" },
  "stage+visual": { title: "The Centerpiece", description: "Pusat perhatian visual dan karisma yang menjadi representasi panggung" },

  // Lapisan 3: Tiga Keahlian / Triple Threat (3 Sumbu Aktif — 10 Tipe)
  "vocal+rap+dance": { title: "The Powerhouse", description: "Segitiga kemampuan teknis musikal dan koreografi murni" },
  "vocal+rap+stage": { title: "The Frontline Virtuoso", description: "Musisi panggung lengkap di garis depan" },
  "vocal+rap+visual": { title: "The Melodic Icon", description: "Musisi vokal-rap dengan representasi citra visual kuat" },
  "vocal+dance+stage": { title: "The Showstopper", description: "Pencuri perhatian utama panggung lewat lagu, koreo, dan aksi panggung" },
  "vocal+dance+visual": { title: "The Radiant Showman", description: "Paket penampil klasik dengan vokal prima, tari, dan visual" },
  "vocal+stage+visual": { title: "The Headliner", description: "Nama utama yang memimpin sorotan lewat suara, aura visual, dan karisma" },
  "rap+dance+stage": { title: "The Crowd Igniter", description: "Pemicu antusiasme penonton lewat rap, koreo agresif, dan kontrol panggung" },
  "rap+dance+visual": { title: "The Stage Maverick", description: "Penampil berkarakter bebas dengan rap, koreo tajam, dan gaya khas" },
  "rap+stage+visual": { title: "The Frontman", description: "Juru bicara dan wajah utama panggung bergenre ritmis" },
  "dance+stage+visual": { title: "The Stage Sensation", description: "Koreografi, karisma, dan visual spektakuler di panggung" },

  // Lapisan 4: Empat Keahlian / Quad Focus (4 Sumbu Aktif — 5 Tipe)
  "vocal+rap+dance+visual": { title: "The Technical Prodigy", description: "Berbakat luar biasa di empat lini teknis dan visual tanpa dominasi kontrol panggung" },
  "vocal+rap+dance+stage": { title: "The Stage Vanguard", description: "Garda terdepan performa panggung dengan kemampuan teknis dan karisma mutlak" },
  "vocal+rap+stage+visual": { title: "The Luminary", description: "Tokoh panggung yang bersinar lewat suara, lirik, visual, dan karisma" },
  "vocal+dance+stage+visual": { title: "The Protagonist", description: "Sosok sentral ala tokoh utama idol: vokal, tari, aura panggung, dan visual" },
  "rap+dance+stage+visual": { title: "The Trailblazer", description: "Pembuka jalan panggung berenergi ritmis, koreo tajam, dan pesona visual" },

  // Lapisan 5: Sempurna / All Pillars (5 Sumbu Aktif — 1 Tipe)
  "vocal+rap+dance+stage+visual": { title: "The All-Rounder", description: "Penguasa seluruh lima dimensi atribut kemampuan idol" },
};

/** Compute 5-axis midrange archetype trait from parent category scores */
export function computeArchetype(cats: Record<CategoryKey, number>): ArchetypeResult {
  const catKeys = CATEGORIES.map((c) => c.key);
  for (const k of catKeys) {
    if (typeof cats[k] !== "number" || !Number.isFinite(cats[k])) {
      throw new Error(`Invalid category score for archetype calculation: ${k}`);
    }
  }

  const scores = catKeys.map((k) => cats[k]);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const threshold = (max + min) / 2;

  const activeCategories = catKeys.filter((k) => cats[k] >= threshold);
  const key = activeCategories.join("+");

  const def = ARCHETYPES[key];
  if (!def) {
    throw new Error(`Unknown archetype key: ${key}`);
  }

  return {
    key,
    title: def.title,
    description: def.description,
    threshold,
    activeCategories,
  };
}

export interface OvrBreakdown {
  cats: Record<CategoryKey, number>;
  /** Midrange cutoff (max + min) / 2 across 11 functional roles */
  threshold: number;
  /** ranked best-first with the normalized decay weight actually applied */
  roleScores: { roleId: string; score: number; weight: number }[];
  base: number;
  drift: number;
  ovr: number;
  /** MBTI-style archetype trait computed from 5 parent categories */
  archetype: ArchetypeResult;
}

/** Full three-tier calculation based on natural archetype discovery */
export function computeOvr(idol: Idol, cfg: EngineConfig): OvrBreakdown {
  if (!Number.isFinite(cfg.roleDecay) || cfg.roleDecay <= 0) {
    throw new Error("Invalid roleDecay in EngineConfig");
  }

  const cats = categoryScores(idol, cfg);
  const archetype = computeArchetype(cats);

  // Tier 2 — Evaluate all 11 functional roles
  const allScored = SCORING_ROLES.map((r) => ({
    id: r.id,
    family: r.family,
    score: roleScore(cats, r.id, cfg),
  })).sort((a, b) => b.score - a.score);

  const max = allScored[0].score;
  const min = allScored[allScored.length - 1].score;
  const threshold = (max + min) / 2;

  // Single-pass filter: score >= threshold AND unique per family
  const seenFamilies = new Set<RoleFamily>();
  const qualified: { id: string; score: number }[] = [];
  for (const item of allScored) {
    if (item.score >= threshold && !seenFamilies.has(item.family)) {
      seenFamilies.add(item.family);
      qualified.push({ id: item.id, score: item.score });
    }
  }

  const raw = qualified.map((_, i) => Math.pow(cfg.roleDecay, i));
  const totalWeight = raw.reduce((s, w) => s + w, 0);
  const roleScores = qualified.map((r, i) => ({
    roleId: r.id,
    score: r.score,
    weight: raw[i] / totalWeight,
  }));
  const base = roleScores.reduce((s, r) => s + r.score * r.weight, 0);

  // Tier 3 — Popularity Drift
  const drift = ((idol.popularity - 50) / 50) * cfg.driftMax;
  const ovr = Math.max(40, Math.min(99, Math.round(base + drift)));

  return { cats, threshold, roleScores, base, drift, ovr, archetype };
}

export const ovrOf = (idol: Idol, cfg: EngineConfig) => computeOvr(idol, cfg).ovr;

/** Photocard rarity tier by OVR — drives the foil treatment */
export function tierOf(ovr: number): "holo" | "prism" | "core" | "rookie" {
  if (ovr >= 90) return "holo";
  if (ovr >= 85) return "prism";
  if (ovr >= 78) return "core";
  return "rookie";
}
