-- Daily calorie / protein goals. One row per account.
create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  goal_calories integer,
  goal_protein_g integer,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
drop policy if exists "Users manage own settings" on user_settings;
create policy "Users manage own settings" on user_settings for all using (auth.uid() = user_id);
