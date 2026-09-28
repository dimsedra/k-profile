alter table public.groups
  add column photo_path text,
  add column photo_kind text not null default 'image' check (photo_kind in ('image', 'video')),
  add column bio text not null default '',
  add column debut_year smallint check (debut_year between 1990 and 2100),
  add column agency text,
  add column fandom_name text;
comment on column public.groups.photo_path is 'Object path in idol-cards bucket: group-<id>/portrait';
