-- K-Profile initial schema: scouting database for K-Pop idols.
--
-- Access model: public read (anon + authenticated), admin-only write.
-- An admin is an auth user whose app_metadata contains {"is_admin": true}.
-- Set it with:
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
--   where email = 'admin@example.com';
-- The user must sign out and back in afterwards so the JWT picks up the claim.

-- ---------------------------------------------------------------- idols ---
create table public.idols (
  id bigint generated always as identity primary key,
  stage_name text not null check (char_length(stage_name) between 1 and 120),
  real_name text,
  group_name text not null check (char_length(group_name) between 1 and 120),
  gender text not null default 'Female' check (gender in ('Male', 'Female')),
  generation smallint not null default 5 check (generation between 1 and 5),
  debut_year smallint check (debut_year between 1990 and 2100),
  agency text,
  bio text not null default '',
  photo_path text, -- object path inside the idol-cards storage bucket
  photo_kind text not null default 'image' check (photo_kind in ('image', 'video')),
  popularity smallint not null default 50 check (popularity between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.idols is 'Scouting sheet per idol. Atomic attributes live in idol_attrs, roles in idol_roles.';

-- ------------------------------------------------------------ idol_roles ---
create table public.idol_roles (
  idol_id bigint not null references public.idols (id) on delete cascade,
  role_id text not null check (role_id in (
    'mainVocal', 'leadVocal', 'mainRapper',
    'mainDancer', 'leadDancer', 'visual',
    'center', 'leader', 'allRounder'
  )),
  position smallint not null check (position >= 0), -- rank order, 0 = primary
  primary key (idol_id, role_id),
  unique (idol_id, position)
);
comment on table public.idol_roles is 'Ranked role archetypes per idol. position 0 is the primary role.';

-- ------------------------------------------------------------ idol_attrs ---
create table public.idol_attrs (
  idol_id bigint not null references public.idols (id) on delete cascade,
  attr_key text not null check (
    attr_key ~ '^(vocal|rap|dance|stage|visual)\.[a-z]+$'
  ),
  value smallint not null check (value between 50 and 99),
  primary key (idol_id, attr_key)
);
comment on table public.idol_attrs is 'Atomic sub-attributes per idol, 20 keys across 5 parent categories.';

-- ---------------------------------------------------------- engine_config ---
create table public.engine_config (
  id smallint primary key default 1 check (id = 1), -- singleton row
  sub_weights jsonb not null, -- per-category atomic weights, keyed by full attr key
  role_matrix jsonb not null, -- per-role category emphasis
  role_decay numeric(4, 2) not null default 0.50 check (role_decay between 0.25 and 0.85),
  drift_max numeric(3, 1) not null default 2.0 check (drift_max between 0 and 4),
  updated_at timestamptz not null default now()
);
comment on table public.engine_config is 'Singleton OVR engine weights. Mirrors EngineConfig in src/engine/ovr.ts.';

insert into public.engine_config (sub_weights, role_matrix, role_decay, drift_max)
values (
  '{
    "vocal": {"vocal.technique": 30, "vocal.range": 20, "vocal.tone": 25, "vocal.stability": 25},
    "rap": {"rap.flow": 30, "rap.speed": 15, "rap.lyricism": 25, "rap.delivery": 30},
    "dance": {"dance.precision": 30, "dance.power": 25, "dance.flexibility": 15, "dance.musicality": 30},
    "stage": {"stage.charisma": 35, "stage.expression": 25, "stage.engagement": 20, "stage.energy": 20},
    "visual": {"visual.harmony": 30, "visual.aura": 30, "visual.styling": 15, "visual.camera": 25}
  }'::jsonb,
  '{
    "mainVocal": {"vocal": 55, "rap": 5, "dance": 10, "stage": 20, "visual": 10},
    "leadVocal": {"vocal": 45, "rap": 5, "dance": 20, "stage": 20, "visual": 10},
    "mainRapper": {"vocal": 5, "rap": 55, "dance": 15, "stage": 20, "visual": 5},
    "mainDancer": {"vocal": 10, "rap": 5, "dance": 55, "stage": 20, "visual": 10},
    "leadDancer": {"vocal": 15, "rap": 5, "dance": 45, "stage": 20, "visual": 15},
    "visual": {"vocal": 10, "rap": 5, "dance": 10, "stage": 25, "visual": 50},
    "center": {"vocal": 10, "rap": 5, "dance": 20, "stage": 35, "visual": 30},
    "leader": {"vocal": 20, "rap": 10, "dance": 20, "stage": 30, "visual": 20},
    "allRounder": {"vocal": 20, "rap": 20, "dance": 20, "stage": 20, "visual": 20}
  }'::jsonb,
  0.50,
  2.0
);

