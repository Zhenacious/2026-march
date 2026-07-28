# Food Integration Design — Tabbed Today, Calendar Toggle, Trends, Integrated Dashboard

Date: 2026-07-29
Status: approved by user (mockup Option B chosen in visual companion session)

## Context

Barcode food logging shipped as a standalone `/food` page buried in the More menu. The user
wants food fully integrated with the rest of the app instead: logging alongside the workout on
the Today page, food visibility in the Calendar, calorie/macro charts, and a single integrated
Dashboard. The user compared two mockups and chose the **tabbed** pattern (Option B) for
logging, calendar, and charts; the Dashboard is the one place both worlds merge.

## Decisions (from brainstorming)

- Food logging lives **inside the Today page** behind a **Workout | Food tab switcher** —
  not a separate page, not a side panel.
- Calendar gets a **Workout | Food view toggle**, each view with its own day markers and
  day-detail panel.
- New **Trends page** (More menu) with Workout | Food tabs for time-series charts.
- **Dashboard is integrated**: one "this week" overview combining workout + food.
- Extra food features: manual entry (no barcode), recent-foods quick-add strip, daily
  calorie + protein goal, visible error messages on failed saves.
- **Editable amounts (added mid-planning by user):** when adding OR editing an entry the
  amount can be entered as *servings* or as *grams*; the serving-size text is editable;
  the four macro numbers themselves can be overridden manually. Gram-based math needs
  per-100g values, so the lookup API returns them and entries store them.
- The standalone Food Log page is removed; `/food` redirects to `/today?tab=food`.

## Screens

### Today page (`Today.jsx`)
- Tab switcher (Workout | Food) under the date header; active tab kept in the URL
  (`/today?tab=food`) so back/refresh behave.
- Workout tab: existing content, unchanged.
- Food tab, top to bottom:
  1. **Goal card** — calories eaten / goal with progress bar, protein progress beneath;
     tapping opens inline editing of both targets (saved to `user_settings`).
  2. **Add Food** — camera scan button (existing `BarcodeScanner`), barcode input,
     **recent-foods chip strip** (last ~8 distinct foods by name, one tap re-adds with its
     last serving/meal defaults), and a "Can't scan it?" link opening the manual form
     (name, calories, protein, carbs, fat, serving text).
  3. **Meal cards** — Breakfast/Lunch/Dinner/Snack with entries, per-meal kcal, delete.
- Food UI is built as components (`TodayFood.jsx` + smaller pieces) dropped into Today —
  Today.jsx itself stays thin.

### Calendar (`CalendarView.jsx`)
- Workout | Food toggle above the grid.
- Workout view: unchanged (purple markers, existing sets panel).
- Food view: teal markers on days with food entries; day panel lists meals + daily kcal
  total and a "Go to Food Log" button → `/today?tab=food&date=...`.

### Trends page (new, `Trends.jsx`, route `/trends`, More menu item)
- Workout | Food tabs; range switcher 2 weeks / 1 month / 3 months.
- Food tab: calories-per-day bar chart with the goal drawn as a reference line;
  protein-per-day bar chart.
- Workout tab: training volume per day bar chart; sets per week.
- Recharts, matching existing chart styling. Per-exercise charts remain on
  ExerciseHistory.

### Dashboard (`Dashboard.jsx`)
- Replaced by a "this week" overview: workout streak, workouts this week, average daily
  calories vs goal, 7-day activity strip (per-day dot: trained / ate-logged / both), and
  shortcuts to both Today tabs.

## Data

- `food_entries` — exists (migration_food_log.sql). Recents, calendar, trends, dashboard
  all derive from it. No favorites table (YAGNI — recents are a query).
- **Altered** `food_entries` (new migration): add `quantity_mode text default 'servings'`
  (`'servings'` | `'grams'`), `grams float`, `serving_grams float` (weight of one serving
  when known), and per-100g basis columns `cal_per_100g`, `protein_per_100g`,
  `carbs_per_100g`, `fat_per_100g` (all nullable floats). Totals rule: grams mode with
  per-100g data → `per100g × grams/100`; otherwise → `per-serving × servings`.
- `/api/food-lookup` response gains `serving_grams` (from OFF `serving_quantity` / USDA
  `servingSize`) and `per_100g: {calories, protein_g, carbs_g, fat_g}` when the source
  provides them (null otherwise).
- **New** `user_settings`: `user_id` (pk, references auth.users), `goal_calories int`,
  `goal_protein_g int`, `updated_at`. RLS `auth.uid() = user_id`. Upsert on save.
- Entry editing: pencil on each logged entry opens the same form used for adding —
  meal, amount (mode + value), serving-size text, and direct macro overrides.
- No changes to workout tables.

## Error handling

- All food saves/deletes surface failures in the UI (the current code swallows insert
  errors silently — fix as part of the Today food work).
- Missing `user_settings` row = no goal set; goal card shows "Set a goal" state instead
  of progress.

## Removal / redirects

- Delete `src/pages/FoodLog.jsx`; remove its route and More-menu item.
- `/food` → redirect to `/today?tab=food` (pattern exists: `WorkoutsRedirect` in App.jsx).
- `BarcodeScanner.jsx` is reused as-is.

## Testing / verification

- Build passes; manual flows: log food via scan, manual form, and recent-chip on the Food
  tab; goal edit persists across refresh and devices; calendar toggle shows correct
  markers/panels; trends charts match logged data; dashboard numbers reconcile with
  Today's totals; `/food` redirect works; workout tab regression check (log a set).
- Scanner re-test on phone via deployed HTTPS URL.
