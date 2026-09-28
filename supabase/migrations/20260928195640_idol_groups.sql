-- Groups become first-class entries: one canonical spelling per group.
-- Matching is case-insensitive ("ive" finds "IVE"), enforced by a unique
-- index on lower(name) so typo variants can never coexist as separate rows.
-- Idol sheets reference groups by id; the form autocompletes against these
-- rows and auto-creates a group when nothing matches.

create table public.groups (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
comment on table public.groups is 'Canonical group names. Idol sheets reference these by id.';

-- Case-insensitive uniqueness: "IVE" and "ive" cannot both exist.
create unique index groups_name_lower_idx on public.groups (lower(name));

-- Backfill from existing sheets. If past typos produced case variants of one
-- group, keep the most-used spelling (ties: earliest-entered — deterministic
-- in every collation, unlike alphabetical order).
insert into public.groups (name)
select ranked.name
from (
  select trim(group_name) as name,
    row_number() over (
      partition by lower(trim(group_name))
      order by count(*) desc, min(id)
    ) as rn
  from public.idols
  where trim(group_name) <> ''
  group by trim(group_name)
) ranked
where ranked.rn = 1
on conflict do nothing;

-- Point idols at groups, then drop the free-text column.
alter table public.idols
  add column group_id bigint references public.groups (id);

update public.idols i
set group_id = g.id
from public.groups g
where lower(trim(i.group_name)) = lower(g.name);

alter table public.idols alter column group_id set not null;
alter table public.idols drop column group_name;

-- --------------------------------------------------------------- RLS ----
-- Same shape as every other table: public SELECT, admin-only writes.

alter table public.groups enable row level security;
revoke all on table public.groups from anon, authenticated;
grant select on table public.groups to anon, authenticated;
grant select, insert, update, delete on table public.groups to authenticated;
grant all on table public.groups to service_role;

create policy "groups readable by everyone"
  on public.groups for select to anon, authenticated using (true);
create policy "groups insert by admin"
  on public.groups for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "groups update by admin"
  on public.groups for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
create policy "groups delete by admin"
  on public.groups for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin') = 'true');
