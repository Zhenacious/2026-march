# FitTrack — Food Portions Rework + NZ/AU Fast Food Library

**Date:** 2026-08-03
**Status:** Design agreed, ready for an implementation plan.

---

## 0. How to use this document

This is a self-contained brief. Hand it to a fresh Claude Code session and it has everything
it needs: what the app is, how it is built, what is wrong with the food feature today, and
exactly what to build instead.

Read sections 1–3 for context, section 4 for the problems, sections 5–8 for the design, and
section 9 for the order to build it in.

---

## 1. Project background

FitTrack is a personal fitness tracking web app. You log gym sessions (exercises, sets,
weights, reps) and food (meals, calories, macros), and the app stores everything so you can
look back at your history and progress.

**Owner:** a complete beginner to coding. Every change must be explained in plain English as
it happens — what is being done and why. Technical terms get a one-line definition.

**Working rules for whoever implements this:**

- After finishing any working feature or change, commit and push to `origin master`
  automatically. Do not ask first.
- Before a large or risky change, commit the current state first as a save point.
- Commit messages describe what changed and why.
- Never use emojis in the app UI — use `lucide-react` icons.
- Never write instructions like "paste this SQL into Supabase". Database changes go in
  `supabase/migrations/` and are applied with `npm run migrate`.

---

## 2. How the app is built

**Stack:** React 19 + Vite, Tailwind CSS v4, Supabase (auth + Postgres), Recharts, date-fns,
lucide-react, framer-motion, react-router-dom, html5-qrcode (barcode scanning).

**Deploy:** push to `master` on `https://github.com/Zhenacious/2026-march.git`. Vercel
auto-deploys. Serverless functions live in `fitness-tracker/api/`.

**Layout:**

```
fitness-tracker/
  src/
    pages/       Dashboard, WorkoutLog, Exercises, ExerciseHistory, CalendarView,
                 Progress, Import, Today, MyFoods, PersonalRecords, Trends,
                 BodyWeightTracker, Auth
    components/  AddFoodModal, FoodPanel, TodayFood, ExercisePicker, AlphaList,
                 BarcodeScanner, Layout, MuscleGroupPicker, TrackTypePicker,
                 ExerciseEditDialog
    lib/         food.js, foodEntries.js, starterFoods.js, categories.js,
                 seedLibrary.js, seedExercises.js, supabase.js, ...
    contexts/    AuthContext
  api/           food-search.js, food-lookup.js, _foodSources.js, categorize.js,
                 match-exercises.js
  supabase/migrations/   001…009 numbered .sql files
  scripts/       migrate.mjs, test-food-math.mjs, test-food-search.mjs,
                 test-food-lookup.mjs
```

**Database changes.** Add a new numbered file to `supabase/migrations/` and run
`npm run migrate`. Each file runs at most once ever — a `schema_migrations` table records
what has already been applied, so re-running is safe. `npm run migrate:status` shows what
would run without changing anything. Needs `DATABASE_URL` in `fitness-tracker/.env`.

**Tests.** Plain Node scripts, no test framework. `node scripts/test-food-math.mjs` checks
the food arithmetic and exits non-zero on failure. Follow that style: a `check()` helper,
printed PASS/FAIL lines, non-zero exit on any failure.

---

## 3. How food works today

**Tables**

`food_entries` — one row per food you logged.

| column | meaning |
|---|---|
| `date`, `meal_type`, `food_name`, `barcode` | what and when |
| `quantity_mode` | `'servings'` or `'grams'` — which maths path applies |
| `servings` | how many servings (servings mode) |
| `grams` | weight in grams (grams mode) |
| `input_unit`, `input_amount` | what was actually typed, e.g. `3.5` `oz` |
| `serving_size`, `serving_grams` | free text description + weight of one serving |
| `calories, protein_g, carbs_g, fat_g` | nutrition **per one serving** |
| `cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g` | nutrition per 100 g |

Nutrition is copied onto the entry at log time, so correcting a food later never rewrites
days you already logged. That property must be preserved.

