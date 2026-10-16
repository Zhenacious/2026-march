-- Personal Claude connector links. Each user can have one active link; the
-- link's secret key is generated in the browser and only its SHA-256 hash is
-- stored here. api/mcp.js hashes the key from the URL and looks it up (with
-- the server-only service-role key) to find whose data to return.
-- Generating a new link replaces the row; deleting the row revokes the link.

create table if not exists connector_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table connector_keys enable row level security;

-- Users can see, create, replace and delete only their own row. The row holds
-- a hash, so even reading it back cannot recover the link.
drop policy if exists "Users manage own connector key" on connector_keys;
create policy "Users manage own connector key" on connector_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
