-- One row per food you log. Nutrition is copied onto the row at log time
-- rather than looked up later, so correcting a food never rewrites history.

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
