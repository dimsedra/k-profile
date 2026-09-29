-- Sub tiers join the role roster (skill tiers below Lead).
alter table public.idol_roles
  drop constraint idol_roles_role_id_check;
alter table public.idol_roles
  add constraint idol_roles_role_id_check check (role_id in (
    'mainVocal', 'leadVocal', 'subVocalist',
    'mainRapper', 'leadRapper', 'subRapper',
    'mainDancer', 'leadDancer', 'subDancer',
    'visual', 'center', 'leader', 'allRounder'
  ));

-- Backfill the new archetypes so existing engine_config rows validate them.
update public.engine_config
set role_matrix = role_matrix
  || '{"subVocalist": {"vocal": 35, "rap": 5, "dance": 25, "stage": 25, "visual": 10}}'::jsonb
  || '{"subRapper": {"vocal": 10, "rap": 35, "dance": 25, "stage": 25, "visual": 5}}'::jsonb
  || '{"subDancer": {"vocal": 15, "rap": 5, "dance": 35, "stage": 25, "visual": 20}}'::jsonb
where id = 1
  and (
    not (role_matrix ? 'subVocalist')
    or not (role_matrix ? 'subRapper')
    or not (role_matrix ? 'subDancer')
  );
