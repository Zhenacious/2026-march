// The connector reads with Supabase's service-role key, which ignores
// row-level security. So the code itself must scope every query to the one
// user the link belongs to. This test runs each data function against a fake
// client that records every query, then checks each one is scoped.
// Run: node scripts/test-connector-scope.mjs
import {
  getRecentWorkouts, getExerciseHistory, getFoodLog, getWeightLog,
} from '../api/_connectorData.js';

const USER = 'user-a';
const USER_WORKOUT_IDS = ['w1'];

// Rows the fake returns per table, so the code goes down its full path
const FIXTURES = {
  workouts: [{ id: 'w1', date: '2026-10-15', notes: null }],
  workout_sets: [{
    id: 's1', workout_id: 'w1', exercise_name: 'Bench Press', weight_kg: 100, reps: 5,
    set_order: 1, workouts: { date: '2026-10-15', user_id: USER, notes: null },
  }],
  exercises: [{ name: 'Bench Press', category: 'chest', track_type: 'weight_reps' }],
  food_entries: [],
  user_settings: null,
  body_weights: [{ date: '2026-10-15', weight_kg: 80 }],
};

function fakeClient(log) {
  return {
    from(table) {
      const q = { table, calls: [] };
      log.push(q);
      const builder = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            const data = FIXTURES[table];
            return (resolve) => resolve({ data, error: null });
          }
          if (prop === 'maybeSingle') {
            return () => Promise.resolve({ data: FIXTURES[table], error: null });
          }
          return (...args) => { q.calls.push([prop, ...args]); return builder; };
        },
      });
      return builder;
    },
  };
}

function isScoped(q) {
  const has = (method, col, val) => q.calls.some(([m, c, v]) =>
    m === method && c === col && JSON.stringify(v) === JSON.stringify(val));
  if (has('eq', 'user_id', USER)) return true;
  if (q.table === 'workout_sets') {
    return has('eq', 'workouts.user_id', USER) || has('in', 'workout_id', USER_WORKOUT_IDS);
  }
  return false;
}

let failed = 0;
async function checkFn(label, fn, args) {
  const log = [];
  try {
    await fn(args, { client: fakeClient(log), userId: USER });
  } catch (err) {
    console.log(`FAIL  ${label} threw: ${err.message}`);
    failed++;
    return;
  }
  const bad = log.filter((q) => !isScoped(q));
  const ok = log.length > 0 && bad.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} (${log.length} queries)${ok ? '' : `  unscoped: ${bad.map((q) => q.table).join(', ') || 'no queries ran'}`}`);
  if (!ok) failed++;
}

await checkFn('get_recent_workouts only reads this user', getRecentWorkouts, { days: 14 });
await checkFn('get_exercise_history only reads this user', getExerciseHistory, { exercise: 'bench' });
await checkFn('get_food_log only reads this user', getFoodLog, { days: 7 });
await checkFn('get_weight_log only reads this user', getWeightLog, { days: 30 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
