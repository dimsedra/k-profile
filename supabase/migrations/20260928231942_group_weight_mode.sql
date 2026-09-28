-- Group combined-stats weighting, adjustable in Settings.
-- 'popularity': members pull proportionally to popularity points.
-- 'equal': every member pulls the same regardless of popularity.
alter table public.engine_config
  add column group_weight_mode text not null default 'popularity'
  check (group_weight_mode in ('popularity', 'equal'));
