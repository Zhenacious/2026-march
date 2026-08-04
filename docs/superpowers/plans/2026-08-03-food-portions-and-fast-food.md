# Food Portions Rework + NZ/AU Fast Food Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FitTrack's single-serving food model with a per-food portion list driven by per-100g nutrition, fixing the bug where nutrition never rescales, and seed accurate NZ/AU fast food menu data.

**Architecture:** Per-100g nutrition becomes the single source of truth. A food carries an ordered list of `{ label, grams }` portions; the first is its default. An entry stores `portion_label`, `portion_grams` and `quantity`, so every total is `per100g × (quantity × portionGrams) / 100` — one code path replacing the current `quantity_mode` fork. The two redundant serving inputs are deleted and replaced by a quantity box plus a portion dropdown.

**Tech Stack:** React 19, Vite, Tailwind v4, Supabase Postgres, lucide-react, plain-Node test scripts.

**Spec:** `docs/superpowers/specs/2026-08-03-food-portions-and-fast-food-design.md`

## Global Constraints

- Nutrition is snapshotted onto the entry at log time. Editing a food never rewrites history.
- **The backfill must not change the calorie or macro total of any already-logged day.** Verified by the invariance test in Task 2, which is written before any migration exists.
- Database changes go in `supabase/migrations/` as a new numbered file, applied with `npm run migrate`. Never instruct anyone to paste SQL by hand.
- No emojis in UI. Use `lucide-react` icons.
- Per-100g calories must sit between 0 and 900 (pure fat is 900 kcal/100 g; above that means kilojoules in the kcal field).
- `UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1 }` — ml is 1:1 with g, matching how label data for liquids is per 100 ml.
- Portion display format is `label (grams g)`, e.g. `1 drumstick (90 g)`. Labels that are already a pure weight (`100 g`, `250 ml`) render as-is with no bracket.
- Every fast food value must come from the chain's published nutrition table. Each chain file records its source and the date read. Unpublished weights are marked ESTIMATE in a comment.
- Commit and push to `origin master` after each task.

---

### Task 1: Portion vocabulary

**Files:**
- Create: `fitness-tracker/src/lib/portions.js`
- Test: `fitness-tracker/scripts/test-food-math.mjs` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parsePortions(value) -> Array<{label: string, grams: number}>` — tolerates a JSON string, an array, null; drops entries with an empty label or `grams <= 0`.
  - `portionLabel(portion) -> string` — `'1 drumstick (90 g)'`; pure-weight labels pass through unchanged.
  - `isWeightLabel(label) -> boolean` — true for `'100 g'`, `'250 ml'`, `'g'`, `'oz'`, `'ml'`.
  - `defaultPortion(portions) -> {label, grams}` — first entry, or `{ label: '100 g', grams: 100 }` when empty.
  - `portionOptions(portions) -> Array<{label, grams}>` — the list plus a `100 g` entry when none of the list is a pure weight.
  - `scaleTo(per100, grams) -> {calories, protein_g, carbs_g, fat_g}` — per-100g down to a portion, unrounded.
  - `scaleFrom(values, grams) -> {calories, protein_g, carbs_g, fat_g}` — a portion's values back up to per-100g, unrounded.

- [ ] **Step 1: Write the failing tests** in `scripts/test-food-math.mjs`

```js
import { parsePortions, portionLabel, defaultPortion, portionOptions, scaleTo, scaleFrom }
  from '../src/lib/portions.js';