`custom_foods` — your own food library. Same nutrition columns, plus `name`, `brand`,
`aliases` (comma-separated alternative names, including Chinese), `barcode`.

**Code**

- `src/lib/food.js` — `entryTotals()`, `dayTotals()`, `amountLabel()`, `recentFoods()`,
  `UNIT_TO_GRAMS`. The single source of truth for food arithmetic.
- `src/lib/foodEntries.js` — insert/update/delete, `toPanelFood()` (turns an API result or a
  library food into panel form values), `friendlyDbError()`.
- `src/components/TodayFood.jsx` — the Today tab's food section. Owns the entry list, the
  day totals, the goal, and the search state.
- `src/components/AddFoodModal.jsx` — tabbed modal (Search / My Foods / Previous / Recipes
  (disabled) / Create). Picking a row swaps the modal to the detail step.
- `src/components/FoodPanel.jsx` — the detail step: the add/edit surface for one entry.
- `src/pages/MyFoods.jsx` — manage the saved food library.
- `src/lib/starterFoods.js` — ~250 seed foods. Row shape today:
  `[name, brand, serving_size, serving_grams, kcal, protein, carbs, fat]` where the four
  nutrition numbers are **per 100 g** and per-serving values are derived at the bottom of
  the file.
- `api/_foodSources.js` — Open Food Facts, FatSecret and USDA adapters, all normalised to a
  common shape with `serving_size`, `serving_grams`, `per_100g` and per-serving values.

---

## 4. What is wrong

### 4.1 The bug: nutrition does not rescale (real, reproducible)

`FoodPanel.jsx:41-60`. The `per100` value is computed like this:

```js
if (initial.cal_per_100g != null) {
  return { /* the food's stored per-100g values, unchanged */ };
}
if (sg > 0) {
  /* derive per-100g from the typed serving weight */
}
```

Every food in the library has per-100g data, so the **first branch always wins**. That means
editing "One serving weighs (g)" changes nothing at all — the kcal/protein/carbs/fat boxes
stay frozen at whatever they were.

Reproduce: pick "Chicken breast, skinless, raw" (serving `1 breast (170 g)`, 280 kcal).
Change the serving weight to 100 g. It still says 280 kcal. It should say 165.

The two branches also disagree with each other: in the second branch, typing a serving
weight rescales the per-100g values but leaves the per-serving boxes alone — the opposite
direction. So the same input does two different things depending on the food.

### 4.2 The redundancy: two boxes for one idea

`FoodPanel.jsx:166` renders **"A serving is"** (free text, e.g. `2 biscuits`).
`FoodPanel.jsx:185` renders **"One serving weighs (g)"** (a number, e.g. `35`).

These are the label and the weight of the same thing. Worse, the seed data puts the weight
inside the label too — `'1 breast (170 g)'` with `serving_grams: 170` — so you type the
weight twice and neither copy drives the maths.

### 4.3 No portion concept

A food carries exactly **one** serving. For a lot of foods that one serving is literally
`'100 g'` (see `starterFoods.js`). There is no way to say "this food comes as 1 drumstick,
or 1 thigh, or 100 g" and pick between them. That is why logging a drumstick feels wrong —
the app has never been told a drumstick is a thing.

### 4.4 No fast food

Nothing for NZ/AU chains. The external search (Open Food Facts / FatSecret) covers packaged
groceries well but restaurant menus poorly and inconsistently.

---

## 5. Design: the portion model

### 5.1 The core idea

**Per-100g nutrition is the single source of truth.** Every calculation, everywhere, is:

```
totals = per100g × (quantity × portionGrams) / 100
```

A **portion** is a named amount with a weight:

```js
{ label: '1 drumstick', grams: 90 }
```

A food carries an ordered list of them. The first one is the default — the portion selected
when you add that food to the log. Displayed as `label (grams g)` — e.g. `1 drumstick (90 g)`
— composed at render time, so the weight is never typed twice. If the label is already a
pure weight (`100 g`, `250 ml`), show it as-is with no bracket.

