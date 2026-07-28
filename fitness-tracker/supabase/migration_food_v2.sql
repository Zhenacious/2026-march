-- v2: editable amounts (servings vs grams) + per-100g basis, and user goal settings

alter table food_entries add column if not exists quantity_mode text not null default 'servings'
  check (quantity_mode in ('servings','grams'));
alter table food_entries add column if not exists grams float;
alter table food_entries add column if not exists serving_grams float;
alter table food_entries add column if not exists cal_per_100g float;
alter table food_entries add column if not exists protein_per_100g float;
alter table food_entries add column if not exists carbs_per_100g float;
alter table food_entries add column if not exists fat_per_100g float;

create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  goal_calories integer,
  goal_protein_g integer,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "Users manage own settings" on user_settings for all using (auth.uid() = user_id);
