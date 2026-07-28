// Checks the food totals math. Run from fitness-tracker/:  node scripts/test-food-math.mjs
// Exits non-zero if anything fails, so it works as a pre-commit sanity check.
import { entryTotals, dayTotals, recentFoods, amountLabel, UNIT_TO_GRAMS } from '../src/lib/food.js';

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

console.log('servings mode:');
const servingsEntry = { quantity_mode: 'servings', servings: 2, calories: 110, protein_g: 2, carbs_g: 22, fat_g: 1.5 };
check('2 servings x 110 kcal', entryTotals(servingsEntry).calories, 220);
check('2 servings protein', entryTotals(servingsEntry).protein, 4);

console.log('\ngrams mode (Cheerios per-100g 393 kcal):');
const gramsEntry = { quantity_mode: 'grams', grams: 50, cal_per_100g: 393, protein_per_100g: 7.1, carbs_per_100g: 78.6, fat_per_100g: 5.4 };
check('50 g of 393/100g', entryTotals(gramsEntry).calories, 196.5);
check('50 g protein', entryTotals(gramsEntry).protein, 3.55);

console.log('\noz conversion (3.5 oz -> grams):');
const ozGrams = 3.5 * UNIT_TO_GRAMS.oz;
check('3.5 oz in grams', ozGrams, 99.225);
const ozEntry = { quantity_mode: 'grams', grams: ozGrams, cal_per_100g: 393, input_amount: 3.5, input_unit: 'oz' };
check('3.5 oz of 393/100g', entryTotals(ozEntry).calories, 389.95);
checkStr('oz label shows what was typed', amountLabel(ozEntry), '3.5 oz');

console.log('\nfallback: grams mode but no per-100g data -> uses servings:');
const noBasis = { quantity_mode: 'grams', grams: 50, cal_per_100g: null, servings: 3, calories: 100 };
check('falls back to servings', entryTotals(noBasis).calories, 300);

console.log('\nday totals mix servings + grams:');
check('220 + 196.5', dayTotals([servingsEntry, gramsEntry]).calories, 416.5);

console.log('\nrecents dedupe by name, newest first:');
const recents = recentFoods([
  { food_name: 'Nutella' }, { food_name: 'nutella' }, { food_name: 'Coke' }, { food_name: 'Nutella' },
]);
checkStr('deduped count', String(recents.length), '2');
checkStr('first is newest', recents[0].food_name, 'Nutella');

console.log('\nlabels:');
checkStr('servings label', amountLabel({ quantity_mode: 'servings', servings: 1.5, serving_size: '30 g' }), '1.5 × 30 g');
checkStr('grams label', amountLabel({ quantity_mode: 'grams', grams: 99.225, input_unit: 'g' }), '99.2 g');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