console.log('\nportions:');
checkStr('composed label', portionLabel({ label: '1 drumstick', grams: 90 }), '1 drumstick (90 g)');
checkStr('pure weight label passes through', portionLabel({ label: '100 g', grams: 100 }), '100 g');
checkStr('default when empty', defaultPortion([]).label, '100 g');
checkStr('parse drops junk', String(parsePortions([{ label: '', grams: 5 }, { label: 'x', grams: 0 }]).length), '0');
checkStr('parse accepts a JSON string', parsePortions('[{"label":"1 egg","grams":50}]')[0].label, '1 egg');
checkStr('100 g appended when absent', portionOptions([{ label: '1 egg', grams: 50 }])[1].label, '100 g');
checkStr('100 g not duplicated', String(portionOptions([{ label: '100 g', grams: 100 }]).length), '1');
check('scaleTo 90 g of 179/100g', scaleTo({ calories: 179 }, 90).calories, 161.1);
check('scaleFrom round trip', scaleFrom(scaleTo({ calories: 179 }, 90), 90).calories, 179);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd fitness-tracker && node scripts/test-food-math.mjs`
Expected: FAIL — `Cannot find module '../src/lib/portions.js'`

- [ ] **Step 3: Write `src/lib/portions.js`**

Pure weight detection: `/^[\d.]*\s*(g|ml|oz)$/i` against the trimmed label.

- [ ] **Step 4: Run the tests**

Run: `cd fitness-tracker && node scripts/test-food-math.mjs`
Expected: PASS, and every pre-existing check still passes.

- [ ] **Step 5: Commit**

```bash
git add fitness-tracker/src/lib/portions.js fitness-tracker/scripts/test-food-math.mjs
git commit -m "Add the portion vocabulary: labels, defaults and per-100g scaling"
```

---

### Task 2: Migration-invariance test (write this before any migration exists)

**Files:**
- Modify: `fitness-tracker/scripts/test-food-math.mjs`

**Interfaces:**
- Consumes: `entryTotals` from `src/lib/food.js` (current version).
- Produces: a `backfill(entry)` fixture helper mirroring exactly what migration `011` will do in SQL, plus fixtures covering every legacy entry shape.

- [ ] **Step 1: Add the fixtures and the invariance check**

```js
// Mirrors 011_backfill_portions.sql. If this and the SQL ever disagree, the SQL is wrong.
function backfill(e) {
  const out = { ...e };
  if (e.quantity_mode === 'grams') {
    out.portion_label = e.input_unit || 'g';
    out.portion_grams = UNIT_TO_GRAMS[e.input_unit || 'g'] ?? 1;
    out.quantity = e.input_amount ?? e.grams;
    if (e.input_amount == null) { out.portion_label = 'g'; out.portion_grams = 1; }
  } else {
    out.quantity = e.servings ?? 1;
    if (e.serving_grams > 0) {
      out.portion_label = e.serving_size || '1 serving';
      out.portion_grams = e.serving_grams;
    } else if (e.cal_per_100g != null) {
      out.portion_label = '100 g'; out.portion_grams = 100;
    } else {
      // No weight anywhere: a serving becomes a 100 g-equivalent unit whose
      // per-100g values are the old per-serving values, so totals are unchanged.
      out.portion_label = e.serving_size || '1 serving';
      out.portion_grams = 100;
      out.cal_per_100g = e.calories ?? 0;
      out.protein_per_100g = e.protein_g ?? 0;
      out.carbs_per_100g = e.carbs_g ?? 0;
      out.fat_per_100g = e.fat_g ?? 0;
    }
  }
  return out;
}

const LEGACY = [
  { name: 'servings with weight', quantity_mode: 'servings', servings: 2, serving_size: '1 breast', serving_grams: 170,
    calories: 280, protein_g: 52.7, carbs_g: 0, fat_g: 6.1,
    cal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'servings, no weight, no per-100g', quantity_mode: 'servings', servings: 1.5, serving_size: '1 sachet',
    calories: 60, protein_g: 1, carbs_g: 12, fat_g: 0.5 },
  { name: 'servings, no weight, has per-100g', quantity_mode: 'servings', servings: 1, serving_size: '1 serving',
    calories: 393, protein_g: 7.1, carbs_g: 78.6, fat_g: 5.4,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'grams mode', quantity_mode: 'grams', grams: 50, input_unit: 'g', input_amount: 50,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'oz mode', quantity_mode: 'grams', grams: 99.225, input_unit: 'oz', input_amount: 3.5,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'grams mode, no basis', quantity_mode: 'grams', grams: 50, input_unit: 'g', input_amount: 50,
    servings: 3, calories: 100 },
];

