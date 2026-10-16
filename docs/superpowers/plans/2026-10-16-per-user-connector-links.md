# Per-User Claude Connector Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any FitTrack user can generate their own private Claude connector link from inside the app, with no access to Vercel or the code, and the link only ever returns that user's data.

**Architecture:** Each user gets a random secret key, generated in their browser. Only a SHA-256 hash of the key is stored in a new `connector_keys` table, protected by row-level security. The MCP endpoint (`api/mcp.js`) hashes the key from the URL, looks up the owning `user_id` with a server-only Supabase service-role client, and passes `{ client, userId }` into the existing read-only query functions, every one of which already filters by `user_id`. The single shared login (`FITTRACK_EMAIL` / `FITTRACK_PASSWORD` / `MCP_ACCESS_KEY`) is removed.

**Tech Stack:** React 19 + Vite, Supabase (Postgres + RLS, `@supabase/supabase-js` v2), Vercel serverless functions, `@modelcontextprotocol/sdk`, Web Crypto (`crypto.subtle`, available in browsers and in Node 24), lucide-react icons, Tailwind. Tests are plain Node scripts in `fitness-tracker/scripts/` that print PASS/FAIL and set the exit code (see `scripts/test-pr-badge.mjs`).

**Spec:** No separate spec file. This implements "Option 2" agreed in conversation on 2026-10-16:
1. A "Connect to Claude" page in FitTrack.
2. **Generate my link** creates a personal secret and stores it.
3. The page shows `https://<site>/api/mcp/<key>` with a copy button and setup steps.
4. The server finds the user from the key and only returns that user's data.
5. **Revoke** kills the link. Generating again replaces the old one.

The owner's password no longer lives in Vercel.

## Global Constraints

- The connector stays **read-only**. No MCP tool may write. The endpoint itself does no writes either (no "last used" tracking).
- The plaintext key is **never stored**. Only `sha256(key)` as lowercase hex goes in the database, and the key is shown to the user once.
- Key format: `ft_` followed by 43 base64url characters (32 random bytes). The server rejects anything else with 404 before touching the database.
- A wrong, missing or revoked key returns a plain `404 {"error":"Not found"}` (same as today).
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It must **never** have a `VITE_` prefix and never be imported from `src/` browser code.
- Every query run with the service-role client must be scoped to the resolved `userId`, because the service role bypasses RLS. Task 2's scope test enforces this.
- No emojis in the UI. Use lucide-react icons.
- Schema changes go in `fitness-tracker/supabase/migrations/` and are applied with `npm run migrate`. Never "paste SQL into Supabase".
- Commit and push to `origin master` after each task (project CLAUDE.md). Commit messages explain what and why.
- `FITTRACK_TZ` stays a single global setting (default `Pacific/Auckland`). Per-user time zones are out of scope.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `fitness-tracker/supabase/migrations/015_connector_keys.sql` | Create | `connector_keys` table + RLS |
| `fitness-tracker/src/lib/connectorKey.js` | Create | Pure helpers shared by browser and server: `generateConnectorKey`, `hashConnectorKey`, `isConnectorKey`, `connectorUrl`. No Supabase import. |
| `fitness-tracker/scripts/test-connector-key.mjs` | Create | Tests for the helpers |
| `fitness-tracker/api/_athleteData.js` | Modify | Remove the env-password `getClient()`. Each `get*` function takes `(args, ctx)` where `ctx = { client, userId }`. |
| `fitness-tracker/scripts/test-connector-scope.mjs` | Create | Fake Supabase client proving every query is scoped to `userId` |
| `fitness-tracker/api/_connectorAuth.js` | Create | `resolveConnectorUser(key)`: key -> `{ client, userId }` or `null` |
| `fitness-tracker/api/mcp.js` | Modify | Use `resolveConnectorUser` instead of `MCP_ACCESS_KEY`. Pass ctx to tools. |
| `fitness-tracker/scripts/mcp-local.mjs` | Modify | Drop the `MCP_ACCESS_KEY` default and route any `/api/mcp/<key>` |
| `fitness-tracker/scripts/test-mcp.mjs` | Modify | Needs a URL or `MCP_TEST_KEY` |
| `fitness-tracker/src/pages/ConnectClaude.jsx` | Create | The "Connect to Claude" page |
| `fitness-tracker/src/App.jsx` | Modify | Route `/connect-claude` |
| `fitness-tracker/src/components/Layout.jsx` | Modify | "Connect to Claude" item in the More sheet |
| `fitness-tracker/package.json` | Modify | `test:connector` script |
| `fitness-tracker/.env.example`, `docs/athlete-os-connector.md`, `CLAUDE.md` | Modify | New setup instructions |