An entry records which portion was used and how many:

```
portion_label = '1 drumstick'
portion_grams = 90
quantity      = 1.5
```

That is the whole model. `quantity_mode`, `servings`, `serving_size` and `serving_grams` all
collapse into it.

### 5.2 What the user sees

```
Amount
┌──────────┬──────────────────────────────┐
│   1.5    │ 1 drumstick (90 g)         ▾ │
└──────────┴──────────────────────────────┘
                    ├ 1 drumstick (90 g)
                    ├ 1 thigh (130 g)
                    ├ 100 g
                    └ Custom weight…

Nutrition per 1 drumstick (90 g)
kcal     Protein   Carbs    Fat
[161]    [22.3]    [0]      [7.4]
Per 100 g: 179 kcal · P 24.8 · C 0 · F 8.2

This entry
242 kcal
Protein 33 g · Carbs 0 g · Fat 11 g
```

**Nutrition boxes show the selected portion's values**, because that is how a food packet or
a menu board reads. But they are *derived*, not stored: what is held in state is the
per-100g figures at full precision. Typing in a box converts back
(`per100 = typed × 100 / portionGrams`). Changing the portion re-renders the boxes rescaled.
That is the direct fix for 4.1 — the numbers can no longer disagree with the weight, because
they are computed from it.

Rounding: display to 1 decimal place, store unrounded. Never round-trip through the display
value, so switching portions repeatedly cannot drift.

**"Custom weight…"** swaps the dropdown for a small number box plus `g` / `oz` / `ml` chips,
reusing the existing `UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1 }`. It creates an ad-hoc
portion — `3.5 oz` is `quantity: 3.5, portion_label: 'oz', portion_grams: 28.35` — so the
existing oz behaviour falls out of the same code path with no special case.

**"100 g"** is always offered, appended automatically if the food's own list doesn't already
contain a pure-weight portion. It is never the default unless it is the food's only portion.

### 5.3 Database changes

**`010_food_portions.sql`** — add the columns.

```sql
alter table custom_foods add column if not exists portions jsonb not null default '[]'::jsonb;
alter table custom_foods add column if not exists category text default '';

alter table food_entries add column if not exists portion_label text default '';
alter table food_entries add column if not exists portion_grams float;
alter table food_entries add column if not exists quantity float default 1;
```

**`011_backfill_portions.sql`** — convert existing data.

For `custom_foods`, three cases:

1. **Has `serving_grams`** → one portion. Label is `serving_size` with any trailing
   `(170 g)` / `(250 ml)` stripped, falling back to `'1 serving'` if that leaves nothing.
   ```sql
   update custom_foods set portions = jsonb_build_array(jsonb_build_object(
     'label', coalesce(nullif(btrim(regexp_replace(
       coalesce(serving_size,''), '\s*\(\s*[0-9.]+\s*(g|ml)\s*\)\s*$', '', 'i')), ''), '1 serving'),
     'grams', serving_grams))
   where serving_grams > 0 and portions = '[]'::jsonb;
   ```
2. **No `serving_grams` but has `cal_per_100g`** → the per-100g data is the reliable half.
   Give it `[{"label":"100 g","grams":100}]`.
3. **Neither** → the food only knows "one serving = these macros" and has no weight. Give it
   a synthetic portion `[{"label": serving_size or '1 serving', "grams": 100}]` and set the
   per-100g columns equal to the per-serving values. The arithmetic then produces exactly the
   same numbers as before. The portion is a unit, not a real weight, which is fine — the user
   can add a real weight later.

For `food_entries`, the same three shapes, plus grams-mode entries:

- `quantity_mode = 'grams'` → `portion_label = input_unit`, `portion_grams = UNIT_TO_GRAMS`
  for that unit, `quantity = input_amount`. Where `input_amount` is null, use
  `quantity = grams`, `portion_grams = 1`, `portion_label = 'g'`.
