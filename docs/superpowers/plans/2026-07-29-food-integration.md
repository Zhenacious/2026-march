# Integrated Food Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate food logging into the app core: tabbed Today page (Workout | Food), calendar workout/food toggle, Trends charts page, integrated Dashboard, editable amounts (servings/grams), calorie+protein goals.

**Architecture:** Food UI lives in new components (`TodayFood.jsx`, `FoodEntryForm.jsx`) mounted behind a tab switcher in `Today.jsx`, all reading/writing the existing `food_entries` Supabase table (extended with gram/per-100g columns) plus a new `user_settings` table for goals. Pure calculation helpers live in `src/lib/food.js` so Trends/Calendar/Dashboard reuse identical math.

**Tech Stack:** React 19, Vite, Tailwind 4, Supabase JS, Recharts, date-fns, lucide-react, html5-qrcode (existing `BarcodeScanner.jsx`), Vercel serverless (`api/`).

## Global Constraints

- NO emojis anywhere in UI — lucide-react icons only.
- Dark zinc-950/900 cards, teal-600 accents; copy styling from existing pages verbatim.
- Commit + push to `origin master` after every completed task (auto-deploys).
- No test framework exists; verification = `npm run build` from `fitness-tracker/` + the node API script (Task 2) + manual flows. Run builds from `fitness-tracker/`, git from repo root `J:/Claude/CLaudeCursor`.
- Supabase migrations are files committed to `fitness-tracker/supabase/` that the USER runs in the Supabase SQL editor — flag loudly in the final report which migrations must be run.
- Date strings are always `format(date, 'yyyy-MM-dd')`.

---

### Task 1: Migration — extend food_entries, add user_settings

**Files:**
- Create: `fitness-tracker/supabase/migration_food_v2.sql`

**Interfaces:**
- Produces: columns `quantity_mode text`, `grams float`, `serving_grams float`, `cal_per_100g float`, `protein_per_100g float`, `carbs_per_100g float`, `fat_per_100g float` on `food_entries`; table `user_settings(user_id uuid pk, goal_calories int, goal_protein_g int, updated_at timestamptz)`.

- [ ] **Step 1: Write the migration file**

```sql
-- v2: editable amounts (servings vs grams) + per-100g basis, and user goal settings

alter table food_entries add column if not exists quantity_mode text not null default 'servings'
  check (quantity_mode in ('servings','grams'));
alter table food_entries add column if not exists grams float;
alter table food_entries add column if not exists serving_grams float;
alter table food_entries add column if not exists cal_per_100g float;
alter table food_entries add column if not exists protein_per_100g float;
alter table food_entries add column if not exists carbs_per_100g float;
alter table food_entries add column if not exists fat_per_100g float;

create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  goal_calories integer,
  goal_protein_g integer,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "Users manage own settings" on user_settings for all using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit and push**

```bash
git add fitness-tracker/supabase/migration_food_v2.sql
git commit -m "Add food v2 migration: gram/per-100g columns and user_settings goals table"
git push origin master
```

- [ ] **Step 3: Tell the user (in the task report) to run this file in the Supabase SQL editor before testing later tasks.** Earlier `migration_food_log.sql` must also have been run.

---

### Task 2: Extend /api/food-lookup with per-100g data and serving grams

**Files:**
- Modify: `fitness-tracker/api/food-lookup.js`
- Create: `fitness-tracker/scripts/test-food-lookup.mjs` (committed manual test script)

**Interfaces:**
- Produces API response shape (consumed by Tasks 4–5):

```json
{ "source": "openfoodfacts", "name": "...", "brand": "...",
  "serving_size": "56 g", "serving_grams": 56,
  "calories": 200, "protein_g": 3.5, "carbs_g": 45, "fat_g": 0.5,
  "per_100g": { "calories": 357, "protein_g": 6.2, "carbs_g": 80, "fat_g": 0.9 } }
```
`serving_grams` and `per_100g` are `null` when the source lacks them.

- [ ] **Step 1: In `lookupOFF`, request the extra field and build per-100g + serving_grams**

Change the fields param to include `serving_quantity`:
```js
const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`;
```
After the existing per-serving/per-100g branch, add (before `return`):
```js
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const kcal100 = n['energy-kcal_100g'] != null
    ? n['energy-kcal_100g']
    : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null);
  const per100g = kcal100 == null ? null : {
    calories: r1(kcal100),
    protein_g: r1(n['proteins_100g']) ?? 0,
    carbs_g: r1(n['carbohydrates_100g']) ?? 0,
    fat_g: r1(n['fat_100g']) ?? 0,
  };
  const servingGrams = product.serving_quantity > 0 ? Number(product.serving_quantity) : null;
```
and add to the returned object: `serving_grams: servingGrams, per_100g: per100g,`.

