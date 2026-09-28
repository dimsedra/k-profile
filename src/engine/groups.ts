import type { CategoryKey } from "./ovr";

/* ------------------------------------------------------------------ */
/* Group combined stats: popularity-weighted mean of member stats.     */
/* Zero total popularity falls back to equal weights; no members       */
/* returns null (the UI shows an empty state, never zero-stats).       */
/* ------------------------------------------------------------------ */

export interface GroupMemberInput {
  id: number;
  cats: Record<CategoryKey, number>;
  ovr: number;
  popularity: number;
}

export interface GroupStats {
  cats: Record<CategoryKey, number>;
  ovr: number;
  contributions: { memberId: number; weightPct: number }[];
}

const CAT_KEYS: CategoryKey[] = ["vocal", "rap", "dance", "stage", "visual"];

export function computeGroupStats(members: GroupMemberInput[]): GroupStats | null {
  if (members.length === 0) return null;
  const total = members.reduce((s, m) => s + m.popularity, 0);
  const weights =
    total > 0
      ? members.map((m) => m.popularity / total)
      : members.map(() => 1 / members.length);
  const cats = {} as Record<CategoryKey, number>;
  for (const k of CAT_KEYS)
    cats[k] = members.reduce((s, m, i) => s + m.cats[k] * weights[i], 0);
  const ovr = Math.round(members.reduce((s, m, i) => s + m.ovr * weights[i], 0));
  // Largest remainder so displayed shares total exactly 100.
  const raws = weights.map((w) => w * 100);
  const floors = raws.map(Math.floor);
  let assigned = floors.reduce((s, f) => s + f, 0);
  const order = raws
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (assigned < 100 && order.length > 0) {
    floors[order[k % order.length].i] += 1;
    assigned += 1;
    k += 1;
  }
  return {
    cats,
    ovr,
    contributions: members.map((m, i) => ({ memberId: m.id, weightPct: floors[i] })),
  };
}
