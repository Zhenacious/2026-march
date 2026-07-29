-- ============================================================
-- FOOD LOGGING SETUP — run this whole file once in the
-- Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It combines migration_food_log.sql + _v2 + _v3 in order.
-- Safe to run more than once.
-- ============================================================

-- 1. The food entries table (one row per logged food)
create table if not exists food_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text not null,
  barcode text default '',
  serving_size text default '',
  servings float default 1,
  calories float default 0,
  protein_g float default 0,
  carbs_g float default 0,
  fat_g float default 0,
  created_at timestamptz default now()
);
alter table food_entries enable row level security;
drop policy if exists "Users manage own food entries" on food_entries;
create policy "Users manage own food entries" on food_entries for all using (auth.uid() = user_id);
create index if not exists food_entries_user_date on food_entries (user_id, date);

-- 2. Amounts by weight: per-100g basis + which mode was used
alter table food_entries add column if not exists quantity_mode text not null default 'servings';
alter table food_entries add column if not exists grams float;
alter table food_entries add column if not exists serving_grams float;
alter table food_entries add column if not exists cal_per_100g float;
alter table food_entries add column if not exists protein_per_100g float;
alter table food_entries add column if not exists carbs_per_100g float;
alter table food_entries add column if not exists fat_per_100g float;

-- 3. Flexible units: remember what was typed (e.g. 3.5 oz) next to the grams
alter table food_entries add column if not exists input_unit text not null default 'g';
alter table food_entries add column if not exists input_amount float;

-- 4. Your own food library (add / edit / search your own foods)
create table if not exists custom_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand text default '',
  barcode text default '',
  serving_size text default '',
  serving_grams float,
  calories float default 0,
  protein_g float default 0,
  carbs_g float default 0,
  fat_g float default 0,
  cal_per_100g float,
  protein_per_100g float,
  carbs_per_100g float,
  fat_per_100g float,
  created_at timestamptz default now()
);
-- alternative names (Chinese name, pinyin, regional English), comma-separated
alter table custom_foods add column if not exists aliases text default '';
alter table custom_foods enable row level security;
drop policy if exists "Users manage own custom foods" on custom_foods;
create policy "Users manage own custom foods" on custom_foods for all using (auth.uid() = user_id);
create index if not exists custom_foods_user_name on custom_foods (user_id, name);

-- 5. Daily calorie / protein goals
create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  goal_calories integer,
  goal_protein_g integer,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
drop policy if exists "Users manage own settings" on user_settings;
create policy "Users manage own settings" on user_settings for all using (auth.uid() = user_id);