---

### Task 1: Key helpers + `connector_keys` table

**Files:**
- Create: `fitness-tracker/src/lib/connectorKey.js`
- Create: `fitness-tracker/scripts/test-connector-key.mjs`
- Create: `fitness-tracker/supabase/migrations/015_connector_keys.sql`
- Modify: `fitness-tracker/package.json` (scripts)

**Interfaces:**
- Produces:
  - `generateConnectorKey(): string` returns `"ft_" + 43 base64url chars`
  - `hashConnectorKey(key: string): Promise<string>` returns 64-char lowercase hex SHA-256
  - `isConnectorKey(value: unknown): boolean`
  - `connectorUrl(origin: string, key: string): string` returns `${origin}/api/mcp/${key}` with any trailing `/` on origin removed
  - Table `public.connector_keys(user_id uuid PK -> auth.users, key_hash text unique not null, created_at timestamptz)`

- [ ] **Step 1: Write the failing test**

Create `fitness-tracker/scripts/test-connector-key.mjs`:

```js
// Checks the connector key helpers shared by the Connect to Claude page and
// the MCP endpoint. Pure, no database. Run: node scripts/test-connector-key.mjs
import {
  generateConnectorKey, hashConnectorKey, isConnectorKey, connectorUrl,
} from '../src/lib/connectorKey.js';

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
  if (!ok) failed++;
}

const a = generateConnectorKey();
const b = generateConnectorKey();
check('key has the ft_ prefix and 43 base64url chars', /^ft_[A-Za-z0-9_-]{43}$/.test(a), true);
check('two keys are different', a === b, false);
check('a generated key passes the format check', isConnectorKey(a), true);
check('the old env-style key is rejected', isConnectorKey('abc123'), false);
check('wrong prefix is rejected', isConnectorKey(`xx_${a.slice(3)}`), false);
check('too short is rejected', isConnectorKey(a.slice(0, -1)), false);
check('non-string is rejected', isConnectorKey(undefined), false);

// Known SHA-256 vector so browser and server provably agree
check('hash of "abc" matches the standard SHA-256',
  await hashConnectorKey('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('hashing is stable', await hashConnectorKey(a), await hashConnectorKey(a));
check('different keys hash differently', (await hashConnectorKey(a)) === (await hashConnectorKey(b)), false);

check('url joins origin and key', connectorUrl('https://x.app', 'ft_k'), 'https://x.app/api/mcp/ft_k');
check('url drops a trailing slash on origin', connectorUrl('https://x.app/', 'ft_k'), 'https://x.app/api/mcp/ft_k');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `fitness-tracker/`): `node scripts/test-connector-key.mjs`
Expected: crash with `Cannot find module '.../src/lib/connectorKey.js'`

- [ ] **Step 3: Write the helpers**

Create `fitness-tracker/src/lib/connectorKey.js`:

```js
// Personal Claude connector keys. Used by the Connect to Claude page (to make
// a key) and by api/mcp.js (to check one). Only the SHA-256 hash of a key is
// ever stored, so a database leak does not leak working links.
//
// Uses Web Crypto, which exists in every browser and in Node 20+, so this one
// file works on both sides. Do not import Supabase here.

const PREFIX = 'ft_';
const KEY_PATTERN = /^ft_[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 32 random bytes -> "ft_" + 43 base64url characters
export function generateConnectorKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return PREFIX + toBase64Url(bytes);
}