- [ ] **Step 2: In `lookupUSDA`, per-100g is the native basis**

Before the scaling block, capture the raw values:
```js
  const per100g = {
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
  };
  let servingGrams = null;
```
Inside the existing `if ((unit === 'g' || unit === 'ml') && food.servingSize > 0)` block add `servingGrams = food.servingSize;`. Add to the returned object: `serving_grams: servingGrams, per_100g: per100g,`.

- [ ] **Step 3: Create the committed test script** `fitness-tracker/scripts/test-food-lookup.mjs`

```js
// Manual API test: node scripts/test-food-lookup.mjs (run from fitness-tracker/)
import handler from '../api/food-lookup.js';

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const cases = [
  ['3017620422003', 'Nutella — expect per_100g and serving_grams'],
  ['5449000000996', 'Coca-Cola EAN-13'],
  ['016000275270', 'Cheerios 12-digit UPC'],
  ['0000000000000', 'expect 404'],
];
for (const [barcode, label] of cases) {
  const res = makeRes();
  await handler({ method: 'GET', query: { barcode } }, res);
  console.log(`--- ${label} (${barcode}) -> ${res.statusCode}`);
  console.log(JSON.stringify(res.body));
}
```

- [ ] **Step 4: Run it and verify**

Run: `cd fitness-tracker && node scripts/test-food-lookup.mjs`
Expected: Nutella 200 with non-null `per_100g` (calories ≈ 539) and `serving_grams` (15); fake barcode 404. All previous fields unchanged.

- [ ] **Step 5: Commit and push**

```bash
git add fitness-tracker/api/food-lookup.js fitness-tracker/scripts/test-food-lookup.mjs
git commit -m "Return per-100g macros and serving grams from food-lookup for gram-based amounts"
git push origin master
```

---

### Task 3: Shared food math helpers — src/lib/food.js

**Files:**
- Create: `fitness-tracker/src/lib/food.js`

**Interfaces:**
- Produces (consumed by Tasks 4–8):
  - `entryTotals(entry) -> { calories, protein, carbs, fat }` — totals for one entry honoring quantity_mode.
  - `dayTotals(entries) -> { calories, protein, carbs, fat }`
  - `recentFoods(entries, limit = 8) -> entry[]` — newest entry per distinct food_name.
  - `MEAL_TYPES = ['breakfast','lunch','dinner','snack']`, `MEAL_LABELS`.

- [ ] **Step 1: Write the file**

```js
// Shared food-entry math. One source of truth for how an entry's totals are
// computed: grams mode uses per-100g basis; servings mode uses per-serving values.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export function entryTotals(entry) {
  if (entry.quantity_mode === 'grams' && entry.grams > 0 && entry.cal_per_100g != null) {
    const f = entry.grams / 100;
    return {
      calories: (entry.cal_per_100g || 0) * f,
      protein: (entry.protein_per_100g || 0) * f,
      carbs: (entry.carbs_per_100g || 0) * f,
      fat: (entry.fat_per_100g || 0) * f,
    };
  }
  const s = entry.servings || 1;
  return {
    calories: (entry.calories || 0) * s,
    protein: (entry.protein_g || 0) * s,
    carbs: (entry.carbs_g || 0) * s,
    fat: (entry.fat_g || 0) * s,
  };
}

export function dayTotals(entries) {
  return entries.reduce(
    (acc, e) => {
      const t = entryTotals(e);
      acc.calories += t.calories;
      acc.protein += t.protein;
      acc.carbs += t.carbs;
      acc.fat += t.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function recentFoods(entries, limit = 8) {
  // entries must be sorted newest-first; keep first occurrence of each name
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = e.food_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export function amountLabel(entry) {
  if (entry.quantity_mode === 'grams' && entry.grams > 0) return `${entry.grams} g`;
  return `${entry.servings || 1} × ${entry.serving_size || 'serving'}`;
}
```

- [ ] **Step 2: Verify build** — Run: `cd fitness-tracker && npm run build` — Expected: success.

- [ ] **Step 3: Commit and push**

```bash
git add fitness-tracker/src/lib/food.js
git commit -m "Add shared food math helpers (entry totals, day totals, recents)"
git push origin master
```

---

### Task 4: FoodEntryForm component (add AND edit, servings/grams, overrides)

**Files:**
- Create: `fitness-tracker/src/components/FoodEntryForm.jsx`