console.log('\nmigration invariance — no logged day may change:');
for (const legacy of LEGACY) {
  const before = entryTotals(legacy);
  const after = entryTotals(backfill(legacy));
  check(`${legacy.name} kcal`, after.calories, before.calories);
  check(`${legacy.name} protein`, after.protein, before.protein);
  check(`${legacy.name} carbs`, after.carbs, before.carbs);
  check(`${legacy.name} fat`, after.fat, before.fat);
}
```

- [ ] **Step 2: Run it**

Run: `cd fitness-tracker && node scripts/test-food-math.mjs`
Expected: PASS. The current `entryTotals` ignores the new fields, so both sides take the same branch and agree trivially. That is the point — the check only becomes meaningful in Task 4, where it must still pass.

- [ ] **Step 3: Commit**

```bash
git add fitness-tracker/scripts/test-food-math.mjs
git commit -m "Assert the portion backfill cannot change any already-logged day's totals"
```

---

### Task 3: Database columns and backfill

**Files:**
- Create: `fitness-tracker/supabase/migrations/010_food_portions.sql`
- Create: `fitness-tracker/supabase/migrations/011_backfill_portions.sql`

**Interfaces:**
- Produces: `custom_foods.portions jsonb`, `custom_foods.category text`, `food_entries.portion_label text`, `food_entries.portion_grams float`, `food_entries.quantity float`.

- [ ] **Step 1: Write `010_food_portions.sql`**

```sql
alter table custom_foods add column if not exists portions jsonb not null default '[]'::jsonb;
alter table custom_foods add column if not exists category text default '';
alter table food_entries add column if not exists portion_label text default '';
alter table food_entries add column if not exists portion_grams float;
alter table food_entries add column if not exists quantity float default 1;
create index if not exists custom_foods_user_category on custom_foods (user_id, category);
```

- [ ] **Step 2: Write `011_backfill_portions.sql`**

Three `update` statements for `custom_foods` (has weight / has per-100g / neither) and four for
`food_entries` (grams with input_amount / grams without / servings by the three cases), matching
the `backfill()` helper in Task 2 exactly. Label cleanup strips a trailing weight bracket:

```sql
regexp_replace(coalesce(serving_size,''), '\s*\(\s*[0-9.]+\s*(g|ml)\s*\)\s*$', '', 'i')
```

- [ ] **Step 3: Check what would run**

Run: `cd fitness-tracker && npm run migrate:status`
Expected: lists `010_food_portions.sql` and `011_backfill_portions.sql` as pending.

- [ ] **Step 4: Apply**

Run: `cd fitness-tracker && npm run migrate`
Expected: both applied, no errors.

- [ ] **Step 5: Commit**

```bash
git add fitness-tracker/supabase/migrations/010_food_portions.sql fitness-tracker/supabase/migrations/011_backfill_portions.sql
git commit -m "Add portion columns and backfill existing foods and entries into them"
```

---

### Task 4: One arithmetic path

**Files:**
- Modify: `fitness-tracker/src/lib/food.js`
- Test: `fitness-tracker/scripts/test-food-math.mjs`

**Interfaces:**
- Consumes: `parsePortions`, `portionLabel` from `src/lib/portions.js`.
- Produces: `entryTotals(entry)` reading `quantity × portion_grams` against per-100g, falling back to `legacyEntryTotals(entry)` when the entry has no usable portion; `amountLabel(entry)` rendering `1.5 × 1 drumstick (90 g)` or `150 g`.

- [ ] **Step 1: Add the new expectations to the test**

```js
console.log('\nportion entries:');
const portionEntry = { quantity: 1.5, portion_label: '1 drumstick', portion_grams: 90,
  cal_per_100g: 179, protein_per_100g: 24.8, carbs_per_100g: 0, fat_per_100g: 8.2 };
