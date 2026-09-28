# K-Profile — Scouting & Idol Database

Scouting playground combining management-sim stats depth (Football Manager style)
with collectible K-Pop photocard aesthetics. Vite + React frontend, Supabase
(Postgres + Auth + Storage) backend. All idols in any sample data are fictional.

## Prereqs

- Node.js 20+ and npm
- Docker Desktop running (local Supabase stack)
- Supabase CLI is a dev dependency (`supabase` in `package.json`), run via `npx`

## Local setup

```bash
npm install
npx supabase start        # first run downloads images, takes a few minutes
npm run dev               # http://localhost:5173
```

`supabase start` prints the local credentials. The app reads them from `.env.local`
(untracked, already wired for local):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Local services: Studio http://127.0.0.1:54323 · Mailpit http://127.0.0.1:54324.

## Admin account (local)

The catalog is public-read, admin-write. No users exist by default:

1. Studio → Authentication → Add user (email + password, email_confirm on).
2. SQL editor:
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
   where email = 'you@example.com';
   ```
3. Sign in at `#/login` (sign out + back in after granting the flag).

Never put `service_role` / secret keys in frontend env vars — publishable key only.

## Useful commands

```bash
npm run build                     # production build (also runs via tsc below)
npx tsc --noEmit                  # typecheck (vite build does NOT typecheck)

npx supabase db reset --yes       # rebuild local DB from supabase/migrations
npx supabase migration new <name> # new migration file (edit it, then db reset)
npx supabase test db              # pgTAP suite in supabase/tests (RLS access model)
npx supabase db advisors --local --type all  # expect "No issues found"
npx supabase stop                 # stop local stack (data persists in volumes)
```

## How it fits together

- `src/engine/ovr.ts` — OVR math, frontend-side, three tiers:
  Tier 1 atomic sub-attributes roll up to 5 parent categories (weighted mean);
  Tier 2 role scores ranked best-first, blended with normalized geometric decay;
  Tier 3 popularity drift ±`driftMax`. Guarantees: base never exceeds the best
  role score, adding a weak role never inflates.
- `src/store.tsx` — Supabase data layer. Maps `idols` + `idol_roles` +
  `idol_attrs` + `idol_custom_values` to the `Idol` type, `engine_config` to
  `EngineConfig`, global `custom_field_defs` to every sheet. Groups resolve
  case-insensitively to canonical `groups` rows (`ive` → `IVE`), auto-created
  when new. Sanitizes engine groups on load (malformed keys fall back to
  defaults per group).
- `src/pages/Settings.tsx` — tunes engine weights as zero-sum shares (every
  group totals 100%; dragging one redistributes the rest), persisted debounced.
- `supabase/migrations/` — schema + RLS (public SELECT, admin-only writes via
  `app_metadata.is_admin`) + `idol-cards` storage bucket (public, 15 MB cap,
  image + short video). Single source of truth; hosted DB is built by pushing
  these, never by hand edits.
- `supabase/tests/` — pgTAP tests proving anon reads, anon/non-admin writes
  denied, denied writes leave rows intact.

## Hosted (Supabase + Vercel, free tiers)

1. Create a free project at supabase.com/dashboard (note the project ref).
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`
   (needs the DB password). Migrations + RLS + bucket come along.
3. Create the admin user in hosted Studio, grant `is_admin` with the SQL above.
4. Import the repo into Vercel (Vite preset, zero config — hash router needs no
   rewrites) with env vars `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` from the hosted project.
5. Free-tier notes: 1 GB storage total (keep uploads compressed), 50 MB max per
   file (bucket caps at 15 MB), projects pause after 7 days of inactivity.

## Repo layout

```
src/                 React app (pages, components, engine, store)
supabase/migrations  database schema, RLS, bucket (applied via db reset/push)
supabase/tests       pgTAP RLS tests
supabase/config.toml local stack config
.agents/skills, .gemini/config/skills  Supabase agent skills (via npx skills)
public/              static assets (no placeholder photos; portraits live in storage)
```