**Interfaces:**
- Consumes: `MEAL_TYPES`, `MEAL_LABELS` from `../lib/food`.
- Produces: `<FoodEntryForm initial={...} onSave={(values) => Promise} onCancel={fn} saveLabel="Add to log" />`.
  - `initial` shape (all optional): `{ food_name, brand, barcode, serving_size, serving_grams, calories, protein_g, carbs_g, fat_g, cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, meal_type, quantity_mode, servings, grams }`
  - `onSave` receives the full DB-column payload (everything above minus `brand`, with numbers parsed). The parent adds `user_id`/`date` and inserts or updates.

- [ ] **Step 1: Write the component**

```jsx
import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { MEAL_TYPES, MEAL_LABELS } from '../lib/food';

/**
 * Shared add/edit form for a food entry. Amount can be entered as servings of
 * the (editable) serving size, or as grams when per-100g data exists. The four
 * macro numbers are editable overrides.
 */
export default function FoodEntryForm({ initial = {}, onSave, onCancel, saveLabel = 'Save' }) {
  const [mealType, setMealType] = useState(initial.meal_type || 'breakfast');
  const [mode, setMode] = useState(initial.quantity_mode || 'servings');
  const [servings, setServings] = useState(String(initial.servings ?? 1));
  const [grams, setGrams] = useState(String(initial.grams ?? initial.serving_grams ?? 100));
  const [servingSize, setServingSize] = useState(initial.serving_size || '');
  const [name, setName] = useState(initial.food_name || '');
  const [cal, setCal] = useState(String(initial.calories ?? 0));
  const [protein, setProtein] = useState(String(initial.protein_g ?? 0));
  const [carbs, setCarbs] = useState(String(initial.carbs_g ?? 0));
  const [fat, setFat] = useState(String(initial.fat_g ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasPer100g = initial.cal_per_100g != null;

  const preview = (() => {
    if (mode === 'grams' && hasPer100g) {
      const f = (parseFloat(grams) || 0) / 100;
      return Math.round((initial.cal_per_100g || 0) * f);
    }
    return Math.round((parseFloat(cal) || 0) * (parseFloat(servings) || 1));
  })();

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await onSave({
        food_name: name.trim(),
        barcode: initial.barcode || '',
        meal_type: mealType,
        quantity_mode: mode,
        servings: parseFloat(servings) || 1,
        grams: mode === 'grams' ? parseFloat(grams) || 0 : null,
        serving_size: servingSize,
        serving_grams: initial.serving_grams ?? null,
        calories: parseFloat(cal) || 0,
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        cal_per_100g: initial.cal_per_100g ?? null,
        protein_per_100g: initial.protein_per_100g ?? null,
        carbs_per_100g: initial.carbs_per_100g ?? null,
        fat_per_100g: initial.fat_per_100g ?? null,
      });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 text-xs">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map((meal) => (
          <button key={meal} onClick={() => setMealType(meal)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mealType === meal ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}>
            {MEAL_LABELS[meal]}
          </button>
        ))}
      </div>

      {/* Amount: servings vs grams */}
      <div>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setMode('servings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'servings' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
            }`}>
            Servings
          </button>
          <button onClick={() => hasPer100g && setMode('grams')} disabled={!hasPer100g}
            title={hasPer100g ? '' : 'No per-100g data for this food'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
              mode === 'grams' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
            }`}>
            Grams
          </button>
        </div>
        {mode === 'servings' ? (
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs">Servings</label>
              <input type="number" step="0.5" min="0" value={servings}
                onChange={(e) => setServings(e.target.value)} className={`${inputCls} w-24`} />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-zinc-400 text-xs">Serving size</label>
              <input type="text" placeholder="e.g. 1 slice (30 g)" value={servingSize}
                onChange={(e) => setServingSize(e.target.value)} className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs">Amount (g)</label>
            <input type="number" step="1" min="0" value={grams}
              onChange={(e) => setGrams(e.target.value)} className={`${inputCls} w-28`} />
          </div>
        )}
      </div>

      {/* Macro overrides (per one serving) */}
      <div>
        <p className="text-zinc-400 text-xs mb-2">
          Nutrition per {mode === 'grams' ? '100 g (from label data)' : `serving${servingSize ? ` (${servingSize})` : ''}`}
        </p>
        {mode === 'grams' ? (
          <p className="text-zinc-500 text-xs">
            {initial.cal_per_100g ?? 0} kcal · P {initial.protein_per_100g ?? 0} g · C {initial.carbs_per_100g ?? 0} g · F {initial.fat_per_100g ?? 0} g
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[['kcal', cal, setCal], ['Protein', protein, setProtein], ['Carbs', carbs, setCarbs], ['Fat', fat, setFat]].map(([label, val, set]) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-zinc-500 text-[10px]">{label}</label>
                <input type="number" step="0.1" min="0" value={val}
                  onChange={(e) => set(e.target.value)} className={`${inputCls} px-2`} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-zinc-400 text-sm">= <span className="text-zinc-100 font-semibold">{preview}</span> kcal</p>
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Check className="w-4 h-4" /> {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify build** — Run: `cd fitness-tracker && npm run build` — Expected: success (component not yet mounted anywhere; that's fine).

- [ ] **Step 3: Commit and push**

```bash
git add fitness-tracker/src/components/FoodEntryForm.jsx
git commit -m "Add shared FoodEntryForm with servings/grams modes and macro overrides"
git push origin master
```

---

### Task 5: TodayFood component — goal card, add flow, recents, meal cards with edit

**Files:**
- Create: `fitness-tracker/src/components/TodayFood.jsx`

**Interfaces:**
- Consumes: `entryTotals`, `dayTotals`, `recentFoods`, `amountLabel`, `MEAL_TYPES`, `MEAL_LABELS` from `../lib/food`; `FoodEntryForm`; `BarcodeScanner`; `supabase`; `useAuth`.
- Produces: `<TodayFood date="yyyy-MM-dd" />` — self-contained Food tab body (consumed by Task 6).

- [ ] **Step 1: Write the component.** Structure (all in this one file; sub-pieces as local functions):

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ScanBarcode, Search, Pencil, Trash2, Target, Utensils, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { entryTotals, dayTotals, recentFoods, amountLabel, MEAL_TYPES, MEAL_LABELS } from '../lib/food';
import FoodEntryForm from './FoodEntryForm';
import BarcodeScanner from './BarcodeScanner';

export default function TodayFood({ date }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [allRecent, setAllRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState(null); // { goal_calories, goal_protein_g } | null
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalCal, setGoalCal] = useState('');
  const [goalProtein, setGoalProtein] = useState('');

  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [pendingFood, setPendingFood] = useState(null); // lookup result or manual blank -> FoodEntryForm initial
  const [editingEntry, setEditingEntry] = useState(null); // existing row being edited

  // Load day entries
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).eq('date', date).order('created_at');
      if (!cancelled) {
        if (err) setError(`Could not load food: ${err.message}`);
        else setEntries(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, date]);

  // Load recents (latest 100 entries any date, newest first) + settings once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      setAllRecent(data || []);
      const { data: s } = await supabase
        .from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (s) { setSettings(s); setGoalCal(String(s.goal_calories ?? '')); setGoalProtein(String(s.goal_protein_g ?? '')); }
    })();
  }, [user]);

  const totals = useMemo(() => dayTotals(entries), [entries]);
  const recents = useMemo(() => recentFoods(allRecent), [allRecent]);
  const byMeal = useMemo(() => {
    const g = {};
    for (const m of MEAL_TYPES) {
      const list = entries.filter((e) => e.meal_type === m);
      if (list.length) g[m] = list;
    }
    return g;
  }, [entries]);

  async function saveGoal() {
    const payload = {
      user_id: user.id,
      goal_calories: parseInt(goalCal, 10) || null,
      goal_protein_g: parseInt(goalProtein, 10) || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from('user_settings').upsert(payload);
    if (err) { setError(`Could not save goal: ${err.message}`); return; }
    setSettings(payload);
    setEditingGoal(false);
  }

  async function handleLookup(code) {
    const c = code.trim();
    if (!c) return;
    setError(''); setLookupLoading(true);
    try {
      const resp = await fetch(`/api/food-lookup?barcode=${encodeURIComponent(c)}`);
      const json = await resp.json();
      if (!resp.ok) {
        setError(resp.status === 404 ? 'Product not found — check the barcode or add it manually.' : json.error || 'Lookup failed.');
        return;
      }
      setPendingFood({
        food_name: json.brand ? `${json.name} (${json.brand.split(',')[0].trim()})` : json.name,
        barcode: c,
        serving_size: json.serving_size,
        serving_grams: json.serving_grams,
        calories: json.calories, protein_g: json.protein_g, carbs_g: json.carbs_g, fat_g: json.fat_g,
        cal_per_100g: json.per_100g?.calories ?? null,
        protein_per_100g: json.per_100g?.protein_g ?? null,
        carbs_per_100g: json.per_100g?.carbs_g ?? null,
        fat_per_100g: json.per_100g?.fat_g ?? null,
      });
    } catch {
      setError('Lookup failed. Check your connection.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function insertEntry(values) {
    const { data, error: err } = await supabase
      .from('food_entries')
      .insert({ ...values, user_id: user.id, date })
      .select().single();
    if (err) throw new Error(err.message);
    setEntries((prev) => [...prev, data]);
    setAllRecent((prev) => [data, ...prev]);
    setPendingFood(null); setBarcode('');
  }

  async function updateEntry(id, values) {
    const { data, error: err } = await supabase
      .from('food_entries').update(values).eq('id', id).select().single();
    if (err) throw new Error(err.message);
    setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
    setEditingEntry(null);
  }

  async function deleteEntry(id) {
    const { error: err } = await supabase.from('food_entries').delete().eq('id', id);
    if (err) { setError(`Could not delete: ${err.message}`); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // ... render (Step 2)
}
```