check('1.5 x 90 g of 179/100g', entryTotals(portionEntry).calories, 241.65);
checkStr('portion label', amountLabel(portionEntry), '1.5 × 1 drumstick (90 g)');
checkStr('pure weight label', amountLabel({ quantity: 150, portion_label: 'g', portion_grams: 1, cal_per_100g: 1 }), '150 g');
```

- [ ] **Step 2: Run and watch the new checks fail**

Run: `cd fitness-tracker && node scripts/test-food-math.mjs`
Expected: FAIL on the three new checks; everything else passes.

- [ ] **Step 3: Rewrite `entryTotals` and `amountLabel`**

Keep the old body verbatim as `legacyEntryTotals`, used only when
`quantity × portion_grams` is not a positive number or `cal_per_100g` is null.

- [ ] **Step 4: Run the whole suite**

Run: `cd fitness-tracker && node scripts/test-food-math.mjs`
Expected: PASS — including the Task 2 invariance block, which is now doing real work.

- [ ] **Step 5: Commit**

```bash
git add fitness-tracker/src/lib/food.js fitness-tracker/scripts/test-food-math.mjs
git commit -m "Compute every food total from per-100g data and the logged portion"
```

---

### Task 5: Portion list editor

**Files:**
- Create: `fitness-tracker/src/components/PortionEditor.jsx`

**Interfaces:**
- Consumes: `parsePortions`, `portionLabel` from `src/lib/portions.js`.
- Produces: `<PortionEditor value={portions} onChange={fn} />` where `portions` is `Array<{label, grams}>`. Rows of label + grams, an Add button, a per-row remove, and a per-row "make default" that moves it to index 0. The first row is labelled `Default`.

- [ ] **Step 1: Build the component**

Icons: `Plus`, `X`, `Star` from lucide-react. Input styling copies the `inputCls` constant used
in `FoodPanel.jsx:6`.

- [ ] **Step 2: Verify it builds**

Run: `cd fitness-tracker && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add fitness-tracker/src/components/PortionEditor.jsx
git commit -m "Add the portion list editor used when defining a food"
```

---

### Task 6: Rebuild the amount section of the food panel

**Files:**
- Modify: `fitness-tracker/src/components/FoodPanel.jsx` (replaces lines 20-34 state and 140-216 markup)

**Interfaces:**
- Consumes: `portionOptions`, `portionLabel`, `defaultPortion`, `parsePortions`, `scaleTo`, `scaleFrom` from `src/lib/portions.js`; `UNIT_TO_GRAMS` from `src/lib/food.js`.
- Produces: `onSave(values)` payload now carrying `quantity`, `portion_label`, `portion_grams`, `portions`, and the per-100g fields; the deprecated `quantity_mode`, `servings`, `serving_size`, `serving_grams`, `input_unit`, `input_amount` are no longer sent.

- [ ] **Step 1: Replace the state**

Delete `unit`, `servings`, `amount`, `servingSize`, `servingGrams`. Add:

```js
const portions = useMemo(() => portionOptions(parsePortions(initial.portions)), [initial.portions]);
const [quantity, setQuantity] = useState(String(initial.quantity ?? 1));
const [sel, setSel] = useState(() => {
  // Editing an existing entry reopens on the portion it was logged with
  if (initial.portion_grams > 0) return { label: initial.portion_label || 'g', grams: initial.portion_grams };
  return defaultPortion(portions);
});
const [custom, setCustom] = useState(false);
const [customUnit, setCustomUnit] = useState('g');
const [per100, setPer100] = useState(() => ({ ... }));  // full precision, never rounded
```

- [ ] **Step 2: Replace the Amount markup**

A quantity number input beside a `<select>` of `portionOptions` plus a final `Custom weight…`
option. Choosing it sets `custom` and swaps in a `g`/`oz`/`ml` chip row, with
`sel = { label: customUnit, grams: UNIT_TO_GRAMS[customUnit] }`.

- [ ] **Step 3: Make the nutrition boxes derive from the selection**

Displayed value is `round1(scaleTo(per100, sel.grams)[field])`; `onChange` writes
`setPer100(scaleFrom({ ...displayed, [field]: typed }, sel.grams))`. Label reads
`Nutrition per {portionLabel(sel)}`. A muted line under it shows the per-100g figures.

- [ ] **Step 4: Delete the two redundant inputs**

Remove the "A serving is" field and the "One serving weighs (g)" field entirely, along with
the `canWeigh` gating and the disabled unit buttons that depended on them.

- [ ] **Step 5: Show the portion editor in create mode**

When `initial.isNew` is set, render `<PortionEditor>` so a food being created can define its
portions. Not shown when logging an existing food.

- [ ] **Step 6: Verify the bug is dead**

Run: `cd fitness-tracker && npm run dev`, open the Food tab, add "Chicken breast", switch the
portion between `1 breast (170 g)` and `100 g`.
Expected: kcal moves between 281 and 165 live, and the entry total follows the quantity.

- [ ] **Step 7: Commit**

```bash
git add fitness-tracker/src/components/FoodPanel.jsx
git commit -m "Replace the two serving boxes with a portion picker that rescales nutrition live"
```

---

### Task 7: Carry portions through the food library

**Files:**
- Modify: `fitness-tracker/src/lib/foodEntries.js` (`toPanelFood`)
- Modify: `fitness-tracker/src/components/TodayFood.jsx` (`saveToLibrary`, `createAndLog`)
- Modify: `fitness-tracker/src/pages/MyFoods.jsx` (form, list rows, category filter)
- Modify: `fitness-tracker/src/components/AddFoodModal.jsx` (`FoodRow` subtitle)

**Interfaces:**
- Consumes: `PortionEditor`, `portions.js` helpers.
- Produces: `toPanelFood(f)` returning a `portions` array, synthesised from `serving_size`/`serving_grams` when the source is an API result; `custom_foods` writes including `portions` and `category`.

- [ ] **Step 1: `toPanelFood` builds portions**

```js
portions: parsePortions(f.portions).length
  ? parsePortions(f.portions)
  : (f.serving_grams > 0
      ? [{ label: stripWeight(f.serving_size) || '1 serving', grams: f.serving_grams }]
      : []),
