-- Adds a measurement type to each exercise so the app knows which inputs to
-- show when logging: weight + reps, time only, or distance + time.
-- Existing exercises default to 'weight_reps'. Safe to run more than once.
alter table exercises
  add column if not exists track_type text not null default 'weight_reps';
