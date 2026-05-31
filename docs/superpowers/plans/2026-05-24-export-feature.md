# Export Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download CSV" button to the Import page so users can export all their workout data in FitNotes-compatible CSV format.

**Architecture:** The export is entirely client-side — fetch workouts, sets, and exercises from Supabase, build a CSV string in memory, then trigger a browser file download. No server changes needed. Two files change: `Import.jsx` gets a new export section, and `Layout.jsx` gets an updated nav label.

**Tech Stack:** React, Supabase JS client, browser Blob/URL APIs, Tailwind CSS, lucide-react icons.

---

## File Map

| File | Change |
|------|--------|
| `fitness-tracker/src/pages/Import.jsx` | Add `exporting`/`exportError` state, `handleExport` function, and export UI section |
| `fitness-tracker/src/components/Layout.jsx` | Change nav label from `'Import'` to `'Import / Export'` |

---

## Task 1: Update nav label in Layout.jsx

**Files:**
- Modify: `fitness-tracker/src/components/Layout.jsx`

- [ ] **Step 1: Open Layout.jsx and find the moreNavItems array**

  In `fitness-tracker/src/components/Layout.jsx`, find this line (around line 28):
  ```jsx
  { to: '/import',      label: 'Import',           icon: Upload },
  ```

- [ ] **Step 2: Change the label**

  Replace it with:
  ```jsx
  { to: '/import',      label: 'Import / Export',  icon: Upload },
  ```

- [ ] **Step 3: Verify manually**

  Open the app in the browser, tap "More" in the bottom bar. The nav item should now read "Import / Export".

- [ ] **Step 4: Commit**

  ```bash
  git add fitness-tracker/src/components/Layout.jsx
  git commit -m "Rename Import nav item to Import / Export"
  ```

---

## Task 2: Add export state and logic to Import.jsx

**Files:**
- Modify: `fitness-tracker/src/pages/Import.jsx`

- [ ] **Step 1: Add two new state variables**

  In `Import.jsx`, find the existing state declarations at the top of the component (around lines 10–15):
  ```jsx
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  ```

  Add two new lines directly after:
  ```jsx
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  ```

- [ ] **Step 2: Add the handleExport function**

  After the `handleImport` function (before the `const preview = ...` line), add this new function:

  ```jsx
  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const { data: workouts, error: wErr } = await supabase
        .from('workouts')
        .select('id, date')
        .eq('user_id', user.id);
      if (wErr) throw new Error('Failed to fetch workouts: ' + wErr.message);

      const workoutIds = (workouts || []).map((w) => w.id);
      if (workoutIds.length === 0) {
        const csv = 'Date,Exercise,Category,Weight (kg),Reps,Distance,Distance Unit,Time\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fittrack-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const { data: sets, error: sErr } = await supabase
        .from('workout_sets')
        .select('workout_id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_order')
        .in('workout_id', workoutIds);
      if (sErr) throw new Error('Failed to fetch sets: ' + sErr.message);

      const { data: exercises, error: eErr } = await supabase
        .from('exercises')
        .select('name, category')
        .eq('user_id', user.id);
      if (eErr) throw new Error('Failed to fetch exercises: ' + eErr.message);

      const workoutDateMap = {};
      (workouts || []).forEach((w) => { workoutDateMap[w.id] = w.date; });

      const categoryMap = {};
      (exercises || []).forEach((e) => { categoryMap[e.name] = e.category || ''; });

      const sorted = [...(sets || [])].sort((a, b) => {
        const dateA = workoutDateMap[a.workout_id] || '';
        const dateB = workoutDateMap[b.workout_id] || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.set_order || 0) - (b.set_order || 0);
      });

      const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

      const header = 'Date,Exercise,Category,Weight (kg),Reps,Distance,Distance Unit,Time';
      const rows = sorted.map((s) =>
        [
          workoutDateMap[s.workout_id] || '',
          escape(s.exercise_name),
          escape(categoryMap[s.exercise_name] ?? ''),
          s.weight_kg ?? 0,
          s.reps ?? 0,
          s.distance ?? 0,
          s.distance_unit || '',
          s.duration_seconds ?? 0,
        ].join(',')
      );

      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fittrack-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add fitness-tracker/src/pages/Import.jsx
  git commit -m "Add handleExport function to Import page"
  ```

---

## Task 3: Add export UI section to Import.jsx

**Files:**
- Modify: `fitness-tracker/src/pages/Import.jsx`

- [ ] **Step 1: Add the Download icon to the imports**

  At the top of `Import.jsx`, find the lucide-react import line:
  ```jsx
  import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
  ```

  Add `Download` to the list:
  ```jsx
  import { Upload, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
  ```

- [ ] **Step 2: Add the export section to the JSX**

  Find the closing `</div>` of the entire page (the last line before the closing `}` of the return, around line 239). Just before the final closing `</div>` of the outer wrapper, add this new section:

  ```jsx
      <hr className="border-zinc-800 my-2" />

      <h2 className="text-xl font-bold text-zinc-100 mb-1 mt-6">Export Your Data</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Download all your workout data as a CSV file. Works with FitNotes and spreadsheet apps.
      </p>

      {exportError && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        {exporting ? 'Exporting…' : 'Download CSV'}
      </button>
  ```

- [ ] **Step 3: Verify manually**

  - Open the app and navigate to Import / Export via the More menu
  - Scroll to the bottom — the "Export Your Data" section should be visible
  - Click "Download CSV" — the button should show "Exporting…" briefly, then a file called `fittrack-export.csv` should download
  - Open the file in a spreadsheet or text editor — confirm the header row reads `Date,Exercise,Category,Weight (kg),Reps,Distance,Distance Unit,Time` and your workout data appears below it

- [ ] **Step 4: Commit and push**

  ```bash
  git add fitness-tracker/src/pages/Import.jsx
  git commit -m "Add Export Your Data section to Import / Export page"
  git push origin master
  ```
