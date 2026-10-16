#!/usr/bin/env node
/**
 * Lists every table in the public schema and whether Row-Level Security is on.
 * Any table with RLS off can be read and changed by anyone holding the
 * project's public (anon) key, which ships inside the website.
 *
 * Usage: npm run check:rls   (needs DATABASE_URL in fitness-tracker/.env)
 * Exits with code 1 if any public table is unprotected.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* may be set in shell */ }

if (!process.env.DATABASE_URL) {
  console.error('\n  No DATABASE_URL found. See scripts/migrate.mjs for setup.\n');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(`
  select c.relname as table, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`);
await client.end();

console.log('');
for (const r of rows) console.log(`  ${r.rls ? 'protected  ' : 'UNPROTECTED'}  ${r.table}`);
const open = rows.filter((r) => !r.rls);
console.log(open.length
  ? `\n  ${open.length} table(s) have Row-Level Security OFF.\n`
  : '\n  All public tables have Row-Level Security on.\n');
process.exit(open.length ? 1 : 0);
