-- Marks a set as a normal set, a drop set, or part of a super set.
alter table workout_sets
  add column if not exists set_type text default 'normal';
