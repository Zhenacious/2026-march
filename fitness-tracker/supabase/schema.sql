-- exercises
create table if not exists exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text default '',
  created_at timestamptz default now(),
  unique(user_id, name)
);
alter table exercises enable row level security;
create policy "Users manage own exercises" on exercises for all using (auth.uid() = user_id);

-- workouts (a training session on a given date)
create table if not exists workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  notes text default '',
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table workouts enable row level security;
create policy "Users manage own workouts" on workouts for all using (auth.uid() = user_id);

-- workout_sets
create table if not exists workout_sets (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references workouts(id) on delete cascade not null,
  exercise_name text not null,
  weight_kg float default 0,
  reps integer default 0,
  distance float default 0,
  distance_unit text default '',
  duration_seconds integer default 0,
  set_order integer default 0,
  created_at timestamptz default now()
);
alter table workout_sets enable row level security;
create policy "Users manage own sets" on workout_sets for all
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));
