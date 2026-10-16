-- schema_migrations is created by scripts/migrate.mjs to record which files
-- have run. It lived in the public schema with Row-Level Security off, so
-- anyone holding the site's anon key could read or edit it (Supabase advisor:
-- rls_disabled_in_public).
--
-- Enabling RLS with no policies denies the anon and authenticated roles all
-- access. The migrate script connects as the postgres owner, which bypasses
-- RLS, so it keeps working.
alter table public.schema_migrations enable row level security;
