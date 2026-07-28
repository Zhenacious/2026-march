-- Manual workout inserts
-- Run each block separately in Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- Only run each block ONCE — sets are not deduplicated, running twice creates duplicates.

-- ============================================================
-- 2026-07-19 (Saturday) — Chest day at gym
-- Bench: 85x5, 80x5, 80x5
-- Chest sup row: 50x8, 50x8, 50x4
-- Machine chest fly: 45x14, 45x10, 45x7, drop 40x2
-- Rear delt fly: 6x12
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_workout_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'procow.bb@gmail.com';

  INSERT INTO workouts (user_id, date)
  VALUES (v_user_id, '2026-07-19')
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT id INTO v_workout_id FROM workouts
  WHERE user_id = v_user_id AND date = '2026-07-19';

  INSERT INTO workout_sets
    (workout_id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_order, set_type)
  VALUES
    (v_workout_id, 'Bench', 85, 5, 0, '', 0, 1, 'normal'),
    (v_workout_id, 'Bench', 80, 5, 0, '', 0, 2, 'normal'),
    (v_workout_id, 'Bench', 80, 5, 0, '', 0, 3, 'normal'),
    (v_workout_id, 'Chest sup row', 50, 8, 0, '', 0, 4, 'normal'),
    (v_workout_id, 'Chest sup row', 50, 8, 0, '', 0, 5, 'normal'),
    (v_workout_id, 'Chest sup row', 50, 4, 0, '', 0, 6, 'normal'),
    (v_workout_id, 'Machine chest fly', 45, 14, 0, '', 0, 7, 'normal'),
    (v_workout_id, 'Machine chest fly', 45, 10, 0, '', 0, 8, 'normal'),
    (v_workout_id, 'Machine chest fly', 45,  7, 0, '', 0, 9, 'normal'),
    (v_workout_id, 'Machine chest fly', 40,  2, 0, '', 0, 10, 'dropset'),
    (v_workout_id, 'Rear delt fly', 6, 12, 0, '', 0, 11, 'normal');

  RAISE NOTICE 'Done — 11 sets inserted for 2026-07-19';
END $$;


-- ============================================================
-- 2026-07-27 (Sunday) — Arms/shoulders at gym
-- Vertical rotator cuff: 0x12x2
-- Preacher curls: 20x6x2, 15x12
-- Tricep overhead: 20x12, 20x10, 17.5x12
-- Dumbbell lat raises: 6x12x3
-- Rear delt flys: 6x12x3
-- Tricep solo push down: 12x5
-- Bicep curls: 8x10x2
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_workout_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'procow.bb@gmail.com';

  INSERT INTO workouts (user_id, date)
  VALUES (v_user_id, '2026-07-27')
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT id INTO v_workout_id FROM workouts
  WHERE user_id = v_user_id AND date = '2026-07-27';

  INSERT INTO workout_sets
    (workout_id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_order, set_type)
  VALUES
    (v_workout_id, 'Vertical rotator cuff',  0, 12, 0, '', 0,  1, 'normal'),
    (v_workout_id, 'Vertical rotator cuff',  0, 12, 0, '', 0,  2, 'normal'),
    (v_workout_id, 'Preacher curls',         20,  6, 0, '', 0,  3, 'normal'),
    (v_workout_id, 'Preacher curls',         20,  6, 0, '', 0,  4, 'normal'),
    (v_workout_id, 'Preacher curls',         15, 12, 0, '', 0,  5, 'normal'),
    (v_workout_id, 'Tricep overhead',        20, 12, 0, '', 0,  6, 'normal'),
    (v_workout_id, 'Tricep overhead',        20, 10, 0, '', 0,  7, 'normal'),
    (v_workout_id, 'Tricep overhead',      17.5, 12, 0, '', 0,  8, 'normal'),
    (v_workout_id, 'Dumbbell lat raises',     6, 12, 0, '', 0,  9, 'normal'),
    (v_workout_id, 'Dumbbell lat raises',     6, 12, 0, '', 0, 10, 'normal'),
    (v_workout_id, 'Dumbbell lat raises',     6, 12, 0, '', 0, 11, 'normal'),
    (v_workout_id, 'Rear delt flys',          6, 12, 0, '', 0, 12, 'normal'),
    (v_workout_id, 'Rear delt flys',          6, 12, 0, '', 0, 13, 'normal'),
    (v_workout_id, 'Rear delt flys',          6, 12, 0, '', 0, 14, 'normal'),
    (v_workout_id, 'Tricep solo push down',  12,  5, 0, '', 0, 15, 'normal'),
    (v_workout_id, 'Bicep curls',             8, 10, 0, '', 0, 16, 'normal'),
    (v_workout_id, 'Bicep curls',             8, 10, 0, '', 0, 17, 'normal');

  RAISE NOTICE 'Done — 17 sets inserted for 2026-07-27';
END $$;
