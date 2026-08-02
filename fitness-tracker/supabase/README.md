# Database changes

The app's database lives in Supabase. When a new feature needs somewhere to
store something, that change is written as a numbered `.sql` file in
`migrations/` and applied by running one command — you should not need to open
the Supabase dashboard and paste SQL by hand.

## One-time setup

1. In Supabase: **Project Settings → Database → Connection string → URI**.
   If a "Session pooler" URI is offered, prefer it — it works on more networks.
2. Create a file at `fitness-tracker/.env` (it is git-ignored, so it never
   reaches GitHub) containing:

   ```
   DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@....supabase.com:5432/postgres
   ```

   Replace `YOUR-PASSWORD` with your database password. This is the *database*
   password, not your Supabase account password. If you don't know it, the same
   settings page has a "Reset database password" button.

## Everyday use

```bash
npm run migrate          # apply anything not yet applied
npm run migrate:status   # show what would run, change nothing
```

Running `migrate` repeatedly is safe. Each file is applied at most once ever —
a `schema_migrations` table records which have run, and only new files do
anything. Each file runs inside a transaction, so if one fails part way it is
rolled back completely and the database is never left half-changed.

## Adding a migration

Add a new file to `migrations/` with the next number, e.g.
`010_workout_notes.sql`. Two rules:

- **Numbered in order.** Files run in filename order, and that order is fixed
  once applied.
- **Written so re-running is harmless** — `create table if not exists`,
  `alter table ... add column if not exists`, and for policies a
  `drop policy if exists` immediately before the `create policy`. This is what
  lets the whole set be applied safely to a database that is already partly
  set up.

## `manual_workouts.sql`

Not a migration, and deliberately outside `migrations/`. It is a one-off record
of workouts that were typed in by hand. Running it twice would create duplicate
sets, so it is never applied automatically.