- [ ] **Step 2: Render, in order** (inside the returned `<div className="px-4 flex flex-col gap-4">`):

1. Error banner when `error`: `bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm` with the message.
2. **Goal card** (`bg-zinc-900 border border-zinc-800 rounded-2xl p-5`): when `editingGoal` show two number inputs (Daily calories / Daily protein g) + Save (calls `saveGoal`); otherwise show `Math.round(totals.calories)` big, `/ ${settings?.goal_calories ?? '—'} kcal` beside it, a progress bar (`bg-zinc-800 h-2 rounded-full` outer, inner `bg-teal-500` width `Math.min(100, totals.calories / settings.goal_calories * 100)%` only when goal set), protein line `P {Math.round(totals.protein)} / {settings?.goal_protein_g ?? '—'} g`, and a `Target` icon button toggling `setEditingGoal(true)` ("Set a goal" text when `!settings?.goal_calories`).
3. **Add Food card**: Scan button toggling `scanning` (full-width teal, `ScanBarcode` icon); `{scanning && <BarcodeScanner onScan={(code) => { setScanning(false); setBarcode(code); handleLookup(code); }} onClose={() => setScanning(false)} />}`; barcode input + Search button (same pattern as FoodLog.jsx had — numeric input, Enter key calls `handleLookup(barcode)`, disabled while `lookupLoading`); **recents strip**: when `recents.length`, horizontal scroll row (`flex gap-2 overflow-x-auto pb-1`) of chips (`bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full px-3 py-1.5 text-xs whitespace-nowrap`) — clicking chip `r` calls `setPendingFood({ ...r, id: undefined })` (spread the row: it already has every needed column; delete `id`/`created_at`/`user_id`/`date` keys before passing); a text link "Can't scan it? Add manually" (`PlusCircle` icon, `text-teal-400 text-xs`) calling `setPendingFood({ food_name: '', serving_size: '1 serving' })`.
4. **Pending-food form card** (when `pendingFood`): `bg-zinc-900 border border-teal-800/50 rounded-2xl p-5` wrapping `<FoodEntryForm initial={pendingFood} saveLabel="Add to log" onSave={insertEntry} onCancel={() => setPendingFood(null)} />`.
5. **Meal cards** (when not loading): for each meal in `byMeal` — header row (label + per-meal kcal via `entryTotals` sum), entries with `amountLabel(entry)` + kcal, and per-entry `Pencil` (sets `editingEntry`) and `Trash2` (calls `deleteEntry`) buttons — always visible on mobile (`text-zinc-600 hover:text-teal-400` / `hover:text-red-400`, no hover-reveal). When `editingEntry?.id === entry.id`, render `<FoodEntryForm initial={editingEntry} saveLabel="Save changes" onSave={(v) => updateEntry(entry.id, v)} onCancel={() => setEditingEntry(null)} />` in place of the row.
6. Empty state when `!loading && entries.length === 0`: centered `Utensils` icon + "No foods logged. Scan a barcode or add manually."

