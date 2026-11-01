-- Remove allRounder from idol_roles and engine_config.
-- If an idol only has allRounder, migrate it to mainVocal; otherwise drop allRounder.
update public.idol_roles
set role_id = 'mainVocal'
where role_id = 'allRounder'
  and idol_id in (
    select idol_id from public.idol_roles
    group by idol_id
    having count(*) = 1
  );

delete from public.idol_roles
where role_id = 'allRounder';

alter table public.idol_roles
  drop constraint idol_roles_role_id_check;
alter table public.idol_roles
  add constraint idol_roles_role_id_check check (role_id in (
    'mainVocal', 'leadVocal', 'subVocalist',
    'mainRapper', 'leadRapper', 'subRapper',
    'mainDancer', 'leadDancer', 'subDancer',
    'visual', 'center', 'leader'
  ));

update public.engine_config
set role_matrix = role_matrix - 'allRounder'
where id = 1 and (role_matrix ? 'allRounder');
