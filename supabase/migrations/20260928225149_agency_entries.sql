-- Agencies as reusable canonical entries (not first-class: no pages or
-- stats). Matching is case-insensitive; the unique index on lower(name)
-- stops typo variants from coexisting. Idol sheets reference agencies by
-- id; agency is optional, so the FK is nullable (unlike group_id).

create table public.agencies (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
comment on table public.agencies is 'Canonical agency names referenced by idol sheets.';

create unique index agencies_name_lower_idx on public.agencies (lower(name));

-- Backfill from existing sheets, skipping empties. Case variants collapse
-- to the most-used spelling (ties: earliest-entered, locale-independent).
insert into public.agencies (name)
select ranked.name
from (
  select trim(agency) as name,
    row_number() over (
      partition by lower(trim(agency))
      order by count(*) desc, min(id)
    ) as rn
  from public.idols
  where agency is not null and trim(agency) <> ''
  group by trim(agency)
) ranked
where ranked.rn = 1
on conflict do nothing;

alter table public.idols
  add column agency_id bigint references public.agencies (id);

update public.idols i
set agency_id = a.id
from public.agencies a
where i.agency is not null
  and trim(i.agency) <> ''
  and lower(trim(i.agency)) = lower(a.name);

alter table public.idols drop column agency;

-- --------------------------------------------------------------- RLS ----
-- Same shape as every other table: public SELECT, admin-only writes.

alter table public.agencies enable row level security;
revoke all on table public.agencies from anon, authenticated;
grant select on table public.agencies to anon, authenticated;
grant select, insert, update, delete on table public.agencies to authenticated;
grant all on table public.agencies to service_role;

create policy "agencies readable by everyone"
  on public.agencies for select to anon, authenticated using (true);
create policy "agencies insert by admin"
  on public.agencies for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "agencies update by admin"
  on public.agencies for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "agencies delete by admin"
  on public.agencies for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
