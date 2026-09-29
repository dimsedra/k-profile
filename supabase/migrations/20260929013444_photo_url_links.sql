-- External image links as a zero-quota alternative to bucket uploads.
-- Display precedence (app-side): uploaded file > external link > initials.
-- Only http(s) values are accepted; the app validates reachability by
-- previewing, with an initials fallback if the link later dies.
alter table public.idols
  add column photo_url text check (photo_url is null or photo_url like 'http%');
alter table public.groups
  add column photo_url text check (photo_url is null or photo_url like 'http%');