```

- [ ] **Step 2: `saveToLibrary` and `createAndLog` write `portions` and `category`**

- [ ] **Step 3: `MyFoods.jsx` form swaps serving fields for `PortionEditor`**

Nutrition on this form is entered **per 100 g** — a library food's definition is naturally
per-100g. The row subtitle becomes `179 kcal/100 g · 1 breast (170 g)`.

- [ ] **Step 4: Add a category filter to `MyFoods.jsx`**

Chips: `All`, then each distinct non-empty `category`. Uses the same chip styling as the
muscle-group filter on `Exercises.jsx`.

- [ ] **Step 5: `FoodRow` subtitle in `AddFoodModal.jsx`**

Show the default portion's calories: `{round(scaleTo(per100, defaultPortion.grams).calories)} kcal · {portionLabel(default)}`.

- [ ] **Step 6: Build and click through**

Run: `cd fitness-tracker && npm run build`
Expected: succeeds. Manually: create a food with two portions, log it, edit the entry, confirm
it reopens on the portion it was logged with.

- [ ] **Step 7: Commit**

```bash
git add fitness-tracker/src
git commit -m "Carry portions through the food library, search results and My Foods"
```

---

### Task 8: Convert the starter food library

**Files:**
- Modify: `fitness-tracker/src/lib/starterFoods.js`
- Create: `fitness-tracker/scripts/test-food-data.mjs`
- Modify: `fitness-tracker/package.json` (add `test:food`)

**Interfaces:**
- Produces: `STARTER_FOODS` rows shaped
  `{ name, brand, aliases, category, portions: [{label, grams}], cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g }`.
  The per-serving `calories`/`protein_g`/`carbs_g`/`fat_g` derivation at the bottom of the file is removed.

- [ ] **Step 1: Change the row shape**

```js
// [name, brand, portions, kcal, protein, carbs, fat]   ← nutrition per 100 g
['Chicken breast, skinless, raw', '', [['1 breast', 170], ['100 g', 100]], 165, 31, 0, 3.6],
['Egg, whole',                    '', [['1 large egg', 50]],               143, 12.6, 0.7, 9.5],
['White rice, cooked',            '', [['1 cup', 180], ['100 g', 100]],    130, 2.7, 28, 0.3],
```

Every row converts: the old `serving_size` text loses its weight bracket and becomes the label,
`serving_grams` becomes the grams. Rows whose serving was `'100 g'` become `[['100 g', 100]]`.

- [ ] **Step 2: Add natural second portions**

Chicken gets `1 breast` / `1 thigh` / `1 drumstick`; eggs get `1 large egg`; rice, oats and
pasta get `1 cup`; bread gets `1 slice`. This is what makes "1 drumstick" selectable.

- [ ] **Step 3: Write `scripts/test-food-data.mjs`**

```js
// Data sanity for every seeded food. Run: node scripts/test-food-data.mjs
for (const f of ALL) {
  if (!f.portions.length) fail(`${f.name}: no portions`);
  for (const p of f.portions) {
    if (!p.label.trim()) fail(`${f.name}: portion with no label`);
    if (!(p.grams > 0)) fail(`${f.name}: portion "${p.label}" has no weight`);
  }
  if (!(f.cal_per_100g >= 0 && f.cal_per_100g <= 900)) fail(`${f.name}: ${f.cal_per_100g} kcal/100g out of range`);
  const implied = 4 * f.protein_per_100g + 4 * f.carbs_per_100g + 9 * f.fat_per_100g;
  if (f.cal_per_100g > 20 && Math.abs(implied - f.cal_per_100g) > f.cal_per_100g * 0.25)
    fail(`${f.name}: macros imply ${Math.round(implied)} kcal but says ${f.cal_per_100g}`);
  if (seen.has(key)) fail(`duplicate: ${f.name} / ${f.brand}`);
}
```

- [ ] **Step 4: Run it and fix whatever it catches**

Run: `cd fitness-tracker && node scripts/test-food-data.mjs`
Expected: PASS. Genuine exceptions (alcohol, fibre-heavy foods, sugar alcohols) get an
allow-list entry with a one-line reason rather than a loosened threshold.

- [ ] **Step 5: Add the npm script and commit**

```bash
git add fitness-tracker/src/lib/starterFoods.js fitness-tracker/scripts/test-food-data.mjs fitness-tracker/package.json
git commit -m "Convert the starter food library to portions with per-100g nutrition"
```

---

### Task 9: Real serving options from FatSecret

**Files:**
- Modify: `fitness-tracker/api/_foodSources.js:145-175` (`fatSecretFood`)

**Interfaces:**
- Produces: search and barcode results carrying `portions: [{label, grams}]` built from every
  serving FatSecret returns, not just `servings[0]`.

- [ ] **Step 1: Map all servings into portions**

Each serving with a metric amount in g or ml becomes `{ label: serving_description, grams: metric_serving_amount }`.
Servings without a metric amount are skipped. Keep `serving_size`/`serving_grams` populated
from the first serving so nothing downstream breaks.

- [ ] **Step 2: Check against the live API**

Run: `cd fitness-tracker && node scripts/test-food-search.mjs`
Expected: results print with more than one portion where FatSecret has them. Skips cleanly if
`FATSECRET_CLIENT_ID` is not set.

- [ ] **Step 3: Commit**

```bash
git add fitness-tracker/api/_foodSources.js
git commit -m "Keep every FatSecret serving option instead of only the first"
```

---

### Tasks 10-14: Fast food chains, one per task

**Files (per chain):**
- Create: `fitness-tracker/src/lib/fastFoods/<chain>.js`
- Modify: `fitness-tracker/src/lib/fastFoods/index.js`
- Modify: `fitness-tracker/src/pages/MyFoods.jsx` (chain loader list) — first chain only
- Test: `fitness-tracker/scripts/test-food-data.mjs` covers each new file automatically

**Interfaces:**
- Produces: `FAST_FOODS` (all rows) and `FAST_FOOD_CHAINS` (`[{ key, name, count, rows }]`)
  from `src/lib/fastFoods/index.js`. Rows use the Task 8 shape with
  `brand` = chain name and `category = 'Fast food'`.

Order: **10.** McDonald's NZ · **11.** Subway NZ · **12.** KFC NZ · **13.** Burger King NZ ·
**14.** Domino's NZ.

Per chain:

- [ ] **Step 1: Write the chain file**

Header comment records the source and date read. Per-100g is computed from the published
per-item values and the published item weight: `per100 = perItem × 100 / itemGrams`. Any
unpublished weight is marked `// ESTIMATE` on its row.

