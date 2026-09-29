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
3. Sign in at `#/login` (sign out + back in after granting the flag —
   JWTs only pick up `app_metadata` on fresh sign-in).

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

## Hosted: Supabase cloud (free tier)

### 1. Create the project

1. supabase.com/dashboard → New project → Free plan. Region: Singapore
   (closest to ID users). Save the **DB password** somewhere safe.
2. Note the **project ref** (short string in the project URL/settings).

### 2. Push the schema from this repo

```bash
npx supabase link --project-ref <ref>
npx supabase db push        # needs the DB password (prompted)
```

This applies every file in `supabase/migrations` in order: tables, RLS
policies, storage bucket. Verify in hosted Studio: Table Editor shows
`idols, groups, agencies, ...`; `engine_config` holds 1 row; Storage
shows the public `idol-cards` bucket.

### 3. Create the admin (auth is never migrated)

1. Hosted Studio → Authentication → Add user (email + password).
2. SQL editor:
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
   where email = 'you@example.com';
   ```
3. Sign out/in once so the JWT picks up the flag.

### 4. Seed data from local (optional)

DB rows and storage files move separately. Auth users are recreated
manually (step 3) — never dumped.

```bash
# DB: data-only dump, FK-safe table order, then restore with psql
# (needs a PostgreSQL client; connection string is in
#  Dashboard → Project Settings → Database → Connection string)
npx supabase db dump --local --data-only \
  --table public.agencies --table public.groups \
  --table public.custom_field_defs --table public.idols \
  --table public.idol_roles --table public.idol_attrs \
  --table public.idol_custom_values -f seed-data.sql
# Edit seed-data.sql: replace the engine_config COPY block with:
#   update public.engine_config set sub_weights = ..., role_matrix = ...,
#     role_decay = ..., drift_max = ..., group_weight_mode = ... where id = 1;
#   (values copied from the local row — never INSERT id 1, it exists)
psql "<hosted-connection-string>" -f seed-data.sql
# Fix identity sequences, then verify counts match local:
psql "<hosted-connection-string>" -c \
  "select setval('public.idols_id_seq', max(id)) from public.idols;"
# (repeat for groups_id_seq, agencies_id_seq, custom_field_defs_id_seq)
```

```bash
# Files: same bucket paths, so photo_path values stay valid.
# Download from local S3 API, upload to hosted with the service key
# (Dashboard → Project Settings → API → secret key, never in frontend):
# - local S3: http://127.0.0.1:54321/storage/v1/s3 (keys from `supabase start`)
# - list objects under idol-cards/, GET each, PUT to
#   https://<ref>.supabase.co/storage/v1/object/idol-cards/<same-path>
```

Verify: row counts per table equal local; open 2–3 public photo URLs
(anonymously — they must return 200).

### 5. Free-tier notes

- 1 GB storage, 500 MB DB, 50 MB max/file (bucket caps at 15 MB anyway).
- Projects **pause after 7 days of inactivity** — resume with one click in
  the dashboard. First load after resume is slow; that is normal.

## Hosted: Vercel (free tier)

1. vercel.com → Add New Project → import `dimsedra/k-profile`.
   Framework auto-detects **Vite** (`npm run build` → `dist`). No config
   needed — the hash router (`#/…`) requires no rewrites.
2. Environment Variables (Production + Preview):
   - `VITE_SUPABASE_URL=https://<ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`
   (from Dashboard → Project Settings → API. Publishable key only.)
3. Deploy. Every push to the production branch redeploys automatically;
   PRs get preview URLs.
4. Local dev keeps using `.env.local` (untracked) pointed at
   `http://127.0.0.1:54321` — never commit hosted keys.
5. Custom domain is optional (Project → Settings → Domains).

## Repo layout

```
src/                 React app (pages, components, engine, store)
supabase/migrations  database schema, RLS, bucket (applied via db reset/push)
supabase/tests       pgTAP RLS tests
supabase/config.toml local stack config
.agents/skills, .gemini/config/skills  Supabase agent skills (via npx skills)
public/              static assets (no placeholder photos; portraits live in storage)
```
