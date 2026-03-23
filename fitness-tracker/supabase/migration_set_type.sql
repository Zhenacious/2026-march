-- Add set_type column to workout_sets
-- Run this in Supabase SQL Editor if you already ran schema.sql previously

ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS set_type text DEFAULT 'normal';
