# Group Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Groups as a first-class feature: unified binder search, group page with popularity-weighted combined stats, member compare table.

**Architecture:** Frontend aggregation — stats compute in `src/engine/groups.ts` from store data; one migration extends `groups` with profile columns; binder search and group page reuse existing UI primitives.

**Tech Stack:** React 19 + Vite 7 + Tailwind 4, Supabase (Postgres RLS, Storage), pgTAP, supabase-js 2.x.

**Spec:** `docs/superpowers/specs/2026-09-28-group-feature-design.md`

## Global Constraints

- Publishable key only in frontend env vars; never `service_role`/secret keys.
- RLS: public SELECT, admin-only writes via `(app_metadata.is_admin = 'true')`; separate policy per operation; `TO` clause, never `auth.role()`.
- Auth helper calls wrapped as `(select auth.jwt())` with operators outside (linter `auth_rls_initplan`).
- Group portrait path: `group-<id>/portrait` in `idol-cards` bucket (never collides with `<idolId>/portrait`).
- Engine weight rows must carry canonical keys; sanitize on load, validate before persist.
- `npx tsc --noEmit` clean + `vite build` pass before every commit (vite does not typecheck).
- Migration workflow: `supabase migration new`, edit file, `supabase db reset --yes`, advisors clean.

---

## File Structure

- `supabase/migrations/*_group_profile.sql` (create) — profile columns on `groups`.
- `supabase/tests/kprofile_rls.test.sql` (modify) — group profile RLS asserts.
- `src/engine/groups.ts` (create) — `computeGroupStats`, pure, no dependencies except types.
- `src/store.tsx` (modify) — `GroupEntry` profile fields, `groupStats()`, `updateGroup()`.
- `src/pages/Binder.tsx` (modify) — unified search box + mixed results.
- `src/router.tsx` (modify) — `#/group/:id` route.
- `src/pages/GroupDetail.tsx` (create) — header, stats, member grid, member table.
- `src/App.tsx` (modify) — render `GroupDetail`.

---

### Task 1: Group profile columns migration

**Files:**
- Create: `supabase/migrations/<timestamp>_group_profile.sql` (filename from `npx supabase migration new group_profile`)
- Test: `npx supabase test db`, information_schema query below

**Interfaces:**
- Consumes: existing `public.groups` table (id, name, RLS policies from `*_idol_groups.sql`)
- Produces: nullable profile columns; no RLS/policy changes

- [ ] **Step 1: Create the migration file**

Run: `npx supabase migration new group_profile`

- [ ] **Step 2: Write the migration**

```sql
alter table public.groups
  add column photo_path text,
  add column photo_kind text not null default 'image' check (photo_kind in ('image', 'video')),
  add column bio text not null default '',
  add column debut_year smallint check (debut_year between 1990 and 2100),
  add column agency text,
  add column fandom_name text;
comment on column public.groups.photo_path is 'Object path in idol-cards bucket: group-<id>/portrait';
```

- [ ] **Step 3: Apply and verify schema**

Run: `npx supabase db reset --yes`
Expected: both migrations apply, `Finished supabase db reset`.

Run: `npx supabase db query --local "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'groups' order by 1"`
Expected: agency, bio, created_at, debut_year, fandom_name, id, name, photo_kind, photo_path.

- [ ] **Step 4: Advisors clean**

