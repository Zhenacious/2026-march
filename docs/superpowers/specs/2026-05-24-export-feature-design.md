# Export Feature Design

**Date:** 2026-05-24
**Status:** Approved

## Summary

Add a CSV export feature to the existing Import page, giving users a way to back up and take their workout data to other apps (e.g. FitNotes, Excel, Google Sheets).

## Goal

- User can download all their workout data as a CSV file
- The exported format matches the FitNotes CSV format so it is portable and can be re-imported into this app

## What Changes

### `fitness-tracker/src/pages/Import.jsx`
- Page heading changes from "Import FitNotes CSV" to "Import / Export"
- A new "Export Your Data" section is added below the import form
- Section contains a single "Download CSV" button
- Button label changes to "Exporting…" while the fetch is in progress
- On success: triggers a browser file download of `fittrack-export.csv`
- On error: shows an error banner in the same red style used by the import errors

### `fitness-tracker/src/components/Layout.jsx`
- Nav item label for `/import` changes from `"Import"` to `"Import / Export"`

## Export Logic (client-side only, no server)

1. Fetch all `workout_sets` rows for the logged-in user, joined with their parent `workouts` row (for `date`) via Supabase
2. Fetch all `exercises` for the user to get `category` per exercise name
3. Build a CSV string in memory with this header row and column order:
   ```
   Date,Exercise,Category,Weight (kg),Reps,Distance,Distance Unit,Time
   ```
   - `Date` → `workouts.date` (YYYY-MM-DD)
   - `Exercise` → `workout_sets.exercise_name`
   - `Category` → matched from exercises table by name; empty string if not found
   - `Weight (kg)` → `workout_sets.weight_kg` (0 if null)
   - `Reps` → `workout_sets.reps` (0 if null)
   - `Distance` → `workout_sets.distance` (0 if null)
   - `Distance Unit` → `workout_sets.distance_unit` (empty if null)
   - `Time` → `workout_sets.duration_seconds` (0 if null)
4. Rows are sorted by date ascending, then by `set_order` within each workout
5. Trigger browser download using a `Blob` + temporary `<a>` element with `download="fittrack-export.csv"`

## What Is Not In Scope

- Multiple export formats (only FitNotes CSV)
- Filtering by date range (full export only)
- Separate Export page (lives on Import page)
