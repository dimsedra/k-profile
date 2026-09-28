-- Cover focal point for group banners (Spotify-style repositioning).
-- Percentages for CSS object-position; 50/50 centers the photo.
alter table public.groups
  add column photo_focus_x smallint not null default 50 check (photo_focus_x between 0 and 100),
  add column photo_focus_y smallint not null default 50 check (photo_focus_y between 0 and 100);
comment on column public.groups.photo_focus_x is 'Banner focal point, CSS object-position X percent';
comment on column public.groups.photo_focus_y is 'Banner focal point, CSS object-position Y percent';