- [ ] **Step 3: Verify build** — Run: `cd fitness-tracker && npm run build` — Expected: success.

- [ ] **Step 4: Commit and push**

```bash
git add fitness-tracker/src/components/TodayFood.jsx
git commit -m "Add TodayFood component: goals, scan/manual/recents add flow, editable meal entries"
git push origin master
```

---

### Task 6: Tabs on Today page + retire the standalone FoodLog page

**Files:**
- Modify: `fitness-tracker/src/pages/Today.jsx` (tab switcher ~line 1089, after the date-nav header div)
- Modify: `fitness-tracker/src/App.jsx` (replace `/food` route with redirect; drop FoodLog import)
- Modify: `fitness-tracker/src/components/Layout.jsx` (remove Food Log entry from `moreNavItems`; remove `Utensils` import)
- Delete: `fitness-tracker/src/pages/FoodLog.jsx`

**Interfaces:**
- Consumes: `<TodayFood date={selectedDate} />` from Task 5.
- Produces: URL contract `/today?tab=food` (and `&date=yyyy-MM-dd`) used by Tasks 7–8.

- [ ] **Step 1: Add tab state to `Today()`** — next to the existing `selectedDate` derivation (`Today.jsx:611`):

```jsx
const activeTab = searchParams.get('tab') === 'food' ? 'food' : 'workout';
function switchTab(tab) {
  const next = new URLSearchParams(searchParams);
  if (tab === 'food') next.set('tab', 'food'); else next.delete('tab');
  setSearchParams(next, { replace: true });
}
```

