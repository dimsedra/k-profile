-- Groups share the same canonical agencies as idols: free-text agency
-- becomes a nullable agency_id FK. New spellings found on groups are added
-- as agency entries (same most-used/earliest rule as the agencies backfill).

insert into public.agencies (name)
select ranked.name
from (
  select trim(agency) as name,
    row_number() over (
      partition by lower(trim(agency))
      order by count(*) desc, min(id)
    ) as rn
  from public.groups
  where agency is not null and trim(agency) <> ''
  group by trim(agency)
) ranked
where ranked.rn = 1
on conflict do nothing;

alter table public.groups
  add column agency_id bigint references public.agencies (id);

update public.groups g
set agency_id = a.id
from public.agencies a
where g.agency is not null
  and trim(g.agency) <> ''
  and lower(trim(g.agency)) = lower(a.name);

alter table public.groups drop column agency;
