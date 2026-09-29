# Scouting Table Complete Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scouting table gets a Filter button + full dropdown panel (group multi-select, OVR range, popularity floor, per-category floors, gender/generation/role moved inside) plus an inline text search.

**Architecture:** All client-side in `ScoutingTable.tsx` (data already in store); one `TableFilters` state object, one `visible` pipeline extension, dropdown panel with outside-click/Escape close mirroring the navbar menu pattern.

**Tech Stack:** React 19 + Vite 7 + Tailwind 4, supabase-js reads only (no writes, no migration).

**Spec:** Approved in chat 2026-09-28 (bounded scope, no separate design doc):
 Filter button with active-count badge opens a full dropdown; group
 searchable multi-select with chips; OVR min–max; popularity minimum;
 per-category minimums (Vocal 85+ style); gender/generation/role move
 inside the panel; inline text search (stage/real/group name) in the
 toolbar; Apply is live (no apply button — every control applies
 instantly); Clear all resets; badge counts active facet dimensions.

## Global Constraints

- No migration, no store changes except reading `groups` (already exposed).
- `npx tsc --noEmit` clean + `vite build` pass before every commit.
- Row click → idol sheet and existing multi-sort behavior must not change.
- Category floors compare against the same rounded values the table displays.

---

## File Structure

- `src/pages/ScoutingTable.tsx` (modify, only file) — filter state, panel UI,
  extended `visible` pipeline, search input, badge. Existing `Segmented`
  control and `toggleSort` stay; gender/generation segmented controls move
  inside the panel unchanged.

---

### Task 1: Filter state, panel UI, full filtering + badge

**Files:**
- Modify: `src/pages/ScoutingTable.tsx`
- Test: `npx tsc --noEmit`, `vite build`, manual matrix below (owner)

**Interfaces:**
- Consumes: `groups` (store, already exposed), `Row`, `valueOf` (existing file internals)
- Produces: `TableFilters` state + `activeFilterCount` + extended `visible` for Task 2

- [ ] **Step 1: Replace filter state**

Remove `gender`, `gen`, `role` useState lines and add (extend the react
import with `useRef`, add `import type { CategoryKey } from "../engine/ovr"`):

```tsx
import type { CategoryKey } from "../engine/ovr";

interface TableFilters {
  genders: ("Male" | "Female")[];
  generations: number[];
  roles: string[];
  groups: string[];
  ovrMin: number | null;
  ovrMax: number | null;
  popMin: number | null;
  catMin: Record<CategoryKey, number | null>;
}

const EMPTY_FILTERS: TableFilters = {
  genders: [],
  generations: [],
  roles: [],
  groups: [],
  ovrMin: null,
  ovrMax: null,
  popMin: null,
  catMin: { vocal: null, rap: null, dance: null, stage: null, visual: null },
};

const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
const [filterOpen, setFilterOpen] = useState(false);
const filterRef = useRef<HTMLDivElement>(null);
```

Add `useRef` to the react import. Toggle helpers (multi-select arrays):

```tsx
const toggleIn = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
```

Badge count (one per active dimension, search excluded):

```tsx
const activeFilterCount =
  (filters.genders.length > 0 ? 1 : 0) +
  (filters.generations.length > 0 ? 1 : 0) +
  (filters.roles.length > 0 ? 1 : 0) +
  (filters.groups.length > 0 ? 1 : 0) +
  (filters.ovrMin !== null || filters.ovrMax !== null ? 1 : 0) +
  (filters.popMin !== null ? 1 : 0) +
  (Object.values(filters.catMin).some((v) => v !== null) ? 1 : 0);
```

- [ ] **Step 2: Extend the `visible` pipeline**

Replace the three existing filter lines with:

```tsx
let out = rows;
if (filters.genders.length > 0) out = out.filter((r) => filters.genders.includes(r.idol.gender));
if (filters.generations.length > 0) out = out.filter((r) => filters.generations.includes(r.idol.generation));
if (filters.roles.length > 0) out = out.filter((r) => r.idol.roles.some((x) => filters.roles.includes(x)));
if (filters.groups.length > 0) out = out.filter((r) => filters.groups.includes(r.idol.group));
if (filters.ovrMin !== null) out = out.filter((r) => r.ovr >= filters.ovrMin as number);
if (filters.ovrMax !== null) out = out.filter((r) => r.ovr <= filters.ovrMax as number);
if (filters.popMin !== null) out = out.filter((r) => r.idol.popularity >= (filters.popMin as number));
(CATEGORIES_KEYS as CategoryKey[]).forEach((k) => {
  const m = filters.catMin[k];
  if (m !== null) out = out.filter((r) => Math.round(r.cats[k]) >= m);
});
```

Add `const CATEGORIES_KEYS = ["vocal", "rap", "dance", "stage", "visual"];`
near `COLUMNS`. Update the `useMemo` deps to `[rows, filters, sorts]`
(keep `sorts` behavior identical).

- [ ] **Step 3: Filter button + dropdown panel UI**

Toolbar row (replacing the old filter bar): search input lives here in
Task 2; this step adds the button + panel + outside/Escape close
(mirror the navbar `+Add` pattern: `filterRef`, document
`pointerdown` + `keydown` listeners in a `useEffect` gated on
`filterOpen`):

