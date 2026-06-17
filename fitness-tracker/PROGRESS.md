# FitTrack — Progress Log

> This file is the project's memory. Read it at the START of a session to get oriented,
> and update it at the END of a session so next time picks up where this one left off.
> Keep it short. If a section gets long, trim the oldest stuff.

_Last updated: 2026-06-17_

## What this app is
A personal React + Supabase fitness tracker. Log gym sessions (exercises, sets,
weights, reps), then review history, progress charts, calendar, and personal records.
Deployed by pushing to GitHub (auto-deploy on push to `master`).

## Done (working)
- Today tab — log/edit/reorder sets for any date, search exercise library, quick-create.
- Exercise library — add/edit/delete, filter by muscle group, AI auto-categorize
  (`api/categorize.js`, now working — uses the Anthropic SDK).
- Exercise History — e1RM chart + session-by-session history with inline edit.
- Calendar, Personal Records, Body Weight tracker, Dashboard, FitNotes CSV import.
- Shared config extracted to `src/lib/categories.js` (colours + muscle groups).

## In progress
- (nothing active right now)

## Known issues / rough edges
- No automated tests anywhere yet — changes are only verified by hand.
- `CLAUDE.md` in the parent folder is partly out of date (e.g. it still calls the
  AI categorize button broken, and lists a Progress page that was merged into Exercises).

## Next ideas (rough priority order)
1. Add a first automated test (even one) to create a real "finish line" for changes.
2. Refresh `CLAUDE.md` so it matches what the app actually does now.
3. Workout templates ("Push Day" etc.) loadable into the Today tab.
4. Free-text notes field per workout day.

## Notes for next session
- Conventions: no emojis in UI (use lucide-react icons); explain changes in plain English.
- Commit + push to `origin master` after each working change.