export function isConnectorKey(value) {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

export async function hashConnectorKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function connectorUrl(origin, key) {
  return `${String(origin).replace(/\/+$/, '')}/api/mcp/${key}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-connector-key.mjs`
Expected: every line `PASS`, ending `all passed`, exit code 0.

- [ ] **Step 5: Write the migration**

Create `fitness-tracker/supabase/migrations/015_connector_keys.sql`:

```sql
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
```

- [ ] **Step 6: Apply and verify the migration**

Run: `npm run migrate`
Expected: `015_connector_keys.sql` reported as applied.

Run: `npm run check:rls`
Expected: `connector_keys` listed with RLS enabled and no warnings for it.

- [ ] **Step 7: Add the npm script**

In `fitness-tracker/package.json` `"scripts"`, after `"test:mcp"`, add:

```json
    "test:connector": "node scripts/test-connector-key.mjs && node scripts/test-connector-scope.mjs"
```

(`test-connector-scope.mjs` arrives in Task 2. Until then, run the key test directly.)

- [ ] **Step 8: Commit and push**

```bash
git add fitness-tracker/src/lib/connectorKey.js fitness-tracker/scripts/test-connector-key.mjs fitness-tracker/supabase/migrations/015_connector_keys.sql fitness-tracker/package.json
git commit -m "Connector keys: hashed per-user key table and shared key helpers

First step toward every FitTrack user getting their own Claude connector
link. Keys are generated in the browser; only a SHA-256 hash is stored."
git push origin master
```

---

### Task 2: Data functions take the user explicitly (and prove they are scoped)

**Files:**
- Modify: `fitness-tracker/api/_athleteData.js` (header comment lines 1-6, `getClient` lines 14-45, and the four exported `get*` functions)
- Create: `fitness-tracker/scripts/test-connector-scope.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (signatures change, behaviour otherwise identical):
  - `getRecentWorkouts(args: { days?: number }, ctx: { client, userId })`
  - `getExerciseHistory(args: { exercise: string, sessions?: number }, ctx)`
  - `getFoodLog(args: { days?: number }, ctx)`
  - `getWeightLog(args: { days?: number }, ctx)`
  - `getClient` is **removed**, along with the `createClient` import and `SUPABASE_ANON_KEY`.

- [ ] **Step 1: Write the failing scope test**

Create `fitness-tracker/scripts/test-connector-scope.mjs`:

```js
// The connector reads with Supabase's service-role key, which ignores
// row-level security. So the code itself must scope every query to the one
// user the link belongs to. This test runs each data function against a fake
// client that records every query, then checks each one is scoped.
// Run: node scripts/test-connector-scope.mjs
import {
  getRecentWorkouts, getExerciseHistory, getFoodLog, getWeightLog,
} from '../api/_athleteData.js';

const USER = 'user-a';
const USER_WORKOUT_IDS = ['w1'];

// Rows the fake returns per table, so the code goes down its full path
const FIXTURES = {
  workouts: [{ id: 'w1', date: '2026-10-15', notes: null }],
  workout_sets: [{
    id: 's1', workout_id: 'w1', exercise_name: 'Bench Press', weight_kg: 100, reps: 5,
    set_order: 1, workouts: { date: '2026-10-15', user_id: USER, notes: null },
  }],
  exercises: [{ name: 'Bench Press', category: 'chest', track_type: 'weight_reps' }],
  food_entries: [],
  user_settings: null,
  body_weights: [{ date: '2026-10-15', weight_kg: 80 }],
};

function fakeClient(log) {
  return {
    from(table) {
      const q = { table, calls: [] };
      log.push(q);
      const builder = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            const data = FIXTURES[table];
            return (resolve) => resolve({ data, error: null });
          }
          if (prop === 'maybeSingle') {
            return () => Promise.resolve({ data: FIXTURES[table], error: null });
          }
          return (...args) => { q.calls.push([prop, ...args]); return builder; };
        },
      });
      return builder;
    },
  };
}

function isScoped(q) {
  const has = (method, col, val) => q.calls.some(([m, c, v]) =>
    m === method && c === col && JSON.stringify(v) === JSON.stringify(val));
  if (has('eq', 'user_id', USER)) return true;
  if (q.table === 'workout_sets') {
    return has('eq', 'workouts.user_id', USER) || has('in', 'workout_id', USER_WORKOUT_IDS);
  }
  return false;
}

let failed = 0;
async function checkFn(label, fn, args) {
  const log = [];
  try {
    await fn(args, { client: fakeClient(log), userId: USER });
  } catch (err) {
    console.log(`FAIL  ${label} threw: ${err.message}`);
    failed++;
    return;
  }
  const bad = log.filter((q) => !isScoped(q));
  const ok = log.length > 0 && bad.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} (${log.length} queries)${ok ? '' : `  unscoped: ${bad.map((q) => q.table).join(', ') || 'no queries ran'}`}`);
  if (!ok) failed++;
}

await checkFn('get_recent_workouts only reads this user', getRecentWorkouts, { days: 14 });
await checkFn('get_exercise_history only reads this user', getExerciseHistory, { exercise: 'bench' });
await checkFn('get_food_log only reads this user', getFoodLog, { days: 7 });
await checkFn('get_weight_log only reads this user', getWeightLog, { days: 30 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-connector-scope.mjs`
Expected: four `FAIL ... threw: FITTRACK_EMAIL and FITTRACK_PASSWORD are not set in the environment.` (or a Supabase URL error). The functions still ignore `ctx` and call `getClient()`.

