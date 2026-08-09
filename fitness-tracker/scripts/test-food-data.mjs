// Sanity check over every seeded food — the starter library and each fast food
// chain. Run from fitness-tracker/:  node scripts/test-food-data.mjs
//
// The macro/calorie cross-check is the useful one for hand-entered menu data: a
// transcription slip in a calorie or a gram figure almost always shows up as
// the macros no longer implying the stated calories.
import { STARTER_FOODS } from '../src/lib/starterFoods.js';
import { FAST_FOOD_CHAINS } from '../src/lib/fastFoods/index.js';

let pass = 0;
const failures = [];
function fail(msg) { failures.push(msg); }

// Foods where macros genuinely do not imply the calories, with the reason.
// Alcohol carries 7 kcal/g that no macro column records; sugar alcohols and
// fibre are counted as carbs but yield far less energy.
const MACRO_EXEMPT = new Set([
  'Beer, full strength', 'Beer, light', 'Wine, red', 'Wine, white', 'Spirits, 40%',
  'Vegemite', 'Salt', 'Creatine monohydrate', 'Water', 'Coke Zero',
  'Electrolyte drink, sugar free', 'Stock, chicken, prepared', 'Coffee, black',
  'Tea, black no milk', 'Green tea', 'Seaweed snack, roasted', 'Sports drink',
  'Vinegar, balsamic', 'Fish sauce', 'Soy sauce', 'Mustard', 'Papadum',
  'Long Black',
  // Mostly fibre by weight: fibre sits in the carbs column but yields about
  // 2 kcal/g rather than 4, so the 4/4/9 estimate overshoots.
  'Spinach, raw', 'Mushrooms, button',
]);

function checkGroup(label, foods) {
  console.log(`\n${label} (${foods.length} foods):`);
  const seen = new Set();
  const before = failures.length;

  for (const f of foods) {
    const where = f.brand ? `${f.name} [${f.brand}]` : f.name;

    const key = `${f.name.toLowerCase()}|${(f.brand || '').toLowerCase()}`;
    if (seen.has(key)) fail(`${where}: duplicate row`);
    seen.add(key);

    if (!Array.isArray(f.portions) || f.portions.length === 0) {
      fail(`${where}: no portions`);
    } else {
      for (const p of f.portions) {
        if (!String(p.label || '').trim()) fail(`${where}: a portion has no label`);
        if (!(p.grams > 0)) fail(`${where}: portion "${p.label}" has no weight`);
        // The label must not repeat the weight — that duplication is exactly
        // what the portion model exists to remove.
        if (/\(\s*[\d.]+\s*(g|ml)\s*\)/i.test(p.label)) {
          fail(`${where}: portion "${p.label}" repeats its weight in the label`);
        }
      }
    }

    const cal = f.cal_per_100g;
    if (!(cal >= 0 && cal <= 900)) {
      fail(`${where}: ${cal} kcal/100 g is out of range (0-900)`);
    }

    if (!MACRO_EXEMPT.has(f.name) && cal > 20) {
      const implied = 4 * (f.protein_per_100g || 0)
        + 4 * (f.carbs_per_100g || 0)
        + 9 * (f.fat_per_100g || 0);
      if (Math.abs(implied - cal) > cal * 0.25) {
        fail(`${where}: macros imply ${Math.round(implied)} kcal/100 g but the row says ${cal}`);
      }
    }
  }

  const added = failures.length - before;
  if (added === 0) { pass++; console.log(`  PASS all ${foods.length} rows`); }
  else console.log(`  FAIL ${added} problem(s)`);
}

checkGroup('Starter foods', STARTER_FOODS);
for (const chain of FAST_FOOD_CHAINS) {
  checkGroup(`${chain.name} NZ`, chain.rows);
}

if (failures.length) {
  console.log('\nProblems:');
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`\n${pass} group(s) clean, ${failures.length} problem(s)`);
process.exit(failures.length ? 1 : 0);
