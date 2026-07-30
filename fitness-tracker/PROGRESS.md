# FitTrack — Progress Log

> This file is the project's memory. Read it at the START of a session to get oriented,
> and update it at the END of a session so next time picks up where this one left off.
> Keep it short. If a section gets long, trim the oldest stuff.

_Last updated: 2026-07-30_

## What this app is
A personal React + Supabase fitness tracker. Log gym sessions (exercises, sets,
weights, reps) AND food/calories, then review history, charts, calendar and records.
Live at https://dolphfittrack.vercel.app — auto-deploys on push to `master`.

## FIRST THING NEXT SESSION
Run this one line in the Supabase SQL editor if it hasn't been run yet — the
alias/multi-name search shipped without it:

```sql
alter table custom_foods add column if not exists aliases text default '';
```

Then, if starter foods were already loaded, delete them and reload from My Foods
so they pick up their Chinese names (rows saved before the column existed have none).

## Done (working)

### Workout side
- Today tab — log/edit/reorder sets for any date, search exercise library, quick-create.
- Exercise library — add/edit/delete, filter by muscle group, AI auto-categorize
  (`api/categorize.js`, working — uses the Anthropic SDK).
- Exercise History — e1RM chart + session-by-session history with inline edit.
- Calendar, Personal Records, Body Weight tracker, FitNotes CSV import.
- Shared config in `src/lib/categories.js` (colours + muscle groups).

### Food side (built 2026-07-29/30 — the big piece of recent work)
- **Lives on the Today page** behind a `Workout | Food` tab switcher (`/today?tab=food`).
  There is no separate food page; `/food` redirects here.
- **Add Food modal** (`AddFoodModal.jsx`) — the single place food is added. Centred
  with dimmed backdrop on desktop, full screen on phone. Tabs: Search / My Foods /
  Previous / Recipes (disabled, "coming later") / Create. Last tab remembered per
  session. Picking a row *swaps the modal body* to the detail step (no stacked layers);
  tapping a logged entry opens that same step pre-filled.
- **Detail step** (`FoodPanel.jsx`) — meal selector defaulting to time of day, amount
  in servings/g/oz/ml, editable macros, live calorie+macro total. Serving weight is
  editable here: entering "one serving weighs 35 g" derives per-100g values and
  unlocks logging by weight for foods that arrive without it.
- **Search** — one box takes a name or a barcode. Names hit your own `custom_foods`
  first, then Open Food Facts + FatSecret in parallel.
- **My Foods** (`/foods`) — your own library: add/edit/delete/search, A–Z jump index,
  "Load starter foods" button (275 curated foods, skips ones you have).
- **Multi-name search** — `aliases` column, comma-separated. 81 starter foods carry
  Chinese names + pinyin (老干妈/laoganma, 饺子/jiaozi, 鸡蛋), ~20 carry regional
  English ("bell pepper" → capsicum, "ground beef" → beef mince). Editable per food.
- **A–Z index** (`AlphaList.jsx`) — shared by My Foods and the modal. Empty letters
  greyed not hidden (fixed positions = muscle memory). Non-Latin names group under #.
- **Trends** (`/trends`) — calories/protein per day, volume/sets charts, 2wk/1mo/3mo.
- Calendar has a `Workout | Food` view toggle; Dashboard shows avg calories and a
  two-signal 7-day strip (bar = trained, dot = food logged).
- Goals: daily calorie + protein target in `user_settings`, progress bar on Today.

### Infrastructure / gotchas worth remembering
- **PWA staleness was a real bug** — the installed app served an old build for days.
  `main.jsx` now registers the service worker explicitly and checks for updates on
  launch, on regaining foreground, and hourly. Don't remove that.
- **Open Food Facts quirks**, all handled in `api/_foodSources.js`:
  legacy `cgi/search.pl` 503s (dead); the current search service returns no nutrition,
  so search gets barcodes from `search.openfoodfacts.org` then fetches each product;
  search is rate-limited ~10/min (this is *why* the personal library matters);
  records with no energy value are rejected (a Tim Tam barcode returned 0 kcal);
  records over 900 kcal/100g rejected (physically impossible); records whose serving
  is the whole 900 g package fall back to per-100g.
- **Tests**: `node scripts/test-food-math.mjs` (13 assertions on totals maths),
  `test-food-lookup.mjs` and `test-food-search.mjs` (live APIs). Run from
  `fitness-tracker/`. These are the project's only automated tests.
- Secrets: `Fat Secret.txt` in the repo root holds live API credentials in plaintext.
  It IS gitignored now and was never committed — keep it that way.

## Database
`workouts`, `workout_sets`, `exercises` (workout side) plus `food_entries`,
`custom_foods`, `user_settings` (food side). All SQL lives in
`supabase/RUN_ME_food_setup.sql` — one idempotent file, safe to re-run.
Nutrition is **snapshotted onto each log entry**, so editing a food never rewrites
past days. That was a deliberate choice (confirmed with the user), not an accident.

## Known issues / rough edges
- **Camera barcode scanning has never been tested on a real phone** — needs the
  deployed HTTPS URL. Highest-risk untested thing.
- Nobody has clicked through the Add Food modal end to end; it was built and shipped
  without a browser session available.
- `USDA_API_KEY` and `FATSECRET_CLIENT_ID`/`SECRET` are still NOT set in Vercel, so
  lookups use Open Food Facts only. Credentials for FatSecret are in `Fat Secret.txt`.
  FatSecret may need IP allowlisting, awkward on serverless — verify before relying.
- Chinese *barcode* coverage is thin in every free database; the seeded library and
  alias search are the practical answer.
- Fiber / sugar / sodium are not captured anywhere — the add-food prompt asked for
  them but it needs a schema change plus extra API fields.
- `src/pages/Progress.jsx` is orphaned — no route renders it. Safe to delete.
- No tests at all on the workout side.
- `CLAUDE.md` in the parent folder is out of date (calls AI categorize broken, lists
  a Progress page, and describes the app as workout-only with no mention of food).

## Next ideas (rough priority order)
1. Test the camera scanner on a phone; test the Add Food modal end to end.
2. Refresh `CLAUDE.md` — it predates the entire food feature.
3. **Saved meal combinations** ("my usual breakfast" = several foods logged in one
   tap). User explicitly chose "both, starting with foods" — individual foods shipped,
   combinations are the outstanding half. Needs its own table + a save-this-meal flow.
4. Fiber/sugar/sodium capture and display.
5. Set the FatSecret + USDA keys in Vercel for better AU/NZ coverage.
6. Workout templates loadable into the Today tab; free-text notes per workout day.

## Notes for next session
- Conventions: no emojis in UI (lucide-react icons only); explain changes in plain
  English — the user is a beginner coder.
- Commit + push to `origin master` after each working change, without being asked.
- The user sometimes pastes prompt templates that call this a "Python/Flask" app.
  It isn't — extract the intent, keep the React/Supabase stack.
- Design docs from this work: `docs/superpowers/specs/2026-07-29-food-integration-design.md`
  and `docs/superpowers/plans/2026-07-29-food-integration.md`.
