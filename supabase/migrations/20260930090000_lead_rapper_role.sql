-- Lead Rapper joins the role roster; Leader stays a valid tag.
alter table public.idol_roles
  drop constraint idol_roles_role_id_check;
alter table public.idol_roles
  add constraint idol_roles_role_id_check check (role_id in (
    'mainVocal', 'leadVocal', 'mainRapper', 'leadRapper',
    'mainDancer', 'leadDancer', 'visual',
    'center', 'leader', 'allRounder'
  ));

-- Backfill the new archetype so existing engine_config rows validate it.
update public.engine_config
set role_matrix = role_matrix || '{"leadRapper": {"vocal": 10, "rap": 45, "dance": 20, "stage": 20, "visual": 5}}'::jsonb
where id = 1 and not (role_matrix ? 'leadRapper');
