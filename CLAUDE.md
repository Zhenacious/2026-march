# FitTrack — Claude Code Guidelines

## About the User

- **Complete beginner to coding** — no assumed knowledge.
- Always explain what you are doing and why as you go, in plain English.
- Avoid jargon without explanation. If a technical term is necessary, define it briefly.
- Keep explanations concise but clear — don't overwhelm, but don't skip the "why".

## Commit Reminders

- **After finishing a working feature**, suggest a git commit with a clear description.
- **Before making any large or risky change** (refactors, deleting files, restructuring), suggest committing the current state first as a save point.
- Keep commit messages descriptive: say what changed and why, not just "update files".

## Project Overview

A React + Supabase fitness tracker app located in `fitness-tracker/`.

**Tech stack:** React, Vite, Tailwind CSS, Supabase (auth + database), Recharts, date-fns, lucide-react.

**Deployed via:** GitHub push to `https://github.com/Zhenacious/2026-march.git` (auto-deploy on push to master).

## Pages

| Route | File | Purpose |
|---|---|---|
| `/dashboard` | `Dashboard.jsx` | Stats overview and quick links |
| `/workouts` | `WorkoutLog.jsx` | Log sets for any date |
| `/exercises` | `Exercises.jsx` | Exercise library with categories |
| `/exercises/:name` | `ExerciseHistory.jsx` | Per-exercise history + e1RM chart |
| `/calendar` | `CalendarView.jsx` | Monthly calendar of workout days |
| `/progress` | `Progress.jsx` | Progress charts per exercise |
| `/import` | `Import.jsx` | Import from FitNotes CSV |

## Database (Supabase)

- `workouts` — `id, user_id, date`
- `workout_sets` — `id, workout_id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_order, set_type`
- `exercises` — `id, user_id, name, category`
