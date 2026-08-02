-- How an exercise is measured, so the app knows which inputs to show when
-- logging it: weight + reps, time only, or distance + time.
-- Existing exercises default to 'weight_reps', which is the common case.
alter table exercises
  add column if not exists track_type text not null default 'weight_reps';