- [ ] **Step 3: Remove `getClient` and take `ctx`**

In `fitness-tracker/api/_athleteData.js`:

Replace the header comment (lines 1-6) with:

```js
// Read-only data access for the Athlete OS connector (api/mcp.js).
//
// Every function takes ctx = { client, userId }. api/_connectorAuth.js builds
// it from the connector link's key. The client uses Supabase's service-role
// key, which bypasses row-level security, so EVERY query here must filter to
// ctx.userId (scripts/test-connector-scope.mjs checks this). Every function
// here only SELECTs. Nothing in this file, or in the connector, writes.
```

Delete the `import { createClient } ...` line, the `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants, and the whole `// ---- auth (cached across warm invocations)` section (`let cached` plus `export async function getClient() { ... }`). Keep `const TZ = ...`.

Change the four exported signatures and their first `getClient` line:

```js
export async function getRecentWorkouts({ days } = {}, { client, userId }) {
  const n = clampCount(days, 14, 365);
  const since = daysAgoISO(n);
```

```js
export async function getExerciseHistory({ exercise, sessions } = {}, { client, userId }) {
  const q = String(exercise || '').trim();
  if (q.length < 2) throw new Error('exercise must be at least 2 characters.');
  const limit = clampCount(sessions, 10, 100);
```

```js
export async function getFoodLog({ days } = {}, { client, userId }) {
  const n = clampCount(days, 7, 365);
  const since = daysAgoISO(n);
```

```js
export async function getWeightLog({ days } = {}, { client, userId }) {
  const n = clampCount(days, 90, 3650);
  const since = daysAgoISO(n);
```

In each one, delete the line `const { client, userId } = await getClient();`. Leave all other lines unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-connector-scope.mjs`
Expected: four `PASS` lines, `all passed`.

Then: `grep -n "getClient\|FITTRACK_EMAIL\|FITTRACK_PASSWORD" api/_athleteData.js`
Expected: no output.

- [ ] **Step 5: Commit and push**

`api/mcp.js` still calls the old signatures, so the deployed connector breaks until Task 3 lands. Commit locally only. Task 3 pushes both together.

```bash
git add fitness-tracker/api/_athleteData.js fitness-tracker/scripts/test-connector-scope.mjs
git commit -m "Connector data functions take the user explicitly

Removes the shared FITTRACK_EMAIL/PASSWORD login. Each query function now
receives { client, userId }, and a new test proves every query filters to
that user, which matters once the connector reads with the service role."
```

---

### Task 3: Endpoint resolves the user from the link

**Files:**
- Create: `fitness-tracker/api/_connectorAuth.js`
- Modify: `fitness-tracker/api/mcp.js` (header comment lines 1-9, `keyMatches` lines 19-23, `tool()` lines 26-35, `buildServer` line 40 and its four `tool(...)` calls, `handler` lines 87-95)
- Modify: `fitness-tracker/scripts/mcp-local.mjs`
- Modify: `fitness-tracker/scripts/test-mcp.mjs`
- Modify: `fitness-tracker/.env.example` (Athlete OS block)

**Interfaces:**
- Consumes: `isConnectorKey`, `hashConnectorKey` from `src/lib/connectorKey.js` (Task 1). `get*` functions with `(args, ctx)` (Task 2). Table `connector_keys` (Task 1).
- Produces: `resolveConnectorUser(key: string): Promise<{ client, userId } | null>`. Env var `SUPABASE_SERVICE_ROLE_KEY` (server only).

- [ ] **Step 1: Write `_connectorAuth.js`**

Create `fitness-tracker/api/_connectorAuth.js`:

```js
// Turns the key in a connector link (/api/mcp/<key>) into the FitTrack user it
// belongs to. Keys are stored only as SHA-256 hashes in connector_keys, which
// users manage from the Connect to Claude page.
//
// Uses the service-role key, which bypasses row-level security, because the
// request carries no user login. That is why every query in _athleteData.js
// filters to the userId returned here. Server only: never import from src/.

import { createClient } from '@supabase/supabase-js';
import { isConnectorKey, hashConnectorKey } from '../src/lib/connectorKey.js';

let serviceClient = null;

function getServiceClient() {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Values pasted into a dashboard often pick up stray spaces or quote marks
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in the environment.');
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return serviceClient;
}

