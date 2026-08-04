// Checks the food totals math. Run from fitness-tracker/:  node scripts/test-food-math.mjs
// Exits non-zero if anything fails, so it works as a pre-commit sanity check.
import { entryTotals, dayTotals, recentFoods, amountLabel, UNIT_TO_GRAMS } from '../src/lib/food.js';
import {
  parsePortions, portionLabel, defaultPortion, portionOptions, scaleTo, scaleFrom, stripWeight,
} from '../src/lib/portions.js';

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.01;
  if (ok) { pass++; console.log(`  PASS ${name} = ${actual}`); }
  else { fail++; console.log(`  FAIL ${name}: got ${actual}, expected ${expected}`); }
}
function checkStr(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  PASS ${name} = "${actual}"`); }
  else { fail++; console.log(`  FAIL ${name}: got "${actual}", expected "${expected}"`); }
}

console.log('portion vocabulary:');
checkStr('composed label', portionLabel({ label: '1 drumstick', grams: 90 }), '1 drumstick (90 g)');
checkStr('pure weight label passes through', portionLabel({ label: '100 g', grams: 100 }), '100 g');
checkStr('default when empty', defaultPortion([]).label, '100 g');
checkStr('default is the first portion', defaultPortion([{ label: '1 egg', grams: 50 }, { label: '100 g', grams: 100 }]).label, '1 egg');
checkStr('parse drops junk', String(parsePortions([{ label: '', grams: 5 }, { label: 'x', grams: 0 }]).length), '0');
checkStr('parse accepts a JSON string', parsePortions('[{"label":"1 egg","grams":50}]')[0].label, '1 egg');
checkStr('parse survives nonsense', String(parsePortions('not json').length), '0');
checkStr('100 g appended when absent', portionOptions([{ label: '1 egg', grams: 50 }])[1].label, '100 g');
checkStr('100 g not duplicated', String(portionOptions([{ label: '100 g', grams: 100 }]).length), '1');
checkStr('strip trailing weight', stripWeight('1 breast (170 g)'), '1 breast');
checkStr('strip leaves plain labels', stripWeight('2 biscuits'), '2 biscuits');
check('scaleTo 90 g of 179/100g', scaleTo({ calories: 179 }, 90).calories, 161.1);
check('scaleFrom round trip', scaleFrom(scaleTo({ calories: 179 }, 90), 90).calories, 179);

console.log('\nportion entries:');
const portionEntry = {
  quantity: 1.5, portion_label: '1 drumstick', portion_grams: 90,
  cal_per_100g: 179, protein_per_100g: 24.8, carbs_per_100g: 0, fat_per_100g: 8.2,
};
check('1.5 x 90 g of 179/100g', entryTotals(portionEntry).calories, 241.65);
check('1.5 x 90 g protein', entryTotals(portionEntry).protein, 33.48);
checkStr('portion label', amountLabel(portionEntry), '1.5 × 1 drumstick (90 g)');
checkStr('pure weight label', amountLabel({ quantity: 150, portion_label: 'g', portion_grams: 1, cal_per_100g: 1 }), '150 g');
checkStr('oz reads back as typed', amountLabel({ quantity: 3.5, portion_label: 'oz', portion_grams: 28.35, cal_per_100g: 1 }), '3.5 oz');

console.log('\nlegacy servings mode still works:');
const servingsEntry = { quantity_mode: 'servings', servings: 2, calories: 110, protein_g: 2, carbs_g: 22, fat_g: 1.5 };
check('2 servings x 110 kcal', entryTotals(servingsEntry).calories, 220);
check('2 servings protein', entryTotals(servingsEntry).protein, 4);

console.log('\nlegacy grams mode (Cheerios per-100g 393 kcal):');
const gramsEntry = { quantity_mode: 'grams', grams: 50, cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 };
check('50 g of 393/100g', entryTotals(gramsEntry).calories, 196.5);
check('50 g protein', entryTotals(gramsEntry).protein, 3.55);

console.log('\noz conversion (3.5 oz -> grams):');
const ozGrams = 3.5 * UNIT_TO_GRAMS.oz;
check('3.5 oz in grams', ozGrams, 99.225);
const ozEntry = { quantity_mode: 'grams', grams: ozGrams, cal_per_100g: 393, input_amount: 3.5, input_unit: 'oz' };
check('3.5 oz of 393/100g', entryTotals(ozEntry).calories, 389.95);
checkStr('legacy oz label shows what was typed', amountLabel(ozEntry), '3.5 oz');

console.log('\nfallback: grams mode but no per-100g data -> uses servings:');
const noBasis = { quantity_mode: 'grams', grams: 50, cal_per_100g: null, servings: 3, calories: 100 };
check('falls back to servings', entryTotals(noBasis).calories, 300);

console.log('\nday totals mix legacy servings + grams:');
check('220 + 196.5', dayTotals([servingsEntry, gramsEntry]).calories, 416.5);

console.log('\nrecents dedupe by name, newest first:');
const recents = recentFoods([
  { food_name: 'Nutella' }, { food_name: 'nutella' }, { food_name: 'Coke' }, { food_name: 'Nutella' },
]);
checkStr('deduped count', String(recents.length), '2');
checkStr('first is newest', recents[0].food_name, 'Nutella');

console.log('\nlegacy labels:');
checkStr('servings label', amountLabel({ quantity_mode: 'servings', servings: 1.5, serving_size: '30 g' }), '1.5 × 30 g');
checkStr('grams label', amountLabel({ quantity_mode: 'grams', grams: 99.225, input_unit: 'g' }), '99.2 g');

// ── Migration invariance ────────────────────────────────────────────────────
// The guard on the riskiest part of this change. Migration 011 reinterprets
// every row already in food_entries; if it shifts a single day's totals, real
// logged history silently changes. backfill() below mirrors what the SQL does.
// If the two ever disagree, the SQL is the one that is wrong.

function backfill(e) {
  const out = { ...e };
  if (e.quantity_mode === 'grams') {
    if (e.input_amount != null) {
      out.portion_label = e.input_unit || 'g';
      out.portion_grams = UNIT_TO_GRAMS[e.input_unit || 'g'] ?? 1;
      out.quantity = e.input_amount;
    } else {
      out.portion_label = 'g';
      out.portion_grams = 1;
      out.quantity = e.grams;
    }
  } else {
    out.quantity = e.servings ?? 1;
    if (e.serving_grams > 0) {
      out.portion_label = stripWeight(e.serving_size) || '1 serving';
      out.portion_grams = e.serving_grams;
      // Derive per-100g from this entry's own per-serving snapshot rather than
      // trusting the stored per-100g columns. The per-serving values are what
      // the old maths actually used — and they were rounded when saved, so the
      // two disagree by a hair. Deriving keeps the total byte-exact.
      if (e.calories != null) {
        const f = 100 / e.serving_grams;
        out.cal_per_100g = (e.calories || 0) * f;
        out.protein_per_100g = (e.protein_g || 0) * f;
        out.carbs_per_100g = (e.carbs_g || 0) * f;
        out.fat_per_100g = (e.fat_g || 0) * f;
      }
    } else if (e.cal_per_100g != null) {
      out.portion_label = '100 g';
      out.portion_grams = 100;
    } else {
      // No weight anywhere. A serving becomes a 100 g-equivalent unit whose
      // per-100g values are the old per-serving values, so the arithmetic lands
      // on exactly the same numbers. That gram figure is a unit, not a weight.
      out.portion_label = stripWeight(e.serving_size) || '1 serving';
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
  { name: 'servings with weight', quantity_mode: 'servings', servings: 2, serving_size: '1 breast (170 g)', serving_grams: 170,
    calories: 280.5, protein_g: 52.7, carbs_g: 0, fat_g: 6.1,
    cal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'servings, no weight, no per-100g', quantity_mode: 'servings', servings: 1.5, serving_size: '1 sachet',
    calories: 60, protein_g: 1, carbs_g: 12, fat_g: 0.5 },
  { name: 'servings, no weight, has per-100g', quantity_mode: 'servings', servings: 1, serving_size: '1 serving',
    calories: 393, protein_g: 7.1, carbs_g: 78.6, fat_g: 5.4,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'servings, missing servings count', quantity_mode: 'servings', serving_size: '1 tub (170 g)', serving_grams: 170,
    calories: 100.3, protein_g: 17, carbs_g: 6.1, fat_g: 0.7,
    cal_per_100g: 59, protein_per_100g: 10, carbs_per_100g: 3.6, fat_per_100g: 0.4 },
  { name: 'grams mode', quantity_mode: 'grams', grams: 50, input_unit: 'g', input_amount: 50,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'oz mode', quantity_mode: 'grams', grams: 99.225, input_unit: 'oz', input_amount: 3.5,
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'ml mode', quantity_mode: 'grams', grams: 250, input_unit: 'ml', input_amount: 250,
    cal_per_100g: 64, protein_per_100g: 3.3, carbs_per_100g: 4.7, fat_per_100g: 3.5 },
  { name: 'grams mode, no input_amount', quantity_mode: 'grams', grams: 75, input_unit: 'g',
    cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 },
  { name: 'grams mode, no basis', quantity_mode: 'grams', grams: 50, input_unit: 'g', input_amount: 50,
    servings: 3, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 },
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