- `quantity_mode = 'servings'` → `quantity = servings`, and label/grams by the same three
  cases as above.

> **Hard requirement.** The backfill must not change the calorie or macro total of any day
> already logged. This is the highest-risk part of the work. It gets a dedicated test
> (section 8) that runs legacy entry shapes through both the old and new arithmetic and
> asserts identical totals. Write that test **before** the migration.

Old columns (`quantity_mode`, `servings`, `serving_size`, `serving_grams`, `input_unit`,
`input_amount`) are **left in place and no longer written to**. Dropping them is a separate
cleanup once the new model has been running for a while. Nothing reads them except the
legacy fallback in `entryTotals()`.

### 5.4 Code changes

**`src/lib/portions.js` (new)** — the portion vocabulary in one place:

- `portionLabel(portion)` → `'1 drumstick (90 g)'`, or `'100 g'` for pure-weight labels.
- `defaultPortion(food)` → first portion, or `{ label: '100 g', grams: 100 }`.
- `portionOptions(food)` → the food's portions plus `100 g` if absent.
- `parsePortions(value)` / `serializePortions(list)` → tolerate the jsonb arriving as a
  string, and drop malformed rows (missing label, `grams <= 0`).
- `scaleTo(per100, grams)` and `scaleFrom(values, grams)` → the two conversions, unrounded.

**`src/lib/food.js`** — `entryTotals()` becomes one path:

```js
export function entryTotals(entry) {
  const grams = (entry.quantity ?? 1) * (entry.portion_grams ?? 0);
  if (grams > 0 && entry.cal_per_100g != null) {
    const f = grams / 100;
    return { calories: (entry.cal_per_100g || 0) * f, /* …p, c, f… */ };
  }
  return legacyEntryTotals(entry);  // untouched old code, safety net only
}
```

`amountLabel()` → `'1.5 × 1 drumstick (90 g)'`, or `'150 g'` when the portion is a pure
weight and quantity is the amount.

**`src/components/PortionEditor.jsx` (new)** — manage a food's portion list. Rows of
label + grams, add, remove, and "make default" (moves a row to the top). Used in two places:
the food edit form in `MyFoods.jsx`, and the Create tab of the add-food modal. It edits a
food's definition; it is not part of logging one entry.

**`src/components/FoodPanel.jsx`** — replace the Amount section (`FoodPanel.jsx:140-193`)
with the quantity + portion picker described in 5.2. Delete the "A serving is" and "One
serving weighs (g)" inputs and the `servings` / `unit` / `amount` / `servingSize` /
`servingGrams` state behind them. State becomes: `quantity`, `selectedPortion`, `per100`
(the four unrounded numbers), `mealType`, `name`. Everything displayed is derived.

**`src/lib/foodEntries.js`** — `toPanelFood()` carries `portions` through, building a
one-portion list from `serving_size` / `serving_grams` when the source is an API result that
has no portions of its own.

**`src/components/TodayFood.jsx`** — `saveToLibrary()` and `createAndLog()` write `portions`
onto `custom_foods`.

**`src/pages/MyFoods.jsx`** — the food form swaps its serving-size/serving-grams pair for
`PortionEditor`, and nutrition is entered per 100 g there (a library food's definition is
naturally per-100g; per-portion editing belongs on the logging screen).

**`src/lib/starterFoods.js`** — row shape changes to:

```js
// [name, brand, portions, kcal, protein, carbs, fat]   ← nutrition per 100 g
['Chicken breast, skinless, raw', '', [['1 breast', 170], ['100 g', 100]], 165, 31, 0, 3.6],
['Egg, whole',                    '', [['1 large egg', 50]],               143, 12.6, 0.7, 9.5],
```

The per-serving derivation at the bottom of the file goes away — per-100g is the only
nutrition stored. Rows whose serving is currently `'100 g'` become `[['100 g', 100]]`.
Where a food obviously has more than one natural portion (egg: 1 egg / 100 g; rice: 1 cup /
100 g; chicken: breast / thigh / drumstick), add them. This is where "1 drumstick" gets to
exist.

