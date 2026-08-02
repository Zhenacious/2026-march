#!/usr/bin/env node
/**
 * Applies the SQL files in supabase/migrations/ to the database.
 *
 * Each file runs at most once, ever. A table called schema_migrations records
 * which have already been applied, so running this repeatedly is safe and only
 * new files do anything. Files run in filename order, which is why they are
 * numbered.
 *
 * Usage:
 *   npm run migrate          apply anything not yet applied
 *   npm run migrate:status   show what would run, change nothing
 *
 * Needs DATABASE_URL in fitness-tracker/.env (see .env.example).
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const statusOnly = process.argv.includes('--status');

function loadEnv() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    // No .env file — the variable may still be set in the shell.
  }
}

function fail(message, hint) {
  console.error(`\n  ${message}\n`);
  if (hint) console.error(`${hint}\n`);
  process.exit(1);
}

async function main() {
  loadEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    fail(
      'No DATABASE_URL found.',
      `  Create a file at fitness-tracker/.env containing one line:

    DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@...supabase.com:5432/postgres

  Get that string from the Supabase dashboard:
    Project Settings -> Database -> Connection string -> URI
  Prefer the "Session pooler" URI if one is offered; it works on more networks.

  The .env file is git-ignored, so it never reaches GitHub.`
    );
  }

  // Catch the common case of the template being saved with the placeholder
  // still in it, which would otherwise fail as a confusing auth error.
  if (/\[YOUR-PASSWORD\]|your_password/i.test(url)) {
    fail(
      'DATABASE_URL still contains the [YOUR-PASSWORD] placeholder.',
      `  Open fitness-tracker/.env and replace [YOUR-PASSWORD] (square brackets
  included) with your Supabase database password.

  Supabase dashboard -> Project Settings -> Database. If you don't know the
  password, use "Reset database password" on that page.`
    );
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) fail(`No .sql files found in ${MIGRATIONS_DIR}`);

  // Supabase requires TLS. Its certificate is not in Node's trust store, so
  // verification is disabled — the connection is still encrypted.
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
  } catch (err) {
    fail(
      `Could not connect to the database: ${err.message}`,
      `  Check the password in DATABASE_URL, and try the "Session pooler"
  connection string from Supabase if you used the direct one.`
    );
  }

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query('select filename from schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`\n  Database is up to date — all ${files.length} migrations already applied.\n`);
      return;
    }

    if (statusOnly) {
      console.log(`\n  ${pending.length} migration(s) would be applied:\n`);
      for (const f of pending) console.log(`    ${f}`);
      console.log('\n  Run "npm run migrate" to apply them.\n');
      return;
    }

    console.log(`\n  Applying ${pending.length} migration(s)...\n`);

    for (const filename of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      // Each migration is all-or-nothing: a failure part way through rolls the
      // whole file back, so the database is never left half-changed.
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [filename]);
        await client.query('commit');
        console.log(`    applied  ${filename}`);
      } catch (err) {
        await client.query('rollback');
        console.error(`    FAILED   ${filename}`);
        fail(`${filename} failed and was rolled back: ${err.message}`,
          '  Nothing else was applied. Fix the SQL and run again.');
      }
    }

    console.log(`\n  Done. Database is up to date.\n`);
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err.message));