-- ------------------------------------------------------ custom_field_defs ---
-- Global field definitions. Every idol shares the same set of fields;
-- per-idol values live in idol_custom_values.
create table public.custom_field_defs (
  id bigint generated always as identity primary key,
  label text not null unique check (char_length(label) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.custom_field_defs is 'Administrator-defined profile fields (text only), shared by every idol.';

-- ----------------------------------------------------- idol_custom_values ---
create table public.idol_custom_values (
  idol_id bigint not null references public.idols (id) on delete cascade,
  field_id bigint not null references public.custom_field_defs (id) on delete cascade,
  value text not null default '',
  primary key (idol_id, field_id)
);
-- The composite PK leads with idol_id; the FK side needs its own index
-- so deleting a field definition does not scan the whole table.
create index idol_custom_values_field_id_idx
  on public.idol_custom_values using btree (field_id);

-- ------------------------------------------------------------------ RLS ---
-- Same shape for every table: public SELECT, admin-only writes.
-- UPDATE needs both USING (visible rows) and WITH CHECK (resulting rows).

-- idols
alter table public.idols enable row level security;
revoke all on table public.idols from anon, authenticated;
grant select on table public.idols to anon, authenticated;
grant select, insert, update, delete on table public.idols to authenticated;
grant all on table public.idols to service_role;

create policy "idols readable by everyone"
  on public.idols for select to anon, authenticated using (true);
create policy "idols insert by admin"
  on public.idols for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idols update by admin"
  on public.idols for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idols delete by admin"
  on public.idols for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- idol_roles
alter table public.idol_roles enable row level security;
revoke all on table public.idol_roles from anon, authenticated;
grant select on table public.idol_roles to anon, authenticated;
grant select, insert, update, delete on table public.idol_roles to authenticated;
grant all on table public.idol_roles to service_role;

create policy "idol_roles readable by everyone"
  on public.idol_roles for select to anon, authenticated using (true);
create policy "idol_roles insert by admin"
  on public.idol_roles for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_roles update by admin"
  on public.idol_roles for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_roles delete by admin"
  on public.idol_roles for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- idol_attrs
alter table public.idol_attrs enable row level security;
revoke all on table public.idol_attrs from anon, authenticated;
grant select on table public.idol_attrs to anon, authenticated;
grant select, insert, update, delete on table public.idol_attrs to authenticated;
grant all on table public.idol_attrs to service_role;

create policy "idol_attrs readable by everyone"
  on public.idol_attrs for select to anon, authenticated using (true);
create policy "idol_attrs insert by admin"
  on public.idol_attrs for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_attrs update by admin"
  on public.idol_attrs for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_attrs delete by admin"
  on public.idol_attrs for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- engine_config
alter table public.engine_config enable row level security;
revoke all on table public.engine_config from anon, authenticated;
grant select on table public.engine_config to anon, authenticated;
grant select, insert, update, delete on table public.engine_config to authenticated;
grant all on table public.engine_config to service_role;

create policy "engine_config readable by everyone"
  on public.engine_config for select to anon, authenticated using (true);
create policy "engine_config insert by admin"
  on public.engine_config for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "engine_config update by admin"
  on public.engine_config for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "engine_config delete by admin"
  on public.engine_config for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- custom_field_defs
alter table public.custom_field_defs enable row level security;
revoke all on table public.custom_field_defs from anon, authenticated;
grant select on table public.custom_field_defs to anon, authenticated;
grant select, insert, update, delete on table public.custom_field_defs to authenticated;
grant all on table public.custom_field_defs to service_role;

create policy "custom_field_defs readable by everyone"
  on public.custom_field_defs for select to anon, authenticated using (true);
create policy "custom_field_defs insert by admin"
  on public.custom_field_defs for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "custom_field_defs update by admin"
  on public.custom_field_defs for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "custom_field_defs delete by admin"
  on public.custom_field_defs for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- idol_custom_values
alter table public.idol_custom_values enable row level security;
revoke all on table public.idol_custom_values from anon, authenticated;
grant select on table public.idol_custom_values to anon, authenticated;
grant select, insert, update, delete on table public.idol_custom_values to authenticated;
grant all on table public.idol_custom_values to service_role;

create policy "idol_custom_values readable by everyone"
  on public.idol_custom_values for select to anon, authenticated using (true);
create policy "idol_custom_values insert by admin"
  on public.idol_custom_values for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_custom_values update by admin"
  on public.idol_custom_values for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "idol_custom_values delete by admin"
  on public.idol_custom_values for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');

-- ---------------------------------------------------------------- storage ---
-- Public bucket for card portraits (still images now, short animated clips
-- later). Reads are open via the public bucket; writes are admin-only.
-- Upsert (file replacement) needs INSERT + SELECT + UPDATE together.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idol-cards',
  'idol-cards',
  true,
  15728640, -- 15 MB cap: forces HD-but-compressed uploads, protects the 1 GB free quota
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
);

create policy "idol-cards readable by everyone"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'idol-cards');
create policy "idol-cards insert by admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'idol-cards'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true'
  );
create policy "idol-cards update by admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'idol-cards'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true'
  )
  with check (
    bucket_id = 'idol-cards'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true'
  );
create policy "idol-cards delete by admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'idol-cards'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true'
  );