// Returns { client, userId } for a valid, active key, otherwise null.
export async function resolveConnectorUser(key) {
  if (!isConnectorKey(key)) return null;
  const client = getServiceClient();
  const { data, error } = await client
    .from('connector_keys')
    .select('user_id')
    .eq('key_hash', await hashConnectorKey(key))
    .maybeSingle();
  if (error) throw new Error(`Connector key lookup failed: ${error.message}`);
  return data ? { client, userId: data.user_id } : null;
}
```

- [ ] **Step 2: Rewire `api/mcp.js`**

Replace the header comment (lines 1-9) with:

```js
// Athlete OS connector (served at /api/mcp/<key> via the rewrite in vercel.json): a small, read-only MCP server that lets Claude (claude.ai
// or Claude Code) pull FitTrack data live from the database.
//
// URL shape:  https://<your-fittrack-domain>/api/mcp/<personal key>
//
// Each FitTrack user makes their own link on the Connect to Claude page. The
// key in the URL is looked up (as a hash) to find whose data to return; an
// unknown or revoked key gets a plain 404. Every tool only reads.
```

Replace the imports and `keyMatches` with:

```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  getRecentWorkouts, getExerciseHistory, getFoodLog, getWeightLog,
} from './_athleteData.js';
import { resolveConnectorUser } from './_connectorAuth.js';
```

(`timingSafeEqual` is no longer needed. The hash lookup replaces the string compare.)

Replace `tool(fn)` with a version that binds the user:

```js
// Wraps a data function so the tool returns JSON text, or a readable error.
// ctx = { client, userId } for the link's owner.
function tool(fn, ctx) {
  return async (args) => {
    try {
      const result = await fn(args || {}, ctx);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `FitTrack error: ${err.message}` }] };
    }
  };
}
```

Change `function buildServer() {` to `function buildServer(ctx) {` and the four handlers to `tool(getRecentWorkouts, ctx)`, `tool(getExerciseHistory, ctx)`, `tool(getFoodLog, ctx)`, `tool(getWeightLog, ctx)`.

Replace the start of `handler` (the key check through `const server = buildServer();`) with:

```js
function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}

export default async function handler(req, res) {
  let ctx;
  try {
    ctx = await resolveConnectorUser(String(req.query?.key || ''));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Connector is not configured' }));
    return;
  }
  if (!ctx) { notFound(res); return; }

  // Stateless: a fresh server + transport per request, which suits serverless.
  const server = buildServer(ctx);
```

Leave the rest of `handler` (transport creation onward) unchanged.

- [ ] **Step 3: Update the local runner**

In `fitness-tracker/scripts/mcp-local.mjs`, delete the block:

```js
if (!process.env.MCP_ACCESS_KEY) {
  process.env.MCP_ACCESS_KEY = 'local-dev-key';
  console.log('MCP_ACCESS_KEY not set; using "local-dev-key" for this run.');
}
```

Replace the `.listen(...)` callback body with:

```js
  console.log(`FitTrack MCP running at http://localhost:${PORT}/api/mcp/<your key>`);
  console.log('Make a key on the Connect to Claude page, then: npm run test:mcp -- <that full URL>');
```

Update the top comment's usage lines to:

```js
 *   npm run mcp:dev                       starts on http://localhost:8787
 *   npm run test:mcp -- <connector URL>   (in another window) calls every tool
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in fitness-tracker/.env.
```

- [ ] **Step 4: Update the smoke test**

In `fitness-tracker/scripts/test-mcp.mjs`, replace:

```js
const key = process.env.MCP_ACCESS_KEY || 'local-dev-key';
const url = process.argv[2] || `http://localhost:${process.env.MCP_PORT || 8787}/api/mcp/${key}`;
```

with:

```js
const key = process.env.MCP_TEST_KEY;
const url = process.argv[2] || (key && `http://localhost:${process.env.MCP_PORT || 8787}/api/mcp/${key}`);
if (!url) {
  console.error('Pass the connector URL, e.g. node scripts/test-mcp.mjs https://.../api/mcp/ft_...\n'
    + 'or set MCP_TEST_KEY in .env to test the local server.');
  process.exit(1);
}
```

Replace the error filter line:

```js
      if (!/not set in the environment|sign-in failed/.test(text)) failed = true;
```

with:

```js
      failed = true;
```

Update the usage comment at the top to `npm run test:mcp -- <URL>` and `MCP_TEST_KEY`.

- [ ] **Step 5: Update `.env.example`**

Replace the Athlete OS block (from `# Athlete OS connector (api/mcp.js)` down to and including `MCP_ACCESS_KEY=paste_a_long_random_string_here`) with:

```
# Athlete OS connector (api/mcp.js) - the read-only MCP server that lets
# Claude pull a user's training and food data. Each user makes their own link
# on the app's Connect to Claude page; the server needs one secret to look
# those links up. Set it in Vercel (Project -> Settings -> Environment
# Variables, Production) and, for local testing, here.
#
# Supabase dashboard -> Project Settings -> API Keys -> service_role (secret).
# SERVER ONLY. Never give this a VITE_ prefix: that would ship it to browsers.
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
#
# Optional, local testing only: a key from the Connect to Claude page so
# "npm run test:mcp" can call http://localhost:8787 without a URL argument.
MCP_TEST_KEY=
```

Keep the `FITTRACK_TZ` lines below it.

- [ ] **Step 6: Verify**

Run: `npm run test:connector`
Expected: both scripts end `all passed`.

Run: `npm run lint`
Expected: no errors in `api/mcp.js`, `api/_connectorAuth.js` or `api/_athleteData.js`.

Run: `npm run build`
Expected: build succeeds.

Run: `grep -rn "SERVICE_ROLE" src/`
Expected: no output. The secret is never referenced from browser code.

Bad-key check without a service key: set no `SUPABASE_SERVICE_ROLE_KEY`, run `npm run mcp:dev`, then in another terminal run `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/api/mcp/not-a-key`.
Expected: `404`. A malformed key is rejected before any database or env access.

- [ ] **Step 7: Add the Vercel secret BEFORE pushing**

The owner must do this in a browser. You cannot. Tell them, in plain English:
1. Supabase dashboard -> Project Settings -> API Keys -> copy the **service_role** secret.
2. Vercel -> FitTrack project -> Settings -> Environment Variables -> add `SUPABASE_SERVICE_ROLE_KEY` for **Production** with that value.
3. Also put it in `fitness-tracker/.env` for local testing.

Wait for confirmation before pushing. Without the secret, the live connector returns 500 "Connector is not configured".

- [ ] **Step 8: Commit and push**

```bash
git add fitness-tracker/api/_connectorAuth.js fitness-tracker/api/mcp.js fitness-tracker/scripts/mcp-local.mjs fitness-tracker/scripts/test-mcp.mjs fitness-tracker/.env.example
git commit -m "Connector finds the user from their personal link key

api/mcp.js now hashes the key in the URL and looks up its owner in
connector_keys, instead of comparing against one shared MCP_ACCESS_KEY and
logging in with a stored password. Unknown or revoked keys still get a 404."
git push origin master
```

Note: after this deploy the owner's old link (built from `MCP_ACCESS_KEY`) stops working until they make a new one in Task 4.

---

### Task 4: "Connect to Claude" page

**Files:**
- Create: `fitness-tracker/src/pages/ConnectClaude.jsx`
- Modify: `fitness-tracker/src/App.jsx` (lazy import list near line 41, routes near line 126)
- Modify: `fitness-tracker/src/components/Layout.jsx` (lucide import lines 5-20, `moreNavItems` lines 38-47)

**Interfaces:**
- Consumes: `generateConnectorKey`, `hashConnectorKey`, `connectorUrl` (Task 1). `supabase` from `src/lib/supabase.js`. `useAuth()` from `src/contexts/AuthContext` (returns `{ user }`). Table `connector_keys`. RLS lets the user read, upsert and delete their own row.
- Produces: route `/connect-claude`.

- [ ] **Step 1: Write the page**

Create `fitness-tracker/src/pages/ConnectClaude.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plug, Copy, Check, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateConnectorKey, hashConnectorKey, connectorUrl } from '../lib/connectorKey';

// Lets each user make their own private link for Claude's custom connector.
// The link's key is created here in the browser; only its hash is saved, so
// the full link is shown once. Losing it just means making a new one.
export default function ConnectClaude() {
  const { user } = useAuth();
  const [createdAt, setCreatedAt] = useState(null); // when the active link was made
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLink, setNewLink] = useState('');       // shown once, right after generating
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('connector_keys')
      .select('created_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setCreatedAt(data?.created_at || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user.id]);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const key = generateConnectorKey();
      const { data, error: err } = await supabase
        .from('connector_keys')
        .upsert({ user_id: user.id, key_hash: await hashConnectorKey(key), created_at: new Date().toISOString() })
        .select('created_at')
        .single();
      if (err) throw err;
      setCreatedAt(data.created_at);
      setNewLink(connectorUrl(window.location.origin, key));
      setCopied(false);
    } catch (err) {
      setError(err.message || 'Could not create a link.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('connector_keys').delete().eq('user_id', user.id);
    setBusy(false);
    setConfirmRevoke(false);
    if (err) { setError(err.message); return; }
    setCreatedAt(null);
    setNewLink('');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it by hand.');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1 flex items-center gap-2">
        <Plug className="w-6 h-6" /> Connect to Claude
      </h1>
      <p className="text-zinc-400 text-sm mb-6">
        Give Claude read-only access to your workouts, food and body weight, so you can ask
        coaching questions without pasting anything. Claude can never change your data.
      </p>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        {loading ? (
          <p className="text-zinc-400 text-sm">Checking your link...</p>
        ) : newLink ? (
          <>
            <p className="text-zinc-100 text-sm font-medium mb-2">Your connector link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={newLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono"
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-2 rounded-lg"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-amber-300 text-xs mt-3">
              Copy it now. For your security it is only shown once. Treat it like a password:
              anyone with this link can read your data.
            </p>
          </>
        ) : createdAt ? (
          <p className="text-zinc-300 text-sm">
            You have an active link, created {format(new Date(createdAt), 'd MMM yyyy')}. It can't be
            shown again. If you've lost it, make a new one (the old one stops working).
          </p>
        ) : (
          <p className="text-zinc-300 text-sm">You haven't made a link yet.</p>
        )}

        {!loading && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-sm px-3 py-2 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              {createdAt ? 'Make a new link' : 'Generate my link'}
            </button>
            {createdAt && !confirmRevoke && (
              <button
                onClick={() => setConfirmRevoke(true)}
                disabled={busy}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm px-3 py-2 rounded-lg"
              >
                <Trash2 className="w-4 h-4" /> Revoke
              </button>
            )}
            {confirmRevoke && (
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                Claude will lose access.
                <button onClick={revoke} disabled={busy} className="text-red-400 hover:text-red-300 font-medium">Yes, revoke</button>
                <button onClick={() => setConfirmRevoke(false)} className="text-zinc-400 hover:text-zinc-200">Cancel</button>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="text-sm text-zinc-300 space-y-4">
        <div>
          <h2 className="text-zinc-100 font-semibold mb-1">Add it to claude.ai</h2>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400">
            <li>Open claude.ai, then Settings, then Connectors.</li>
            <li>Choose Add custom connector. Name it FitTrack and paste your link. Leave the advanced (OAuth) fields empty.</li>
            <li>In a chat or project, turn FitTrack on from the tools menu.</li>
            <li>Ask something like "How has my bench press gone this month?"</li>
          </ol>
          <p className="text-zinc-500 text-xs mt-2">Custom connectors need a paid Claude plan.</p>
        </div>
        <div>
          <h2 className="text-zinc-100 font-semibold mb-1">Claude Code (optional)</h2>
          <code className="block bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 break-all">
            claude mcp add --transport http fittrack YOUR_LINK
          </code>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `fitness-tracker/src/App.jsx`, after `const MyFoods = lazyPage(() => import('./pages/MyFoods'));` add:

```jsx
const ConnectClaude = lazyPage(() => import('./pages/ConnectClaude'));
```

After `<Route path="/foods" element={<MyFoods />} />` add:

```jsx
        <Route path="/connect-claude" element={<ConnectClaude />} />
```

- [ ] **Step 3: Add the nav item**

In `fitness-tracker/src/components/Layout.jsx`, add `Plug,` to the lucide-react import list (after `RefreshCw,`). Then add as the last entry of `moreNavItems`:

```js
  { to: '/connect-claude', label: 'Connect to Claude', icon: Plug },
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run lint && npm run build`
Expected: both succeed with no new errors.

- [ ] **Step 5: Verify in the running app**

Use the `run` skill (or `npm run dev` + the browser tools) while logged in:
1. More -> Connect to Claude opens the page and shows "You haven't made a link yet."
2. Generate my link shows `http://localhost:5173/api/mcp/ft_...` and Copy shows "Copied".
3. Reload the page. It shows "You have an active link, created <today>" and the link is gone.
4. With `npm run mcp:dev` running and `SUPABASE_SERVICE_ROLE_KEY` in `.env`, run `npm run test:mcp -- http://localhost:8787/api/mcp/<the ft_ key>`. Expected: `server: fittrack v1.0.0`, four tools, the user's real data, exit code 0.
5. Make a new link, then repeat step 4 with the **old** key. Expected: `HTTP 404`.
6. Revoke -> Yes, revoke. Step 4 with the latest key now returns `HTTP 404`, and the page shows "You haven't made a link yet."
7. Phone width (about 400px): the link box and buttons wrap without horizontal scroll.

- [ ] **Step 6: Commit and push**

```bash
git add fitness-tracker/src/pages/ConnectClaude.jsx fitness-tracker/src/App.jsx fitness-tracker/src/components/Layout.jsx
git commit -m "Connect to Claude page: every user can make their own connector link

Generates a personal key in the browser, saves only its hash, shows the
full link once with copy and setup steps, and supports making a new link
or revoking access. No Vercel or code access needed any more."
git push origin master
```

---

### Task 5: Owner switch-over and docs

**Files:**
- Modify: `docs/athlete-os-connector.md`
- Modify: `CLAUDE.md` (the "Athlete OS connector" section)

**Interfaces:**
- Consumes: everything above, deployed.

- [ ] **Step 1: Rewrite the setup doc**

In `docs/athlete-os-connector.md`:
- Replace the "How it is secured" bullets with:
  - Each user's link is `https://dolphfittrack.vercel.app/api/mcp/ft_<random>`, made on the **Connect to Claude** page. Only a SHA-256 hash of the key is stored (`connector_keys`), so the link is shown once.
  - The server looks the hash up with `SUPABASE_SERVICE_ROLE_KEY` (Vercel only, never `VITE_`) and filters every query to that user. `scripts/test-connector-scope.mjs` enforces this.
  - Unknown or revoked keys get a plain 404. Code only ever SELECTs.
- Replace "One-time setup" steps 1-3 with:
  - **Site owner (once):** add `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploy.
  - **Every user:** FitTrack -> More -> Connect to Claude -> Generate my link -> Copy.
- Keep step 4 (Connect it to Claude) and step 5 (project instructions), with "the full URL from step 3" changed to "your link from the Connect to Claude page".
- Change "Testing locally" to use `SUPABASE_SERVICE_ROLE_KEY` and `npm run test:mcp -- <URL>` / `MCP_TEST_KEY`.
- Replace "Rotating or revoking access" with: "On the Connect to Claude page, Make a new link (the old one stops immediately) or Revoke."
- Remove every mention of `FITTRACK_EMAIL`, `FITTRACK_PASSWORD` and `MCP_ACCESS_KEY`.

- [ ] **Step 2: Update CLAUDE.md**

Replace the "Athlete OS connector" section body with:

```markdown
`fitness-tracker/api/mcp.js` is a read-only MCP server so Claude (claude.ai project or Claude Code) can pull workouts, exercise history, food and body weight live. Each user makes their own link on the **Connect to Claude** page (`/connect-claude`); keys are stored hashed in `connector_keys` and resolved in `api/_connectorAuth.js` with the server-only `SUPABASE_SERVICE_ROLE_KEY`. Every query must filter to the resolved user (`npm run test:connector` checks this). Setup lives in `docs/athlete-os-connector.md`. Keep it read-only; never add a tool that writes.
```

Add a row to the Pages table: `| /connect-claude | ConnectClaude.jsx | Make, copy or revoke your personal Claude connector link |`

- [ ] **Step 3: Owner switch-over (guide the user through it)**

Tell the owner, in plain English:
1. On the live site, go to More -> Connect to Claude -> Generate my link -> Copy.
2. claude.ai -> Settings -> Connectors -> FitTrack -> replace the URL with the new link (or remove FitTrack and add it again).
3. Check it: run `node scripts/test-mcp.mjs <new link>` from `fitness-tracker/`. Expect four tools and real data.
4. In Vercel, delete `FITTRACK_EMAIL`, `FITTRACK_PASSWORD` and `MCP_ACCESS_KEY`. They are no longer used, and removing them takes the password out of Vercel. Also remove `MCP_ACCESS_KEY` from `fitness-tracker/.env`.

- [ ] **Step 4: Commit and push**

```bash
git add docs/athlete-os-connector.md CLAUDE.md
git commit -m "Docs: connector links are now per-user from the Connect to Claude page

Replaces the old single-account setup (shared password and access key in
Vercel) with the self-serve flow, and documents the service-role secret
and the scope test that keeps each user's data separate."
git push origin master
```

- [ ] **Step 5: Update memory**

Update `project_athlete_os_connector.md` in the user's memory folder: the connector is now per-user via `/connect-claude`, the env-password login is gone, and the only server secret is `SUPABASE_SERVICE_ROLE_KEY`.
