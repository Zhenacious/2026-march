// Checks which sets get the "PR!" badge on the Today page.
// Pure maths, no database. Run: node scripts/test-pr-badge.mjs
import { computePrSetIds, e1rmOf } from '../src/lib/personalRecords.js';

const weightReps = () => 'weight_reps';

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
  if (!ok) failed++;
}
const ids = (sets, stats, type = weightReps) => [...computePrSetIds(sets, stats, type)];

// Epley maths
check('100 kg x 8 is 126.7', e1rmOf({ weight_kg: 100, reps: 8 }), 126.7);
check('a set with no reps scores nothing', e1rmOf({ weight_kg: 100, reps: 0 }), 0);
check('bodyweight-style set scores nothing', e1rmOf({ weight_kg: 0, reps: 10 }), 0);

// The reported bug: best ever is 120. Today the user beats it, then repeats
// the same set. Only the FIRST of the two is a record.
const bench = { Bench: { bestE1RM: 120 } };
check('a set that beats the old best is a PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
], bench), ['a']);
check('repeating the record set is NOT a second PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
  { id: 'b', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
], bench), ['a']);
check('same weight for fewer reps is not a PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
  { id: 'b', exercise_name: 'Bench', weight_kg: 100, reps: 6 },
], bench), ['a']);
check('beating it again later in the day is another PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
  { id: 'b', exercise_name: 'Bench', weight_kg: 100, reps: 6 },
  { id: 'c', exercise_name: 'Bench', weight_kg: 105, reps: 8 },
], bench), ['a', 'c']);
check('matching the all-time best exactly is not a PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 120, reps: 0 },
  { id: 'b', exercise_name: 'Bench', weight_kg: 90, reps: 10 },
], { Bench: { bestE1RM: 120 } }), []);
check('a lighter set after a PR is not a PR', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
  { id: 'b', exercise_name: 'Bench', weight_kg: 60, reps: 12 },
], bench), ['a']);

// Exercises are scored separately
check('two exercises keep their own records', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
  { id: 'b', exercise_name: 'Squat', weight_kg: 100, reps: 8 },
  { id: 'c', exercise_name: 'Bench', weight_kg: 100, reps: 8 },
], { Bench: { bestE1RM: 120 }, Squat: { bestE1RM: 200 } }), ['a']);

// Guards
check('no badge before history has loaded', ids([
  { id: 'a', exercise_name: 'Bench', weight_kg: 300, reps: 10 },
], {}), []);
check('cardio sets never get a PR badge', ids([
  { id: 'a', exercise_name: 'Row', weight_kg: 100, reps: 8 },
], { Row: { bestE1RM: 0 } }, () => 'distance'), []);
check('an empty day has no records', ids([], bench), []);

console.log(failed === 0 ? '\nAll PR badge checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