**`api/_foodSources.js` (optional, stage 4)** — FatSecret returns a *list* of servings per
food and `fatSecretFood()` currently throws all but the first away (`_foodSources.js:160`).
Map them all into portions instead. That is a genuinely better search result for free.

---

## 6. Design: NZ/AU fast food library

### 6.1 Shape

```
src/lib/fastFoods/
  index.js            combines and exports FAST_FOODS + FAST_FOOD_CHAINS
  mcdonalds-nz.js
  subway-nz.js
  kfc-nz.js
  burgerking-nz.js
  dominos-nz.js
```

Each chain file exports an array of rows in the same shape as `starterFoods.js`, plus
`brand` set to the chain name and `category: 'Fast food'`. Each file opens with a comment
recording the source of the numbers and the date they were read:

```js
// McDonald's New Zealand — published nutrition information.
// Source: mcdonalds.co.nz nutrition tables, read 2026-08-03.
// Serving weights are the published item weights. Any weight marked ESTIMATE
// below was not published and is inferred from the closest comparable item.
```

### 6.2 Data rules

- **Per-100g is still the source of truth.** Chains publish per-item values, so per-100g is
  computed as `perItem × 100 / itemGrams` and written into the row. Every item therefore
  needs a published item weight.
- Where a weight is genuinely not published, use a clearly commented estimate. Never invent a
  weight silently.
- Portions are the real-world units, and the default is the natural one. **The weights in
  the examples below illustrate the shape only — they are not verified data. Every number
  that ships must come from the chain's published table.**
  - `[['1 Big Mac', 219]]`
  - `[['6 nuggets', 108], ['9 nuggets', 162], ['20 nuggets', 360]]`
  - `[['Small', 77], ['Medium', 110], ['Large', 150]]` for fries
  - `[['6 inch', 220], ['Footlong', 440]]` for subs
  - `[['1 slice', 95]]` for pizza
- Item naming: `Big Mac`, not `McDonald's Big Mac` — the chain lives in `brand`, and
  `toPanelFood()` already composes `Name (Brand)` for display.
- Aliases where useful: `Quarter Pounder` → `qp, quarter pounder with cheese`.

### 6.3 Loading

`MyFoods.jsx` already has a "load the starter foods" action. Add a **Fast food** section
listing each chain with its item count and an Add button, so you only load the chains you
actually eat at. Loading writes `custom_foods` rows with `category = 'Fast food'` and uses
the same duplicate-safe upsert the starter foods use.

Add a category filter to `MyFoods.jsx` and to the My Foods tab of the add-food modal, so
Fast food can be browsed or excluded.

### 6.4 Chains, in order

1. **McDonald's NZ** — Big Mac, Quarter Pounder, Cheeseburger, McChicken, Filet-O-Fish,
   McNuggets (6/9/20), fries (S/M/L), McFlurry, hash brown, sundae, common McCafé drinks.
2. **Subway NZ** — 6-inch and footlong for Chicken Teriyaki, Meatball Marinara, BLT,
   Veggie Delite, Italian B.M.T., Steak & Cheese, Chicken Fillet. Base sub as published
   (bread + filling, no extras); sauces and cheese as separate small items.
3. **KFC NZ** — Original Recipe pieces (individual: breast, wing, drumstick, thigh), Wicked
   Wings, popcorn chicken sizes, Zinger and Colonel burgers, chips, potato & gravy, coleslaw.
4. **Burger King NZ** — Whopper, Whopper with cheese, Cheeseburger, Double Cheeseburger,
   Chicken Royale, fries (S/M/L), onion rings.
5. **Domino's NZ** — per-slice values across the Value and Traditional ranges.

**After each chain, stop.** Print a summary — item count, a table of a few items with
kcal/protein/weight, and the source used — and wait for the owner to confirm before starting
the next chain. Each chain is its own commit.

---