```tsx
<div ref={filterRef} className="relative">
  <button
    onClick={() => setFilterOpen((o) => !o)}
    aria-haspopup="dialog"
    aria-expanded={filterOpen}
    className={cn(
      "rounded-lg border px-3 py-1.5 text-[14px] font-medium",
      activeFilterCount > 0
        ? "border-ink bg-ink text-white"
        : "border-line bg-paper text-mist hover:text-ink"
    )}
  >
    Filter{activeFilterCount > 0 && ` (${activeFilterCount})`}
  </button>
  {filterOpen && (
    <div role="dialog" aria-label="Table filters" className="absolute left-0 top-full z-50 mt-1.5 w-80 space-y-4 rounded-xl border border-line bg-paper p-4 shadow-lg">
      {/* Groups: text input filtering a checkbox list */}
      <FilterGroupSearch
        options={groups.map((g) => g.name)}
        selected={filters.groups}
        onToggle={(name) => setFilters((f) => ({ ...f, groups: toggleIn(f.groups, name) }))}
      />
      {/* OVR min/max: two number inputs */}
      <div className="flex items-center gap-2">
        <span className="w-24 text-[13px] font-medium">OVR</span>
        <input type="number" min={40} max={99} placeholder="Min" aria-label="Minimum OVR"
          value={filters.ovrMin ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, ovrMin: e.target.value === "" ? null : Number(e.target.value) }))}
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]" />
        <input type="number" min={40} max={99} placeholder="Max" aria-label="Maximum OVR"
          value={filters.ovrMax ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, ovrMax: e.target.value === "" ? null : Number(e.target.value) }))}
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]" />
      </div>
      {/* Popularity floor */}
      <div className="flex items-center gap-2">
        <span className="w-24 text-[13px] font-medium">Popularity ≥</span>
        <input type="number" min={0} max={100} placeholder="0" aria-label="Minimum popularity"
          value={filters.popMin ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, popMin: e.target.value === "" ? null : Number(e.target.value) }))}
          className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]" />
      </div>
      {/* Per-category floors */}
      {(Object.keys(filters.catMin) as CategoryKey[]).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-24 text-[13px] font-medium capitalize">{k} ≥</span>
          <input type="number" min={40} max={99} placeholder="—" aria-label={`Minimum ${k}`}
            value={filters.catMin[k] ?? ""}
            onChange={(e) => setFilters((f) => ({
              ...f,
              catMin: { ...f.catMin, [k]: e.target.value === "" ? null : Number(e.target.value) },
            }))}
            className="w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px]" />
        </div>
      ))}
      {/* Gender / Generation / Role: reuse existing Segmented + role select,
          wired to toggleIn arrays instead of single values */}
      <button onClick={() => setFilters(EMPTY_FILTERS)}
        className="w-full rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-mist hover:text-punch">
        Clear all
      </button>
    </div>
  )}
</div>
```

`FilterGroupSearch` (same file, below `Segmented`): props
`{ options: string[]; selected: string[]; onToggle: (name: string) => void }`;
internal `useState` query; filters options case-insensitively; renders
checkbox rows with a remove-chip row of selected names on top. Keep under
40 lines.

Gender/generation inside the panel: keep the existing `Segmented`
component but drive arrays — render Male/Female (and 1–5) toggle buttons
calling `toggleIn`, active style when included. Role: keep the existing
`<select>`? A single-select no longer fits multi-select — replace with a
checkbox list of `ROLES` (label + `roleLabel`). Delete the old toolbar
filter bar and the now-unused single-value states.

- [ ] **Step 4: Typecheck, build, commit**

Run: `npx tsc --noEmit` then `npm run build` — Expected: both pass.

```bash
git add src/pages/ScoutingTable.tsx
git commit -m "feat: complete filter panel on scouting table"
```

Manual (owner) matrix: open panel → check one group → shown count drops
and badge reads (1); OVR min 90 → only 90+ rows; category Vocal min 85 →
all visible vocals ≥ 85; Clear all → full count back; row click still
opens the sheet; sort headers unaffected.

---

### Task 2: Inline text search + final verify

**Files:**
- Modify: `src/pages/ScoutingTable.tsx`
- Test: `npx tsc --noEmit`, `vite build`, manual (owner)

**Interfaces:**
- Consumes: `TableFilters` + `visible` pipeline (Task 1)
- Produces: nothing downstream (leaf feature)

- [ ] **Step 1: Search input + pipeline**

Add `search: string` to `TableFilters` (default `""` in `EMPTY_FILTERS`;
exclude it from `activeFilterCount`). Toolbar, left of the Filter
button:

```tsx
<input
  value={filters.search}
  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
  placeholder="Search name or group…"
  aria-label="Search table"
  className="w-full max-w-xs rounded-lg border border-line bg-paper px-3 py-1.5 text-[14px] placeholder:text-mist/60 focus:border-ink/40"
/>
```

First line of the `visible` pipeline, before facet filters:

```tsx
const sq = filters.search.trim().toLowerCase();
if (sq)
  out = out.filter((r) =>
    r.idol.stageName.toLowerCase().includes(sq) ||
    (r.idol.realName ?? "").toLowerCase().includes(sq) ||
    r.idol.group.toLowerCase().includes(sq)
  );
```

- [ ] **Step 2: Typecheck, build, commit, push**

Run: `npx tsc --noEmit` then `npm run build` — Expected: both pass.

```bash
git add src/pages/ScoutingTable.tsx
git commit -m "feat: text search on scouting table"
git push
```

Manual (owner): type "ive" → only matching rows; clear → full table;
combined with facet filters (search + OVR min) narrows correctly.

