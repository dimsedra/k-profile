# Group Feature — Design Spec (2026-09-28)

Groups become a first-class feature next to idols: unified search in the
binder, a dedicated group page with combined stats, and a member compare
table. Stats are computed in the frontend from data the store already holds.

## Decisions (approved)

- Stats: popularity-weighted mean of members (categories + OVR). Zero total
  popularity falls back to equal weights. Empty group shows an empty state.
- Approach: frontend aggregation (no DB views, no new stats tables).
- Group profile: standard — photo (+upload), bio, debut year, agency,
  fandom name. No custom fields, no sub-units, no group-vs-group compare (v1).
- Search: binder-only, mixed idol/group results with type badges.
- Group page: profile header + stats + member card grid + single-column-sort
  member table. Admin-gated edits, same as idol pages.

## 1. Data & schema

New migration alters `public.groups` (table + RLS already exist):

- `photo_path text` (object path in `idol-cards` bucket, null = no photo)
- `photo_kind text not null default 'image'` (check image/video, mirrors idols)
- `bio text not null default ''`
- `debut_year smallint null` (check 1990–2100 when present)
- `agency text`, `fandom_name text` (nullable, no length checks beyond 120)

No RLS/policy/grant changes (policies attach to the table, not columns).
No storage policy changes (policies check `bucket_id` only).

Group portraits reuse the `idol-cards` bucket at `group-<id>/portrait`
(upsert, contentType set on upload). The `group-` prefix cannot collide
with idol portraits (`<idolId>/portrait`) because idol ids are numeric.

Backfill: none needed (new nullable columns; existing groups keep NULLs).

## 2. Stats engine (`src/engine/groups.ts`, new)

```ts
computeGroupStats(members: { cats: Record<CategoryKey, number>; ovr: number; popularity: number }[])
  => { cats, ovr, contributions: { memberId, weightPct }[] } | null
```

- `weight_i = popularity_i / totalPopularity`; total 0 → `1 / n` each.
- `cats[k] = Σ cats_i[k] × weight_i` (full precision, round at display).
- `ovr = round(Σ ovr_i × weight_i)`, no clamp (inputs already 40–99).
- `weightPct` per member uses largest-remainder rounding so the displayed
  shares total exactly 100%.
- Empty member list → `null` (UI empty state, never 0-stats).
- The "Solo" group aggregates soloists with zero special-casing.

Store exposes a helper (e.g. `groupStats(groupId)`) built from its loaded
idols + config; no new fetches. Engine groups sanitization already in the
store covers malformed weight rows.

## 3. Binder unified search

- One search box above the binder grid; client-side filter over store data.
- Substring, case-insensitive match on idol `stageName` and group `name`.
- Mixed single list: idol rows (mini portrait, name, OVR badge) and group
  rows ("Group" badge, name, member count, group OVR or "—" when empty).
- Click idol → `#/idol/:id`; click group → `#/group/:id` (new route).
- Empty query → regular photocard grid. Enter opens first result,
  Escape clears. Accessible listbox semantics on the result list.
- ScoutingTable untouched (group filter there is explicitly out of v1).

## 4. Group page (`#/group/:id`, new `GroupDetail` page)

- Header: photo (admin upload/remove, same bucket flow as idols), name,
  bio, debut/agency/fandom rows, group OVR badge (or empty-state CTA).
- Stats panel: 5 category bars (reuse `StatBar`) + OVR.
- Member grid: existing `PhotoCard`, links to idol sheets.
- Member table: same columns as the scouting table, rows limited to
  members, single-column click-to-sort (ascending/descending toggle;
  first click sorts numeric columns descending, text ascending — same
  convention as the master table).
  Simplified from the master table's multi-sort on purpose; same look.
- Edit affordances (profile fields, photo) admin-gated; anonymous sees
  read-only. Unknown id → same not-found UI pattern as idol detail.
- No new navbar links; groups are reached via binder search.

## 5. Testing

- Migration: `db reset` clean, advisors clean, pgTAP additions — profile
  columns nullable, group RLS read/write gates (covered by existing
  group policies; assert select + denied writes).
- Engine script (throwaway, Temp): hand-calc weighted mean, zero-total
  fallback, empty → null, OVR rounding, contributions sum to 100%.
- Frontend: `tsc --noEmit`, `vite build`, anon smoke read (groups with
  profile fields resolve).
- Manual (owner): binder search idol + group, open group page, member
  table sort, admin photo upload, empty-group state.

## Out of scope (v1)

Group custom fields, rename/merge groups UI, sub-units, group-vs-group
compare, group filter in the master scouting table, animated group
photos beyond what the shared bucket already allows.