## 7. What this does *not* change

- Nutrition is still snapshotted onto the entry at log time. Editing a food never rewrites
  history.
- Meal types, day totals, the goal bar, Trends, and the Dashboard food card all keep working
  off `entryTotals()` / `dayTotals()` and need no changes beyond the ones in `food.js`.
- Recipes stay out of scope. The tab stays disabled.
- The barcode scanner, external search, and the modal's tab structure are untouched.

---

## 8. Testing

Extend `scripts/test-food-math.mjs` (same style: `check()` helper, PASS/FAIL lines, non-zero
exit). New coverage:

1. **Portion arithmetic** — 1.5 × a 90 g portion of a 179 kcal/100 g food = 241.65 kcal.
2. **Custom weight** — 3.5 oz resolves to 99.225 g and matches the old oz result exactly.
3. **Migration invariance (the important one)** — build fixtures for every legacy entry
   shape (servings with weight, servings without weight, grams mode, grams mode with no
   per-100g basis), run each through the old arithmetic and through the backfilled-then-new
   arithmetic, and assert the totals are identical to within 0.01.
4. **Labels** — `amountLabel()` output for portion, multi-portion and pure-weight entries.

Add `scripts/test-food-data.mjs` — a data sanity check over `starterFoods` and every fast
food chain:

- every portion has a non-empty label and `grams > 0`;
- `cal_per_100g` between 0 and 900 (pure fat is 900, so anything above is a typo or
  kilojoules in the kcal field — `_foodSources.js` already uses this rule);
- calories implied by macros (`4×protein + 4×carbs + 9×fat`) within ±25% of the stated
  calories, which catches transcription errors in hand-entered menu data;
- no duplicate `name` + `brand` pairs.

Wire both into `package.json` as `npm run test:food`.

---

## 9. Build order

Each stage ends with a working app, a passing `npm run build`, and its own commit + push.

| # | Stage | Done when |
|---|---|---|
| 1 | `src/lib/portions.js` + the migration-invariance test, written against the *current* code | Tests pass describing the behaviour that must be preserved |
| 2 | Migrations `010` + `011`, and the new `entryTotals()` in `food.js` | `npm run migrate` clean; invariance test still passes; existing days show identical totals |
| 3 | `PortionEditor.jsx`, rebuilt `FoodPanel.jsx` amount section, `MyFoods.jsx` form, `toPanelFood()` / `saveToLibrary()` / `createAndLog()` | The two redundant boxes are gone; changing portion or quantity rescales the numbers live |
| 4 | `starterFoods.js` converted to the portion shape, with extra natural portions added | `test-food-data.mjs` passes; loading starter foods gives sensible defaults |
| 5 | *(optional)* FatSecret multi-serving → portions in `_foodSources.js` | Search results offer their real serving options |
| 6 | McDonald's NZ | **Pause for owner verification** |
| 7 | Subway NZ | **Pause for owner verification** |
| 8 | KFC NZ | **Pause for owner verification** |
| 9 | Burger King NZ | **Pause for owner verification** |
| 10 | Domino's NZ | **Pause for owner verification** |

Stages 1–5 are the bug fix and the model. Stages 6–10 are data, one chain at a time, each
one stopping for confirmation before the next begins.

---

## 10. Open risks

- **The backfill is the risky part.** It rewrites how every historical entry is interpreted.
  Mitigation: the invariance test in stage 1, written before any migration exists, plus a
  legacy fallback branch left in `entryTotals()` for any row the backfill could not convert.
- **Fast food numbers go stale.** Chains reformulate. Mitigation: each chain file records its
  source and the date read, so it is obvious when data is old, and every value is editable in
  My Foods afterwards.
- **Foods with no meaningful weight** (a sachet, an espresso shot) are handled by giving them
  a synthetic 100 g portion whose per-100g values equal the old per-serving values. The
  numbers are right; the "weight" is a unit rather than a real gram figure. Acceptable, and
  the owner can set a real weight whenever they like.
