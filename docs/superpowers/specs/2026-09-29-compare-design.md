# Compare Idols — Design Spec

Date: 2026-09-29. Status: approved in chat, unimplemented.

## Goal

First-class head-to-head comparison of 2 idols: pure stats and deltas,
no winner language anywhere. Full depth down to the 20 atomic
attributes, with an overlaid pentagon.

## Non-goals

- No 3+ idol comparison. No engine changes. No new database tables,
  queries, or migrations. No global compare-tray state.

## Routing

- New route `#/compare/:a/:b` with numeric idol ids (e.g.
  `#/compare/3/7`), following the existing `#/idol/:id` pattern in
  `src/router.tsx` (`parseHash` + `Route` union + `App.tsx` screen).
- Missing, invalid, or identical ids do not redirect: the page renders
  in pick mode (empty picker slots + notice, e.g. "pick two different
  idols").
- "Compare" link joins `NavBar.tsx` `LINKS` next to Home / Scouting
  Table / Photocards, so the mobile hamburger menu picks it up
  automatically.

## Page layout (`src/pages/Compare.tsx`, new)

Mobile-first, stacked sections; desktop widens but keeps the same order:

1. Two pickers (see below).
2. Header: two `PhotoCard`s side by side in 2 columns on mobile
   (small scale is accepted), OVR vs OVR with delta.
3. `PentagonChart` with two overlaid layers: idol A holo purple, idol B
   punch pink, plus a small legend. Requires extending `PentagonChart`
   in `src/components/ui.tsx` to accept an optional second value set
   (backwards compatible: single set renders exactly as today).
4. 5 parent categories, each row showing both values, delta (`+3` /
   `−2`, blank on tie), stronger tone on the higher value via the
   existing `statTone` helper.
5. 20 atomic attributes grouped per category, same row treatment.
6. Roles and popularity rows, same treatment.

No verdict banner, no "who wins" copy. Ties get no highlight.

## Pickers and entry points

- Each slot is a search picker reusing the `SearchBox` pattern (filter
  idols by name). The two slots exclude each other's selection.
- Changing a slot updates the URL (`#/compare/a/b`), keeping comparisons
  shareable.
- `IdolDetail.tsx` gains a full-width outline "Compare" button directly
  below the title + OVR badge row, visible to every role (not only
  admin; the admin Edit/Remove row in the left pane is untouched). It
  opens `#/compare/:id/` with the right slot empty (pick mode).

## Data and errors

- Reads existing store data only (`idols`, `config`) through
  `computeOvr`. No new state outside the page.
- Invalid id in URL: slot renders in pick mode with a notice. Same id
  both sides: notice to pick two different idols. Deleted idol id:
  same as invalid.

## Testing

- `npx tsc --noEmit` and `npm run build` must pass.
- Manual: 360px viewport (cards side by side, tables stack, no
  horizontal overflow) and desktop; picker search, slot swap via URL,
  same-id and invalid-id states; tie rows show no highlight.