- [ ] **Step 2: Give each item realistic portions**

`[['1 Big Mac', 219]]`, `[['6 nuggets', 108], ['9 nuggets', 162], ['20 nuggets', 360]]`,
`[['Small', 77], ['Medium', 110], ['Large', 150]]`, `[['6 inch', 220], ['Footlong', 440]]`,
`[['1 slice', 95]]`. Weights shown here are shape examples — use the published figures.

- [ ] **Step 3: Register it in `index.js`**

- [ ] **Step 4: Run the data check**

Run: `cd fitness-tracker && node scripts/test-food-data.mjs`
Expected: PASS. A macro/calorie mismatch here almost always means a transcription slip — go
back to the published table rather than widening the tolerance.

- [ ] **Step 5: Add the loader entry (first chain only)**

`MyFoods.jsx` gets a Fast food section listing each chain with its item count and an Add
button, using the same duplicate-safe upsert as the starter foods loader.

- [ ] **Step 6: Commit and summarise**

```bash
git add fitness-tracker/src/lib/fastFoods fitness-tracker/src/pages/MyFoods.jsx
git commit -m "Add <chain> NZ menu nutrition as loadable fast food"
```

Then print a summary for the owner: item count, a table of several items with
kcal/protein/weight, and the source used.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| 4.1 bug — nutrition must always rescale | 4, 6 |
| 4.2 remove the two redundant boxes | 6 |
| 4.3 portion list, natural default, edit reopens on logged portion | 1, 6, 8 |
| 5.3 migrations and invariant backfill | 2, 3 |
| 5.4 `portions.js`, `food.js`, `PortionEditor`, `FoodPanel`, `foodEntries`, `TodayFood`, `MyFoods`, `starterFoods` | 1, 4, 5, 6, 7, 8 |
| 5.4 optional FatSecret multi-serving | 9 |
| 6 fast food library, category, loader, chain order, per-chain summary | 10-14 |
| 8 testing — portion maths, custom weight, invariance, labels, data sanity | 1, 2, 4, 8 |

**Placeholder scan:** none. Task 9 is marked optional in the spec but is specified in full here.

**Type consistency:** `{ label, grams }` is the portion shape throughout. `parsePortions`,
`portionLabel`, `defaultPortion`, `portionOptions`, `scaleTo`, `scaleFrom` keep the same names
in Tasks 1, 4, 6, 7 and 8. Entry fields are `quantity`, `portion_label`, `portion_grams`
everywhere.
