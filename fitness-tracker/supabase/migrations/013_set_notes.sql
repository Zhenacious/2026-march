-- Per-set notes ("felt heavy", "left knee twinge") move from the browser's
-- localStorage into the database, alongside the per-session note that already
-- lives in workouts.notes. Both then reach the CSV export and the Athlete OS
-- connector from any device.

alter table workout_sets add column if not exists notes text default '';
