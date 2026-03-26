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

---

## Current Status

### What this app is

FitTrack is a personal fitness tracking web app. You log your gym sessions — exercises, sets, weights, reps — and the app stores everything so you can look back at your history, see your progress on any exercise over time, and browse your workout calendar. It requires a login so your data is private to you.

---

### What has been built and how it works

**Login / Signup (`Auth.jsx` + `AuthContext.jsx`)**
Users sign in with email and password. The login system is handled by Supabase (a hosted database service). Once logged in, the app remembers you so you don't have to log in again on refresh.

**Dashboard (`Dashboard.jsx`)**
The home screen. Shows four quick stats: total workouts logged, total sets logged, your most frequently logged exercise, and the date of your last workout. Has large shortcut buttons to jump to "Log Today's Workout" and "View Calendar", plus smaller buttons for Progress, Exercises, Workouts, and Import.

**Workout Log (`WorkoutLog.jsx`)**
The core feature of the app. You pick a date, then log sets one by one. For each set you can enter:
- Exercise name (searches your library as you type, or use the Browse modal)
- Weight, reps, distance, duration
- Set type: Normal, Drop set, or Super set

Once sets are logged for the day, you can:
- Click the pencil icon to edit any set via a popup modal
- Delete sets
- Reorder sets with up/down arrows
- View them either in the order they were logged, or grouped by exercise
- Filter by muscle group (tabs across the top)

There's also a "recently used today" strip of buttons — clicking one pre-fills the exercise name and last-used weight/reps for that exercise.

**Exercise Library (`Exercises.jsx`)**
A list of all your saved exercises. You can:
- Search by name
- Filter by muscle group
- Add new exercises with a name and category
- Edit or delete exercises
- Click any exercise to go to its full history page
- Use "Auto-categorize" which sends uncategorized exercises to an AI endpoint (`/api/categorize`) to guess the muscle group — **note: this endpoint may not be working in production, see below**

**Exercise History (`ExerciseHistory.jsx`)**
A dedicated page for each exercise (e.g. "Bench Press"). Shows:
- A line chart of your estimated 1-rep max (e1RM) over time — this is a formula (Epley: weight × (1 + reps/30)) that estimates how strong you are even if you didn't literally do 1 rep
- A full session-by-session history with all sets listed
- Hover over any set to reveal edit (pencil) and delete (trash) icons — editing opens an inline form right on the history page

**Calendar (`CalendarView.jsx`)**
A monthly calendar view. Days where you logged a workout are highlighted in purple. Click any day to see a sidebar panel listing every set you did that day, grouped by exercise. There's a "Go to Workout" button that takes you to the Workout Log for that date.

**Progress (`Progress.jsx`)**
Charts for tracking improvement on a specific exercise over time. You pick an exercise from a dropdown (filtered by muscle group), choose a time range (All Time / 1 Year / 1 Month), and see:
- A line chart of estimated 1RM over time
- A bar chart of total training volume (sets × reps × weight) per session
You can also star an exercise to make it the default that loads when you open this page.

**Import (`Import.jsx`)**
Lets you upload a CSV file exported from the FitNotes app and import all your historical workout data in one go. It shows a preview of the first 10 rows before importing, and shows a progress bar during the upload.

**Shared components:**
- `ExercisePicker` — a reusable search-and-filter popup used in the Workout Log's "Browse" button
- `Layout` — the sidebar navigation (desktop) and hamburger menu (mobile) that wrap every page

---

### What looks unfinished or broken

1. **AI Auto-categorize (`/api/categorize`) probably doesn't work in production.**
   The Exercises page has a button that calls `/api/categorize` to auto-assign muscle groups to exercises using AI. However, there is no API route file anywhere in this project. It was likely set up as a separate serverless function at some point but it's not in this codebase. The button will show an error if clicked.

2. **`CATEGORY_COLORS` is copy-pasted across 5 files.**
   The same colour-coding object (chest = rose, back = blue, etc.) is defined separately in `WorkoutLog.jsx`, `ExerciseHistory.jsx`, `Exercises.jsx`, `Progress.jsx`, and `ExercisePicker.jsx`. This isn't broken, but it means if you ever want to add a new muscle group or change a colour, you'd have to change it in 5 places. It should live in one shared file.

3. **Dashboard is basic.**
   The stats are just four numbers. There's no streak counter, no visual of recent activity, no week-at-a-glance summary.

4. **Calendar is read-only.**
   You can see what you did on a given day from the calendar, but you can't edit or delete sets from there — you have to click "Go to Workout" to make changes.

5. **No Personal Records page.**
   There's no page showing your all-time bests per exercise (heaviest weight ever lifted, most reps, best estimated 1RM). This was started in a previous session but not finished.

---

### Obvious next steps

In rough order of usefulness:

1. **Fix or re-implement the AI auto-categorize endpoint** — or remove the button if it's not needed, to avoid confusion.
2. **Personal Records page** — a clean list of all-time bests per exercise, sortable and filterable by muscle group. Low effort, high value.
3. **Dashboard improvements** — add a workout streak counter and a simple 7-day activity summary.
4. **Extract shared colour/category config** — move `CATEGORY_COLORS` and `MUSCLE_GROUPS` into a single shared file (`src/lib/categories.js`) so it only needs to be edited in one place.
5. **Workout Templates** — save a named list of exercises (e.g. "Push Day") and load it into the Workout Log so you're prompted through your planned exercises.
6. **Notes field on workouts** — a free-text note per session ("felt strong today", "left shoulder tight") stored against the workout date.