Run: `npx supabase db advisors --local --type all`
Expected: `No issues found`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_group_profile.sql
git commit -m "feat: group profile columns (photo, bio, debut, agency, fandom)"
```

---

### Task 2: Group stats engine + verification

**Files:**
- Create: `src/engine/groups.ts`
- Test: throwaway node script in `C:\Users\user\AppData\Local\Temp\opencode\verify-groups-engine.mjs` (NOT in repo; imports the source file directly via `pathToFileURL` — no node_modules needed, the module is dependency-free)

**Interfaces:**
- Consumes: `CategoryKey` type from `./ovr`
- Produces: `computeGroupStats(members)` returning `{ cats, ovr, contributions } | null`; `GroupMemberInput`, `GroupStats` types for Task 4

- [ ] **Step 1: Write the failing verification script**

```js
import { pathToFileURL } from "node:url";
import path from "node:path";
const { computeGroupStats } = await import(
  pathToFileURL(path.resolve("src/engine/groups.ts")).href
);
const m = (id, v, o, p) => ({
  id, cats: { vocal: v, rap: v, dance: v, stage: v, visual: v }, ovr: o, popularity: p,
});
const r = computeGroupStats([m(1, 80, 84, 80), m(2, 60, 64, 20)]);
console.log(JSON.stringify(r));
const asserts = [
  ["weighted cats", Math.abs(r.cats.vocal - 76) < 1e-9],
  ["weighted ovr", r.ovr === 80],
  ["shares total 100", r.contributions.reduce((s, c) => s + c.weightPct, 0) === 100],
  ["zero-total falls back", (() => {
    const z = computeGroupStats([m(1, 80, 80, 0), m(2, 60, 60, 0)]);
    return Math.abs(z.cats.vocal - 70) < 1e-9;
  })()],
  ["empty is null", computeGroupStats([]) === null],
];
let failed = 0;
for (const [n, c] of asserts) { console.log(`${c ? "PASS" : "FAIL"} ${n}`); if (!c) failed++; }
process.exit(failed ? 1 : 0);
```

Hand-checks baked in: weights 80/20 over cats 80/60 → 76; OVR 84/64 → 80.0 → 80; equal fallback 80/60 → 70.

Run: `node C:\Users\user\AppData\Local\Temp\opencode\verify-groups-engine.mjs`
Expected: FAIL with "Cannot find module" / "not defined" (file does not exist yet).

- [ ] **Step 2: Write minimal implementation `src/engine/groups.ts`**

```ts
import type { CategoryKey } from "./ovr";

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
```

- [ ] **Step 3: Run verification**

Run: `node C:\Users\user\AppData\Local\Temp\opencode\verify-groups-engine.mjs`
Expected: all 5 PASS.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` — Expected: clean.

```bash
git add src/engine/groups.ts
git commit -m "feat: popularity-weighted group stats engine"
```

---

### Task 3: Store — group profiles, stats helper, update mutation

**Files:**
- Modify: `src/store.tsx`
- Test: anon smoke read via node + supabase-js (throwaway script, Temp)

**Interfaces:**
- Consumes: `computeGroupStats`, `GroupMemberInput` (Task 2); `computeOvr` + `EngineConfig` (existing `src/engine/ovr.ts`); `cardPhotoUrl` (existing `src/lib/supabase.ts`)
- Produces: `GroupEntry` (extended), `groupStats(groupId)`, `updateGroup()` for Tasks 4–5

- [ ] **Step 1: Extend `GroupEntry` and mapping**

```ts
export interface GroupEntry {
  id: number;
  name: string;
  photo?: string;
  photoPath?: string;
  photoKind?: "image" | "video";
  bio: string;
  debutYear?: number;
  agency: string;
  fandomName: string;
}
```

In `refresh()`, change the groups select to `sb.from("groups").select("*").order("name")` and map:

```ts
setGroups(
  ((groupsRes.data ?? []) as Record<string, unknown>[]).map((g) => ({
    id: g.id as number,
    name: g.name as string,
    photo: g.photo_path ? cardPhotoUrl(g.photo_path as string) : undefined,
    photoPath: (g.photo_path as string | null) ?? undefined,
    photoKind: ((g.photo_kind as string) ?? "image") as GroupEntry["photoKind"],
    bio: (g.bio as string) ?? "",
    debutYear: (g.debut_year as number | null) ?? undefined,
    agency: (g.agency as string | null) ?? "",
    fandomName: (g.fandom_name as string | null) ?? "",
  }))
);
```

- [ ] **Step 2: Add `groupStats(groupId)` helper**

```ts
const groupStats = useCallback(
  (groupId: number) => {
    const ids = new Set(byGroup.current.get(groupId) ?? []);
    const members = idols.filter((i) => ids.has(i.id));
    if (members.length === 0) return null;
    const inputs: GroupMemberInput[] = members.map((m) => {
      const b = computeOvr(m, config);
      return { id: m.id, cats: b.cats, ovr: b.ovr, popularity: m.popularity };
    });
    return computeGroupStats(inputs);
  },
  [idols, config]
);
```

Note: `idols` in this store already carry display group names, so keep a
parallel membership index. Inside `refresh()`, next to `setIdols`, build:

```ts
const byGroup = useRef(new Map<number, number[]>());
// inside refresh(), after fetching idolsRes:
byGroup.current = new Map<number, number[]>();
for (const r of (idolsRes.data ?? []) as { id: number; group_id: number }[]) {
  const list = byGroup.current.get(r.group_id) ?? [];
  list.push(r.id);
  byGroup.current.set(r.group_id, list);
}
```

And expose it (add to the `Store` interface, provider value, deps):

