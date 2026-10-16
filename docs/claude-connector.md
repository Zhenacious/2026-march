# FitTrack Claude connector

FitTrack exposes a small, **read-only** MCP server so Claude (claude.ai, Claude Code,
Claude Desktop) can pull your training, food and body weight data live from the
database whenever you ask a coaching question. Nothing is copied or duplicated,
and the connector has no way to write anything.

Code: `fitness-tracker/api/mcp.js` (the endpoint),
`fitness-tracker/api/_connectorAuth.js` (turns a link key into a user) and
`fitness-tracker/api/_connectorData.js` (the queries).

## What Claude can call

| Tool | What it returns |
|---|---|
| `get_recent_workouts(days=14)` | Sessions newest first, each exercise with sets like `85x5`, `BWx12`, `5km / 25:00`, best e1RM, volume, session notes |
| `get_exercise_history(exercise, sessions=10)` | One exercise across sessions, plus its all-time best set. Partial names match |
| `get_food_log(days=7)` | Per-day calories and macros, every entry by meal, period average, your goals |
| `get_weight_log(days=90)` | Body weight entries, latest value, change over the period, 7-day average |

Dates use the `FITTRACK_TZ` time zone (default `Pacific/Auckland`).

## How it is secured

- Each user's link looks like `https://dolphfittrack.vercel.app/api/mcp/ft_<random>`.
  You make it on the **Connect to Claude** page in FitTrack. Only a SHA-256 hash
  (a one-way scrambled fingerprint) of the key is stored, in the `connector_keys`
  table, so the full link is shown once and cannot be looked up again. Treat it like
  a password.
- The server looks the hash up using `SUPABASE_SERVICE_ROLE_KEY`. That secret lives
  only in Vercel and is never given a `VITE_` name (which would expose it to the
  browser). Every query is then filtered to that one user.
  `scripts/test-connector-scope.mjs` checks this (`npm run test:connector`).
- Unknown, malformed or revoked keys get a plain 404. The code only ever runs
  SELECT queries, never writes.
- No secrets live in the code or in git. `.env` and `.env.local` are git-ignored.

## One-time setup

### Site owner (once)

In the Vercel dashboard -> your FitTrack project -> **Settings -> Environment
Variables**, add `SUPABASE_SERVICE_ROLE_KEY` for the **Production** environment. Find
the value in Supabase -> Project Settings -> API -> `service_role` key. Then
**Deployments -> latest -> Redeploy** so the functions pick it up.

Optional: `FITTRACK_TZ` (default `Pacific/Auckland`). `VITE_SUPABASE_URL` should
already be there from the original deployment.

If something is wrong on the server side (for example the secret is missing), the
connector answers "Connector lookup failed".

Once your new link works (see below), delete `FITTRACK_EMAIL`, `FITTRACK_PASSWORD`
and `MCP_ACCESS_KEY` from the same Vercel page (Settings -> Environment Variables).
The connector no longer uses them, and removing them takes your FitTrack password
out of Vercel.

### Upgrading from the old shared link

After this version is deployed, the old link (the one built from `MCP_ACCESS_KEY`)
stops working. Do these steps in order:

1. Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel (see above).
2. Deploy (Deployments -> latest -> Redeploy).
3. In FitTrack, open **More -> Connect to Claude -> Generate my link** and copy it.
4. Replace the old URL with the new one in claude.ai (Settings -> Connectors ->
   FitTrack), and in Claude Code too if you use it.
5. Check it works: from the `fitness-tracker/` folder run
   `node scripts/test-mcp.mjs <new link>`.
6. Delete the three old Vercel variables: `FITTRACK_EMAIL`, `FITTRACK_PASSWORD`
   and `MCP_ACCESS_KEY`.

### Every user: make your link

In FitTrack, open **More -> Connect to Claude -> Generate my link**, then press
**Copy**. Keep it somewhere safe, because it is shown only once.

### Connect it to Claude

**claude.ai:** Settings -> Connectors -> **Add custom
connector**. Name it `FitTrack`, paste your link from the Connect to Claude page,
leave the OAuth fields empty, and add. Then enable it in the project's tools menu.
Custom connectors need a Pro, Max, Team or Enterprise plan.

**Claude Code:**

```
claude mcp add --transport http fittrack <your link>
```

**Claude Desktop:** Settings -> Connectors -> Add custom connector, same link.

### Optional: tell a Claude project to use it

If you use a claude.ai project for training advice, paste this into its instructions
so Claude pulls your data instead of asking for it:

> **FitTrack (source of truth for lifting, food and body weight).** Live data via the
> `FitTrack` connector, read-only. Before answering anything about recent training,
> recovery, nutrition or weight, call `get_recent_workouts` (and `get_food_log` /
> `get_weight_log` when relevant) rather than relying on memory or older notes. Use
> `get_exercise_history` for questions about a specific lift. Sets are written as
> `kg x reps` ("85x5"), `BWx12` for bodyweight, and `distance / time` for cardio.
> Never ask me to paste workout data; pull it.

## Testing locally without deploying

Add `SUPABASE_SERVICE_ROLE_KEY` to `fitness-tracker/.env`, then:

```
npm run mcp:dev                    # starts http://localhost:8787/api/mcp/<key>
npm run test:mcp -- <URL>          # in a second terminal
```

`npm run test:mcp -- <URL>` tests whatever URL you pass, for example your live link
from the Connect to Claude page. If you instead put your link's key in `.env` as
`MCP_TEST_KEY`, plain `npm run test:mcp` tests the local server started by
`npm run mcp:dev`. `npm run test:connector` runs the key and scope tests.

## Rotating or revoking access

On the Connect to Claude page, press **Make a new link** (the old one stops
immediately) or **Revoke** (confirm with "Yes, revoke"). Update the link in Claude
afterwards if you made a new one.
