-- RLS access model: public read (anon + authenticated), admin-only write.
-- Groups are canonical (case-insensitive unique) and idols reference them.
-- Run: npx supabase test db
-- Admin-allow paths are verified end-to-end over REST (see e2e check),
-- because pgTAP cannot mint a JWT carrying app_metadata claims.
begin;
select plan(25);

-- Fixtures inserted as table owner (bypasses RLS).
insert into public.groups (name) values ('Probe Group');
insert into public.agencies (name) values ('Probe Agency');
insert into public.idols (stage_name, group_id, gender)
values ('Probe Idol', (select id from public.groups where name = 'Probe Group'), 'Female');

-- Owner-level integrity: case-insensitive duplicates and dangling FKs fail.
select throws_ok(
  $$insert into public.groups (name) values ('probe group')$$,
  '23505',
  null,
  'group names are unique case-insensitively'
);
select throws_ok(
  $$insert into public.agencies (name) values ('probe agency')$$,
  '23505',
  null,
  'agency names are unique case-insensitively'
);
select throws_ok(
  $$insert into public.idols (stage_name, group_id) values ('Orphan', 999999)$$,
  '23503',
  null,
  'idols cannot reference a missing group'
);

-- anon: public catalog is readable, groups included.
set local role anon;
select results_eq(
  $$select i.stage_name from public.idols i
    join public.groups g on g.id = i.group_id where g.name = 'Probe Group'$$,
  array['Probe Idol'],
  'anon reads the public catalog'
);
select results_eq(
  $$select drift_max::text from public.engine_config where id = 1$$,
  array['2.0'],
  'anon reads the engine config'
);
select is_empty(
  $$select * from public.custom_field_defs$$,
  'anon reads empty custom field defs'
);
select results_eq(
  $$select name from public.groups where name = 'Probe Group'$$,
  array['Probe Group'],
  'anon reads the group list'
);
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

-- anon: holds no write grant, so every write stops before policies run.
select throws_ok(
  $$insert into public.idols (stage_name, group_id)
    values ('Nope', (select id from public.groups limit 1))$$,
  '42501',
  null,
  'anon cannot insert idols'
);
select throws_ok(
  $$update public.idols set bio = 'x'$$,
  '42501',
  null,
  'anon cannot update idols'
);
select throws_ok(
  $$delete from public.idols$$,
  '42501',
  null,
  'anon cannot delete idols'
);
select throws_ok(
  $$insert into public.groups (name) values ('Nope')$$,
  '42501',
  null,
  'anon cannot insert groups'
);
select results_eq(
  $$select name from public.agencies where name = 'Probe Agency'$$,
  array['Probe Agency'],
  'anon reads the agency list'
);
select throws_ok(
  $$insert into public.agencies (name) values ('Nope')$$,
  '42501',
  null,
  'anon cannot insert agencies'
);

-- authenticated non-admin: reads fine ...
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select results_eq(
  $$select i.stage_name from public.idols i
    join public.groups g on g.id = i.group_id where g.name = 'Probe Group'$$,
  array['Probe Idol'],
  'non-admin reads the public catalog'
);

-- ... but writes are denied. INSERT fails the WITH CHECK (42501).
select throws_ok(
  $$insert into public.idols (stage_name, group_id)
    values ('Nope', (select id from public.groups limit 1))$$,
  '42501',
  null,
  'non-admin cannot insert idols'
);
select throws_ok(
  $$insert into public.idol_roles (idol_id, role_id, position)
    values ((select id from public.idols where stage_name = 'Probe Idol' limit 1), 'center', 0)$$,
  '42501',
  null,
  'non-admin cannot insert idol roles'
);
select throws_ok(
  $$insert into public.engine_config (id) values (1)$$,
  '42501',
  null,
  'non-admin cannot insert engine config'
);
select throws_ok(
  $$insert into public.groups (name) values ('Nope')$$,
  '42501',
  null,
  'non-admin cannot insert groups'
);
select throws_ok(
  $$insert into public.agencies (name) values ('Nope')$$,
  '42501',
  null,
  'non-admin cannot insert agencies'
);

-- UPDATE/DELETE denied by the USING clause match zero rows (no error),
-- so assert emptiness AND prove the target row is intact.
select is_empty(
  $$update public.idols set bio = 'hacked' returning id$$,
  'non-admin updates no idols'
);
select results_eq(
  $$select bio from public.idols where stage_name = 'Probe Idol'$$,
  array[''],
  'the denied update left the fixture row intact'
);
select is_empty(
  $$delete from public.idols returning id$$,
  'non-admin deletes no idols'
);
select results_eq(
  $$select i.stage_name from public.idols i
    join public.groups g on g.id = i.group_id where g.name = 'Probe Group'$$,
  array['Probe Idol'],
  'the denied delete left the fixture row intact'
);

select * from finish();
rollback;
