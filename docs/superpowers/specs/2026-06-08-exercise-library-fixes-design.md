# Exercise Library: Bug Fixes + Add/Edit Redesign

## Background

A new user reported four problems on the live site:

1. No starter exercises appear when they sign up.
2. Adding a new exercise fails with an error.
3. Editing an exercise is "impossible."
4. Two separate "Abs" groups appear on the Exercises page (one with just 2 exercises).

Investigation traced #1–#3 to a single root cause, and #4 to a separate data issue. Along the way we also found a real UX gap: creating a new exercise from the Today (workout log) tab never lets you pick a muscle group.

## Part 1 — Fix: missing `track_type` database column

**Root cause:** A past update (commit `2b586de`, "Add exercise measurement types") added a `track_type` column to the `exercises` table in the app's code, with a matching SQL migration file (`supabase/migration_track_type.sql`). That migration was written to be run manually via the Supabase SQL Editor, but it was never actually run against the live database. So the live `exercises` table has no `track_type` column.

Every code path that writes to `exercises` includes `track_type`:
- Auto-seeding a new account's starter library (`maybeSeedExercises`) — fails silently (logged to console only), leaving new accounts with zero exercises.
- The "Add starter exercises" button — fails and surfaces the error: *"Could not find the 'track_type' column of 'exercises' in the schema cache."*
- Adding a new exercise via the Exercises page form — same error.
- Editing an exercise — same error.

**Fix:** Run the existing migration against the live database:

```sql
alter table exercises
  add column if not exists track_type text not null default 'weight_reps';
```

This is additive and safe to run on a live database (existing rows get the default value `'weight_reps'`). No application code changes are required — the bug is purely that the live schema is behind the code.

Since this changes the live production database and requires Supabase dashboard access/credentials that aren't available in this environment, **the user will run this step themselves** via the Supabase SQL Editor, following exact copy-paste instructions provided in the implementation plan. Everything else in this spec is implemented in code.

## Part 2 — Fix: duplicate "Abs" / mismatched-category groups

**Root cause:** The Exercises page groups exercises by the raw `category` string stored on each row (e.g. `"abs"`). Two things can produce a value that doesn't exactly match the canonical lowercase categories in `CATEGORY_OPTIONS` (`chest`, `back`, `abs`, etc.):

- **CSV import** (`Import.jsx`) saves whatever category string comes from the FitNotes export verbatim (e.g. `"Abs"` with a capital letter, or a different label entirely), without matching it against the app's canonical category list.
- **Manual typos/edits** prior to the chip-based picker existing.

Because grouping compares raw strings, `"abs"` and `"Abs"` form two separate groups, both rendered with the "Abs" colour swatch logic only matching the lowercase one.

**Fix (code):**
1. In `Exercises.jsx` (and anywhere else that groups/matches by category — `ExercisePicker.jsx`, `Today.jsx`), normalize the category to lowercase and match it against `CATEGORY_OPTIONS` before grouping. Any value that doesn't match a known category is treated as uncategorized — consistent with how the muscle-group filter tabs already work — rather than creating a new ad-hoc group.
2. In `Import.jsx`, normalize imported category strings against `CATEGORY_OPTIONS` (case-insensitive match) at import time, falling back to uncategorized (`''`) for anything that doesn't match. This prevents future imports from creating new mismatched categories.

**Fix (existing data):** Once Part 1 is fixed, editing exercises will work normally. The two stray "Abs" exercises can simply be re-saved with the correct category through the normal edit UI (pick "Abs" from the chips) — no direct database surgery needed. The plan will include a step to point this out so the user can do it for the affected account(s).

## Part 3 — Redesign: adding & editing exercises (Option B)

### 3a. Shared pickers

Extract two small reusable components from the duplicated chip-row code that currently exists in three places (`Exercises.jsx` add form, `Exercises.jsx` inline edit form, `Today.jsx` quick-create popup):

- `MuscleGroupPicker` — renders the row of coloured muscle-group chips (None + each `CATEGORY_OPTIONS` entry with its `CATEGORY_COLORS` styling), taking the current value and an `onChange`.
- `TrackTypePicker` — renders the row of track-type chips (`TRACK_TYPES`), same pattern.

Both live in `src/components/`. They contain only the chip row markup/behaviour — the surrounding form (name field, buttons, layout) stays specific to each context.

### 3b. Today tab: muscle-group picker added to "create new exercise"

In the Today-tab exercise search popup, when you type a name that doesn't exist and choose "Create '<name>'", the popup currently shows only a `TrackTypePicker` row. Add a `MuscleGroupPicker` row alongside it (labelled "Muscle group", defaulting to "None"), and pass the chosen category through to the insert (`category: ''` becomes `category: chosenCategory`). This means an exercise created mid-workout is fully set up — name, muscle group, and track type — in one step, with no follow-up trip to the Exercises page required.

### 3c. Today tab: inline edit shortcut in the exercise search list

Add a small pencil/edit icon button next to each exercise in the Today-tab search/picker list (`AddExerciseSheet` — the component starting around `Today.jsx:423`). Tapping it opens the same edit dialog described in 3d, pre-filled for that exercise, without closing the search sheet or losing the user's place in their workout. This directly addresses "editing should be reachable from more places" — you can fix a miscategorized exercise the moment you notice it.

### 3d. A proper "Edit Exercise" dialog (replacing the cramped inline edit)

Currently, clicking the pencil icon on the Exercises page expands the list row in place to show a name field, 9 muscle-group chips, 3 track-type chips, and Save/Cancel — all squeezed into the row's width, which is awkward on mobile.

Replace this with a centred modal dialog component, `ExerciseEditDialog`, containing:
- Exercise name text field
- `MuscleGroupPicker`
- `TrackTypePicker`
- Save / Cancel buttons

This dialog is opened from:
- The pencil icon on the Exercises page list (replacing the current inline-expand behaviour)
- The new pencil shortcut in the Today-tab search list (3c)

Both call sites pass the exercise being edited and a save handler; the dialog itself doesn't know or care which page opened it.

### 3e. Exercises page "Add Exercise" form

Keep its current position and overall look (name field + category chips + track-type chips, all visible inline — it already works well there since there's room). Internally, swap its hand-rolled chip rows for `MuscleGroupPicker` and `TrackTypePicker` so all three creation/edit surfaces share identical behaviour and styling, and any future change to available categories or track types only needs to be made in one place.

## Testing / Verification

- Manual verification in the browser (per project convention) covering:
  - Creating an exercise from the Today tab with a chosen muscle group + track type, confirming it saves correctly and appears with the right colour/group on the Exercises page.
  - Editing an exercise via the new dialog from both the Exercises page and the Today-tab shortcut.
  - Confirming the "Abs" groups merge into one once the category fix lands and the stray exercises are re-saved.
  - Confirming the "Add starter exercises" button and a fresh sign-up both populate the library once the database column exists (this part depends on the user running the SQL migration first).
- No automated test suite exists for this app; verification is manual in the running dev server, per existing project practice.
