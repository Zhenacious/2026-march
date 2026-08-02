-- Your own food library — foods you add or correct yourself, searchable when
-- logging so you are not dependent on the external food databases.

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
alter table custom_foods enable row level security;
drop policy if exists "Users manage own custom foods" on custom_foods;
create policy "Users manage own custom foods" on custom_foods for all using (auth.uid() = user_id);
create index if not exists custom_foods_user_name on custom_foods (user_id, name);