- [ ] **Step 2: Insert the switcher after the date-nav header** (after the closing `</div>` at Today.jsx:1089, before the `!isToday` block):

```jsx
{/* Workout | Food tab switcher */}
<div className="px-4 pb-3">
  <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
    {[['workout', 'Workout'], ['food', 'Food']].map(([key, label]) => (
      <button key={key} onClick={() => switchTab(key)}
        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
          activeTab === key ? 'bg-teal-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
        }`}>
        {label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Gate the two bodies.** Wrap everything from the session-note block (Today.jsx:1118) through the end of the day-list/sheets content in `{activeTab === 'workout' && (<>...</>)}` (the install-hint and back-to-today blocks stay outside the gate), and add `{activeTab === 'food' && <TodayFood date={selectedDate} />}` after it. Import `TodayFood` at the top: `import TodayFood from '../components/TodayFood';`. The bottom sheets (`ExerciseLogSheet`, `AddExerciseSheet`, `TemplatesSheet`) render conditionally on their own state already — leave them outside the gate.

- [ ] **Step 4: Retire FoodLog.** In `App.jsx`: delete `import FoodLog from './pages/FoodLog';`, replace `<Route path="/food" element={<FoodLog />} />` with a redirect component modeled on the existing `WorkoutsRedirect` (App.jsx:55):

```jsx
// Redirect /food?date=X → /today?tab=food&date=X (food now lives on the Today page)
function FoodRedirect() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  return <Navigate to={`/today?tab=food${date ? `&date=${date}` : ''}`} replace />;
}
```
Route: `<Route path="/food" element={<FoodRedirect />} />` (move it OUTSIDE the protected Layout group, next to `/workouts`). In `Layout.jsx`: remove the `{ to: '/food', ... }` line from `moreNavItems` and the `Utensils` import. Delete `src/pages/FoodLog.jsx`.

- [ ] **Step 5: Verify build** — Run: `cd fitness-tracker && npm run build` — Expected: success, no unused-import warnings for FoodLog.

- [ ] **Step 6: Manual check** — Run: `cd fitness-tracker && npx vercel dev` — visit `/today` (workout unchanged), `/today?tab=food` (food body), `/food` (redirects). Log a food via manual entry; edit it; delete it; set a goal and refresh (persists).

- [ ] **Step 7: Commit and push**

```bash
git add -A fitness-tracker/src
git commit -m "Move food logging into a Food tab on Today; retire standalone FoodLog page"
git push origin master
```

---

### Task 7: Calendar Workout | Food toggle

**Files:**
- Modify: `fitness-tracker/src/pages/CalendarView.jsx`

**Interfaces:**
- Consumes: `dayTotals`, `entryTotals`, `MEAL_TYPES`, `MEAL_LABELS`, `amountLabel` from `../lib/food`; URL contract `/today?tab=food&date=...`.

- [ ] **Step 1: Add view state + food fetching.** New state: `const [view, setView] = useState('workout');`, `const [foodDates, setFoodDates] = useState({});` (map `date -> entries[]`). Add a `fetchMonthFood` callback mirroring `fetchMonthWorkouts` (CalendarView.jsx:52) using the same `start`/`end` range:

```jsx
const fetchMonthFood = useCallback(async () => {
  if (!user) return;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const start = format(startOfWeek(monthStart, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(monthEnd, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const { data, error: err } = await supabase
    .from('food_entries').select('*')
    .eq('user_id', user.id).gte('date', start).lte('date', end);
  if (err) { setError(err.message); return; }
  const map = {};
  (data || []).forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
  setFoodDates(map);
}, [user, currentDate]);

useEffect(() => { if (view === 'food') fetchMonthFood(); }, [view, fetchMonthFood]);
```

- [ ] **Step 2: Toggle UI** — above the calendar card (after the `<p>` subtitle, CalendarView.jsx:165), same segmented style as Today's switcher:

```jsx
<div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 max-w-xs">
  {[['workout', 'Workout'], ['food', 'Food']].map(([key, label]) => (
    <button key={key} onClick={() => { setView(key); setSelectedDay(null); }}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
        view === key ? 'bg-teal-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}>
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Day-cell rendering per view.** In the day-cell map (CalendarView.jsx:202): when `view === 'food'`, highlight days with `foodDates[dateStr]?.length` using the same classes as `hasWorkout` days; suppress the category dots (`dots.length > 0 && view === 'workout' && ...`) and hide the muscle-group legend (`{view === 'workout' && (<div className="mt-3 ...">...)}`).

- [ ] **Step 4: Day panel per view.** In the `selectedDay` sidebar (CalendarView.jsx:248): when `view === 'food'`, replace the sets list with grouped meals for `foodDates[format(selectedDay, 'yyyy-MM-dd')] || []`: daily total line (`dayTotals`), then per meal present: label + entries (`entry.food_name`, `amountLabel(entry)`, `Math.round(entryTotals(entry).calories)` kcal). Empty: "No food logged this day." Bottom button becomes:

```jsx
<button onClick={() => navigate(view === 'food'
    ? `/today?tab=food&date=${format(selectedDay, 'yyyy-MM-dd')}`
    : `/today?date=${format(selectedDay, 'yyyy-MM-dd')}`)}
  className="mt-3 flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
  {view === 'food' ? 'Go to Food Log' : 'Go to Workout'}
  <ArrowRight className="w-4 h-4" />
</button>
```

- [ ] **Step 5: Verify build + manual check** — build passes; toggle flips markers; food day panel shows meals; both Go-to buttons land on the right Today tab.

- [ ] **Step 6: Commit and push**

```bash
git add fitness-tracker/src/pages/CalendarView.jsx
git commit -m "Add Workout/Food view toggle to the calendar with food day markers and meal panel"
git push origin master
```

---

### Task 8: Trends page (charts) + route + nav

**Files:**
- Create: `fitness-tracker/src/pages/Trends.jsx`
- Modify: `fitness-tracker/src/App.jsx` (route `/trends` inside the protected group)
- Modify: `fitness-tracker/src/components/Layout.jsx` (add `{ to: '/trends', label: 'Trends', icon: BarChart3 }` to `moreNavItems`, import `BarChart3`)

**Interfaces:**
- Consumes: `entryTotals` from `../lib/food`; `user_settings.goal_calories` for the reference line; Recharts (`BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine`); chart styling constants copied from `BodyWeightTracker.jsx:129-136` (`stroke="#3f3f46"`, ticks `fill:'#71717a', fontSize:11`, teal `#14b8a6`).

- [ ] **Step 1: Write the page.** Structure:

```jsx
// State: tab ('workout'|'food'), range (14|30|90 days), data
// Header: BarChart3 icon chip + "Trends"; segmented Workout|Food switcher
// (same classes as Today Task 6 Step 2); range pills: 2 weeks / 1 month / 3 months.
//
// Food tab data: fetch food_entries where date >= format(subDays(new Date(), range), 'yyyy-MM-dd'),
// plus user_settings for the goal. Group by date via entryTotals -> per-day
// { date, label: format(parseISO(date), 'MMM d'), calories, protein }.
// Chart 1 "Calories per day": <BarChart> with <Bar dataKey="calories" fill="#14b8a6" radius={[4,4,0,0]} />
// and {goal && <ReferenceLine y={goal} stroke="#f59e0b" strokeDasharray="4 4" />}.
// Chart 2 "Protein per day": same with dataKey="protein" fill="#0ea5e9".
//
// Workout tab data: fetch workouts (id, date) in range, then workout_sets
// (workout_id, weight_kg, reps) for those ids; per-day volume = sum(weight_kg*reps),
// setCount. Chart 1 "Volume per day (kg)": Bar dataKey="volume" fill="#14b8a6".
// Chart 2 "Sets per week": bucket by format(startOfWeek(parseISO(date)), 'MMM d'),
// Bar dataKey="sets" fill="#8b5cf6".
//
// Each chart in a bg-zinc-900 border border-zinc-800 rounded-2xl p-5 card,
// ResponsiveContainer height={240}; empty state text when no data in range.
```
Write the full component following that structure — every fetch filtered by `.eq('user_id', user.id)` (for `workout_sets`, filter via the fetched workout ids with `.in('workout_id', ids)` exactly like `Dashboard.jsx:43-46`).

- [ ] **Step 2: Wire route + nav.** `App.jsx`: `import Trends from './pages/Trends';`, add `<Route path="/trends" element={<Trends />} />` after `/records`. `Layout.jsx`: add the `moreNavItems` entry after Personal Records.

- [ ] **Step 3: Verify build + manual check** — build passes; both tabs render; ranges switch; goal line appears when a goal is set.

- [ ] **Step 4: Commit and push**

```bash
git add fitness-tracker/src/pages/Trends.jsx fitness-tracker/src/App.jsx fitness-tracker/src/components/Layout.jsx
git commit -m "Add Trends page: calorie/protein and volume/sets charts with range switcher"
git push origin master
```

---

### Task 9: Integrated Dashboard

**Files:**
- Modify: `fitness-tracker/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `entryTotals` from `../lib/food`; existing stats fetching (Dashboard.jsx:22-81) stays.

- [ ] **Step 1: Extend the stats fetch.** Inside `fetchStats` after the workout queries, add:

```jsx
const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd');
const { data: foodWeek } = await supabase
  .from('food_entries').select('*')
  .eq('user_id', user.id).gte('date', weekStart);
const { data: settingsRow } = await supabase
  .from('user_settings').select('goal_calories').eq('user_id', user.id).maybeSingle();

const calsByDate = {};
(foodWeek || []).forEach((e) => {
  calsByDate[e.date] = (calsByDate[e.date] || 0) + entryTotals(e).calories;
});
const loggedDays = Object.keys(calsByDate).length;
const avgCalories = loggedDays
  ? Math.round(Object.values(calsByDate).reduce((a, b) => a + b, 0) / loggedDays)
  : 0;
```
Extend the `sevenDays` builder so each day also carries `ate: !!calsByDate[d]`, and store `avgCalories`, `loggedDays`, `goalCalories: settingsRow?.goal_calories ?? null` in `stats`.

- [ ] **Step 2: UI changes.**
1. The big teal action button gets a twin flow: keep "Log Today's Workout"; change the second big button from Calendar to "Log Today's Food" navigating to `/today?tab=food` (icon `Utensils`), and move Calendar down into the secondary shortcut row replacing the dead `/progress` shortcut (Dashboard.jsx:164-170 currently navigates to `/progress`, which redirects — replace with `/calendar`, icon `CalendarDays`; also add a `/trends` shortcut with `TrendingUp`).
2. New "Nutrition this week" card next to the Streak card (make that grid `grid-cols-2`): `Flame`-style layout with `Utensils` icon in teal chip, big `{stats.avgCalories}` kcal/day avg, subtitle `${stats.loggedDays}/7 days logged` and, when `stats.goalCalories`, `vs {stats.goalCalories} goal`.
3. 7-day strip becomes two-signal: each day column shows the existing bar for `active` (trained, teal) plus a small dot underneath — `bg-amber-400` when `ate`, `bg-zinc-800` otherwise — with legend text "bar = trained · dot = food logged".

- [ ] **Step 3: Verify build + manual check** — build passes; dashboard numbers match Today tab totals for today; both big buttons land on the right tab.

- [ ] **Step 4: Commit and push**

```bash
git add fitness-tracker/src/pages/Dashboard.jsx
git commit -m "Integrate food into Dashboard: nutrition week card, two-signal activity strip, food shortcut"
git push origin master
```

---

### Task 10: Final verification sweep

**Files:** none new.

- [ ] **Step 1: Full build** — `cd fitness-tracker && npm run build` — Expected: success.
- [ ] **Step 2: Run `node scripts/test-food-lookup.mjs`** — all cases behave as in Task 2.
- [ ] **Step 3: `npx vercel dev` manual pass:** log food via barcode search, manual add, and a recents chip; switch an entry between servings and grams and confirm the kcal totals change correctly (grams mode: per-100g × grams/100); edit an entry's meal + macros; delete one; set goals and confirm goal bar + Dashboard + Trends reference line all use them; calendar toggle both views; `/food` and `/food?date=2026-07-01` redirects; workout tab regression: add a set, edit a set, load a template.
- [ ] **Step 4: Report to user:** remind them to run BOTH migrations (`migration_food_log.sql` if not yet run, then `migration_food_v2.sql`) in the Supabase SQL editor, and to re-test the camera scanner on the phone via the deployed HTTPS URL.
