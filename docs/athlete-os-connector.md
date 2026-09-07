# Athlete OS connector (FitTrack -> Claude)

FitTrack exposes a small, **read-only** MCP server so Claude (claude.ai, Claude Code,
Claude Desktop) can pull your training, food and body weight data live from the
database whenever you ask a coaching question. Nothing is copied or duplicated,
and the connector has no way to write anything.

Code: `fitness-tracker/api/mcp.js` (the endpoint) and
`fitness-tracker/api/_athleteData.js` (the queries).

## What Claude can call

| Tool | What it returns |
|---|---|
| `get_recent_workouts(days=14)` | Sessions newest first, each exercise with sets like `85x5`, `BWx12`, `5km / 25:00`, best e1RM, volume, session notes |
| `get_exercise_history(exercise, sessions=10)` | One exercise across sessions, plus its all-time best set. Partial names match |
| `get_food_log(days=7)` | Per-day calories and macros, every entry by meal, period average, your goals |
| `get_weight_log(days=90)` | Body weight entries, latest value, change over the period, 7-day average |

Dates use the `FITTRACK_TZ` time zone (default `Pacific/Auckland`).

## How it is secured

- The URL contains a long random key: `https://dolphfittrack.vercel.app/api/mcp/<MCP_ACCESS_KEY>`.
  A wrong key returns a plain 404. Treat the full URL like a password.
- The server signs in to Supabase as your own FitTrack login (email + password from
  Vercel's environment). Supabase row-level security then guarantees it can only see
  your rows, and the code only ever issues SELECT queries.
- No secrets live in the code or in git. `.env` and `.env.local` are git-ignored.

## One-time setup

### 1. Generate the access key

In a terminal inside `fitness-tracker/`:

```
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Copy the printed string. That is your `MCP_ACCESS_KEY`.

### 2. Add four environment variables in Vercel

Vercel dashboard -> your FitTrack project -> **Settings -> Environment Variables**.
Add each for the **Production** environment:

| Name | Value |
|---|---|
| `FITTRACK_EMAIL` | the email you log in to FitTrack with |
| `FITTRACK_PASSWORD` | that account's password |
| `MCP_ACCESS_KEY` | the string from step 1 |
| `FITTRACK_TZ` | `Pacific/Auckland` (optional, this is the default) |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` should already be there from the
original deployment. Then **Deployments -> latest -> Redeploy** so the functions
pick up the new variables.

### 3. Check it works

```
node scripts/test-mcp.mjs https://dolphfittrack.vercel.app/api/mcp/<MCP_ACCESS_KEY>
```

You should see `server: fittrack v1.0.0`, four tools, and real data from each tool.

### 4. Connect it to Claude

**claude.ai (your Athlete OS project):** Settings -> Connectors -> **Add custom
connector**. Name it `FitTrack`, paste the full URL from step 3 including the key,
leave the OAuth fields empty, and add. Then enable it in the project's tools menu.
Custom connectors need a Pro, Max, Team or Enterprise plan.

**Claude Code:**

```
claude mcp add --transport http fittrack https://dolphfittrack.vercel.app/api/mcp/<MCP_ACCESS_KEY>
```

**Claude Desktop:** Settings -> Connectors -> Add custom connector, same URL.

### 5. Tell the Athlete OS project to use it

Paste this into the project's instructions (and the "Where my data lives" section
of its CLAUDE.md), replacing any placeholder about FitTrack:

> **FitTrack (source of truth for lifting, food and body weight).** Live data via the
> `FitTrack` connector, read-only. Before answering anything about recent training,
> recovery, nutrition or weight, call `get_recent_workouts` (and `get_food_log` /
> `get_weight_log` when relevant) rather than relying on memory or older notes. Use
> `get_exercise_history` for questions about a specific lift. Sets are written as
> `kg x reps` ("85x5"), `BWx12` for bodyweight, and `distance / time` for cardio.
> Never ask me to paste workout data; pull it.

## Testing locally without deploying

```
npm run mcp:dev      # starts http://localhost:8787/api/mcp/<key>
npm run test:mcp     # in a second terminal
```

Both read `.env` and `.env.local` in `fitness-tracker/`. Add `FITTRACK_EMAIL`,
`FITTRACK_PASSWORD` and `MCP_ACCESS_KEY` to `.env` for a full local test.

## Rotating or revoking access

Change `MCP_ACCESS_KEY` in Vercel and redeploy. The old URL immediately stops working.
Update the connector URL in Claude afterwards.