```ts
const groupMemberIds = useCallback(
  (groupId: number): number[] => byGroup.current.get(groupId) ?? [],
  []
);
```

- [ ] **Step 3: Add `updateGroup` mutation**

```ts
const updateGroup = useCallback(
  async (
    id: number,
    patch: { bio: string; debutYear?: number; agency: string; fandomName: string },
    opts?: { photoFile?: File | null; removePhoto?: boolean }
  ): Promise<string | null> => {
    try {
      const sb = getSupabase();
      const row: Record<string, unknown> = {
        bio: patch.bio,
        debut_year: patch.debutYear ?? null,
        agency: patch.agency || null,
        fandom_name: patch.fandomName || null,
      };
      if (opts?.removePhoto) {
        row.photo_path = null;
        row.photo_kind = "image";
        await sb.storage.from("idol-cards").remove([`group-${id}/portrait`]);
      }
      await sb.from("groups").update(row).eq("id", id).throwOnError();
      if (opts?.photoFile) {
        const file = opts.photoFile;
        const kind = file.type.startsWith("video/") ? "video" : "image";
        const { error } = await sb.storage
          .from("idol-cards")
          .upload(`group-${id}/portrait`, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        await sb.from("groups").update({ photo_path: `group-${id}/portrait`, photo_kind: kind }).eq("id", id).throwOnError();
      }
      await refresh();
      return null;
    } catch (e) {
      return errMsg(e, "Failed to save group.");
    }
  },
  [refresh]
);
```

Expose `groupStats`, `groupMemberIds`, and `updateGroup` in the `Store`
interface, provider value, and deps array. Reject files > 15 MB in the
page (Task 5), not here.

- [ ] **Step 4: Smoke read as anon**

Throwaway node script (Temp) with supabase-js + publishable key: select `*` from `groups`, assert the six profile columns exist (possibly null) on every row. Then Admin Studio check is manual (owner).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` — Expected: clean.

```bash
git add src/store.tsx
git commit -m "feat: group profiles, stats helper, update mutation in store"
```

---

### Task 4: Binder unified search

**Files:**
- Modify: `src/pages/Binder.tsx`
- Test: `npx tsc --noEmit`, `vite build`, manual click-through (owner)

**Interfaces:**
- Consumes: `groups`, `groupStats()`, `idols`, `ovrOf` (store/engine, existing); `OvrBadge`, `Portrait` (existing `src/components/ui.tsx`); `navigate` (existing `src/router.tsx`)
- Produces: search UI; group rows link `#/group/:id` (page lands in Task 5)

- [ ] **Step 1: Add search state + filtering**

Above the grid in `Binder()` (add `useState` to its react import, add
`OvrBadge, Portrait` to its ui import, add `navigate` from `../router`,
and pull `groups`, `groupStats`, `groupMemberIds` into its `useStore()`
destructure), add:

```tsx
const [query, setQuery] = useState("");
const q = query.trim().toLowerCase();
const idolHits = q
  ? cards.filter(({ idol }) => idol.stageName.toLowerCase().includes(q)).slice(0, 8)
  : [];
const groupHits = q
  ? groups
      .filter((g) => g.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((g) => ({ group: g, stats: groupStats(g.id), count: memberCount(g.id) }))
  : [];
```

`memberCount` comes from the same `groupOfIdol` map as Task 3 — expose it
from the store as `groupMemberIds(groupId): number[]` (add in Task 3's
store edit; count = length). If Task 3 only exposed `groupStats`, extend
it here: the store edit for this must include `groupMemberIds`.

`memberCount` comes from `groupMemberIds()` (Task 3): `count = ids.length`.

- [ ] **Step 2: Render mixed results**

When `q` is non-empty, render this instead of the photocard grid:

```tsx
{q && (
  <ul role="listbox" aria-label="Search results" className="mt-8 space-y-2">
    {groupHits.map(({ group, stats, count }) => (
      <li key={`g-${group.id}`} role="option" aria-selected={false}>
        <button
          onClick={() => navigate(`/group/${group.id}`)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-ink/30"
        >
          <span className="rounded-md bg-holo px-1.5 py-0.5 text-[11px] font-bold text-white">Group</span>
          <span className="font-display text-[15px] font-semibold">{group.name}</span>
          <span className="tnum text-[13px] text-mist">{count} members</span>
          <span className="ml-auto">{stats ? <OvrBadge ovr={stats.ovr} size="sm" /> : <span className="text-mist">—</span>}</span>
        </button>
      </li>
    ))}
    {idolHits.map(({ idol, ovr }) => (
      <li key={`i-${idol.id}`} role="option" aria-selected={false}>
        <button
          onClick={() => navigate(`/idol/${idol.id}`)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-ink/30"
        >
          <span className="h-9 w-9 overflow-hidden rounded-lg">
            <Portrait idol={idol} className="h-full w-full" />
          </span>
          <span className="font-display text-[15px] font-semibold">{idol.stageName}</span>
          <span className="text-[13px] text-mist">{idol.group}</span>
          <span className="ml-auto"><OvrBadge ovr={ovr} size="sm" /></span>
        </button>
      </li>
    ))}
    {groupHits.length === 0 && idolHits.length === 0 && (
      <li className="px-4 py-12 text-center text-mist">No matches for “{query.trim()}”.</li>
    )}
  </ul>
)}
```

Groups render before idols. The search input above it:

```tsx
<input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Escape") setQuery("");
    if (e.key === "Enter") {
      const first = [...groupHits, ...idolHits][0];
      if (first) navigate("group" in first ? `/group/${first.group.id}` : `/idol/${first.idol.id}`);
    }
  }}
  placeholder="Search idols or groups…"
  aria-label="Search idols or groups"
  className="mt-6 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-[15px] placeholder:text-mist/60 focus:border-ink/40"
/>
```

Note: the Enter handler discriminates the union by `"group" in first`
— keep the two hit arrays' element shapes exactly `{ group, stats, count }`
and `{ idol, ovr }` so this narrows correctly.

- [ ] **Step 3: Typecheck, build, commit**

Run: `npx tsc --noEmit` then `npm run build` — Expected: both pass.

```bash
git add src/pages/Binder.tsx src/store.tsx
git commit -m "feat: unified idol+group search in binder"
```

Manual (owner): type "ive" → IVE group row with badge; Enter opens it after Task 5.

---

### Task 5: Group route + GroupDetail page

**Files:**
- Modify: `src/router.tsx` (add `{ name: "group"; id: string }`, `case "group"` mirroring `"idol"`), `src/App.tsx` (render `<GroupDetail id={Number(route.id)} />`)
- Create: `src/pages/GroupDetail.tsx`
- Test: `npx tsc --noEmit`, `vite build`, manual (owner)

**Interfaces:**
- Consumes: `groups`, `groupStats()`, `groupMemberIds()`, `updateGroup()`, `isAdmin`, `ready` (store); `PhotoCard`, `StatBar`, `OvrBadge`, `Panel` (existing ui); `computeOvr` not needed (stats helper covers it)
- Produces: full group page

- [ ] **Step 1: Router + App wiring**

In `router.tsx`, extend the `Route` union and `parseHash` exactly like the
existing `idol` branch but with `"group"`. In `App.tsx`, add
`{route.name === "group" && <GroupDetail id={Number(route.id)} />}`.

- [ ] **Step 2: Header + stats + member grid**

Skeleton (`src/pages/GroupDetail.tsx`) — follow `IdolDetail` patterns:

```tsx
import { useMemo } from "react";
import { useStore } from "../store";
import { OvrBadge, Panel, PhotoCard, Portrait, StatBar } from "../components/ui";
import { CATEGORIES, ovrOf } from "../engine/ovr";

export function GroupDetail({ id }: { id: number }) {
  const { groups, groupStats, groupMemberIds, idols, config, ready } = useStore();
  const group = groups.find((g) => g.id === id);
  const memberIds = useMemo(() => new Set(groupMemberIds(id)), [groupMemberIds, id]);
  const members = useMemo(() => idols.filter((i) => memberIds.has(i.id)), [idols, memberIds]);
  const stats = group ? groupStats(id) : null;

  if (!ready) return <p className="py-20 text-center font-display font-semibold">Loading group…</p>;
  if (!group) return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
      <p className="font-display font-semibold">This group doesn't exist</p>
      <a href="#/binder" className="mt-4 inline-block font-semibold text-punch">Back to the binder</a>
    </div>
  );
  const portraitShim = { stageName: group.name, photo: group.photo };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="h-28 w-[75px] overflow-hidden rounded-xl">
          <Portrait idol={portraitShim} className="h-full w-full" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-[14px] text-mist">
            {[group.debutYear ? `Debut ${group.debutYear}` : "", group.agency, group.fandomName ? `Fandom: ${group.fandomName}` : ""].filter(Boolean).join(" · ") || group.bio || "No profile yet."}
          </p>
        </div>
        <div className="ml-auto">{stats ? <OvrBadge ovr={stats.ovr} size="lg" /> : <span className="text-mist">—</span>}</div>
      </div>
      {group.bio && <Panel className="mt-6" title="Biography"><p className="text-[14px] leading-relaxed text-mist">{group.bio}</p></Panel>}
      {stats ? (
        <Panel className="mt-4" title="Combined stats (popularity-weighted)">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <StatBar key={c.key} label={c.label} value={stats.cats[c.key]} strong />
            ))}
          </div>
        </Panel>
      ) : (
        <Panel className="mt-4" title="No members yet">
          <p className="text-[14px] text-mist">Add the first member to compute combined stats.</p>
          <a href="#/add" className="mt-3 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white">+ Add Idol</a>
        </Panel>
      )}
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((m) => (
          <PhotoCard key={m.id} idol={m} ovr={ovrOf(m, config)} href={`#/idol/${m.id}`} />
        ))}
      </div>
    </div>
  );
}
```

Note: `PhotoCard` requires an `ovr` prop — compute per member with the
existing `ovrOf(m, config)` from the engine (pull `config` from the store
too). `Portrait` only reads `stageName` + `photo`, so the shim object
typechecks. Member table itself lands in Task 6.

- [ ] **Step 3: Admin edit (profile + photo)**

Re-add `isAdmin` to the store destructure and `useState` to the react
import, then add an admin-only block (mirror `IdolDetail`'s `isAdmin`
gate): inline form for bio/debut/agency/fandom + photo file input
(accept `image/*,video/*`, reject > 15 MB client-side with the same
message IdolForm uses) + remove-photo button; save calls `updateGroup()`
and surfaces its error string; busy-disable while saving. No custom
fields, no roles UI.

- [ ] **Step 4: Typecheck, build, commit**

Run: `npx tsc --noEmit` then `npm run build` — Expected: both pass.

```bash
git add src/router.tsx src/App.tsx src/pages/GroupDetail.tsx
git commit -m "feat: group detail page with stats and member grid"
```

Manual (owner): open IVE from binder search; upload group photo as admin.

---

### Task 6: Member compare table

**Files:**
- Modify: `src/pages/GroupDetail.tsx` (append table section; no new files)

**Interfaces:**
- Consumes: members + per-member `computeOvr` breakdown (already used for cards via `ovrOf`; categories via `computeOvr(m, config).cats`)
- Produces: sortable member table inside the group page

- [ ] **Step 1: Add single-column-sort table**

Columns: Stage Name (text), Vocal/Rap/Dance/Stage/Visual (numeric,
rounded cats), Popularity (numeric), OVR badge. Click header toggles
asc/desc; first click sorts numeric descending, text ascending (master
table convention). Reuse `statTone` styling logic by extracting it from
`ScoutingTable.tsx` into `src/components/ui.tsx` as an exported helper
in this same task (update `ScoutingTable`'s import accordingly) — no
behavior change to the master table.

- [ ] **Step 2: Typecheck, build, commit**

Run: `npx tsc --noEmit` then `npm run build` — Expected: both pass.

```bash
git add src/pages/GroupDetail.tsx src/pages/ScoutingTable.tsx src/components/ui.tsx
git commit -m "feat: sortable member table on group page"
```

Manual (owner): sort IVE members by dance desc, by name asc.

---

### Task 7: Final verification + push

**Files:** none (verification only)

- [ ] **Step 1: pgTAP additions for group profiles**

Append to `supabase/tests/kprofile_rls.test.sql`: bump `plan(19)` to
`plan(21)` and add, after the anon groups read:

```sql
select results_eq(
  $$select bio from public.groups where name = 'Probe Group'$$,
  array[''],
  'anon reads group profile columns'
);
select throws_ok(
  $$update public.groups set bio = 'x'$$,
  '42501',
  null,
  'anon cannot update groups'
);
```

Run: `npx supabase test db` — Expected: `Result: PASS`, 21 tests.

- [ ] **Step 2: Full gate**

Run in order, all must pass:
1. `npx supabase db advisors --local --type all` → `No issues found`
2. `npx tsc --noEmit` → clean
3. `npm run build` → success
4. Anon smoke read (groups with profile fields) → canonical keys, 200s

- [ ] **Step 3: Commit + push**

```bash
git add supabase/tests/kprofile_rls.test.sql
git commit -m "test: group profile RLS asserts"
git push
```

Manual (owner) acceptance: binder search → group page → member sort → admin photo upload → empty-group state (temporarily point a test idol away or use a fresh group).
