-- Body weight moves from the browser's localStorage into the database, so it
-- syncs across devices and can be read by the Athlete OS connector (api/mcp).
-- One entry per user per day; logging the same day again replaces it.

create table if not exists body_weights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight_kg float not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table body_weights enable row level security;

drop policy if exists "Users manage own body weights" on body_weights;
create policy "Users manage own body weights" on body_weights
  for all using (auth.uid() = user_id);

create index if not exists body_weights_user_date on body_weights (user_id, date);
