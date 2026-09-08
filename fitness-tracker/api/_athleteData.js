// Read-only data access for the Athlete OS connector (api/mcp.js).
//
// Signs in to Supabase as the FitTrack user with the email/password from the
// environment, so Supabase's row-level security guarantees the connector can
// only ever see that one user's rows. Every function here only SELECTs.
// Nothing in this file, or in the connector, writes to the database.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TZ = process.env.FITTRACK_TZ || 'Pacific/Auckland';

// ---- auth (cached across warm invocations) --------------------------------

let cached = null; // { client, userId, expiresAt }

export async function getClient() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached;

  const email = process.env.FITTRACK_EMAIL;
  const password = process.env.FITTRACK_PASSWORD;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL / anon key are not set in the environment.');
  }
  if (!email || !password) {
    throw new Error('FITTRACK_EMAIL and FITTRACK_PASSWORD are not set in the environment.');
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`FitTrack sign-in failed: ${error.message}`);

  cached = {
    client,
    userId: data.user.id,
    expiresAt: data.session?.expires_at || now + 3000,
  };
  return cached;
}

// ---- dates ------------------------------------------------------------------

// Today's date (yyyy-MM-dd) in the user's time zone, not the server's.
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function daysAgoISO(days) {
  const d = new Date(`${todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function clampCount(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

// ---- formatting helpers -----------------------------------------------------

export function epley1RM(weightKg, reps) {
  if (!weightKg || weightKg <= 0) return 0;
  if (!reps || reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function fmtDuration(seconds) {
  const s = Math.round(seconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// One set as a compact string, e.g. "85x5", "BWx12", "5km / 25:00", "80x5 (drop)".
export function formatSet(s) {
  const parts = [];
  const w = s.weight_kg || 0;
  const reps = s.reps || 0;
  if (reps > 0) parts.push(w > 0 ? `${w}x${reps}` : `BWx${reps}`);
  else if (w > 0) parts.push(`${w}kg`);
  if (s.distance > 0) parts.push(`${s.distance}${s.distance_unit || ''}`);
  if (s.duration_seconds > 0) parts.push(fmtDuration(s.duration_seconds));
  let out = parts.join(' / ') || '-';
  if (s.set_type && s.set_type !== 'normal') out += ` (${s.set_type})`;
  return out;
}

function round1(n) { return Math.round(n * 10) / 10; }

// Supabase caps each request at 1000 rows; page until a short page comes back.
const PAGE = 1000;
async function fetchAllRows(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if ((data || []).length < PAGE) return rows;
  }
}

// ---- queries ----------------------------------------------------------------

async function exerciseCategories(client, userId) {
  const { data } = await client
    .from('exercises')
    .select('name, category, track_type')
    .eq('user_id', userId);
  const map = new Map();
  for (const e of data || []) map.set(e.name.toLowerCase(), e);
  return map;
}

function summariseExercise(name, sets, catMap) {
  const meta = catMap.get(name.toLowerCase());
  let best = 0;
  let volume = 0;
  for (const s of sets) {
    best = Math.max(best, epley1RM(s.weight_kg, s.reps));
    volume += (s.weight_kg || 0) * (s.reps || 0);
  }
  const out = {
    exercise: name,
    category: meta?.category || '',
    sets: sets.map(formatSet),
  };
  if (best > 0) out.best_e1rm_kg = best;
  if (volume > 0) out.volume_kg = round1(volume);
  return out;
}

export async function getRecentWorkouts({ days } = {}) {
  const n = clampCount(days, 14, 365);
  const { client, userId } = await getClient();
  const since = daysAgoISO(n);
  const today = todayISO();

  const { data: workouts, error } = await client
    .from('workouts')
    .select('id, date, notes')
    .eq('user_id', userId)
    .gte('date', since)
    .lte('date', today)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (workouts || []).map((w) => w.id);
  let sets = [];
  if (ids.length) {
    sets = await fetchAllRows(() => client
      .from('workout_sets')
      .select('id, workout_id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_type, set_order')
      .in('workout_id', ids)
      .order('set_order', { ascending: true }));
  }
  const catMap = await exerciseCategories(client, userId);

  const sessions = [];
  for (const w of workouts || []) {
    const mine = sets.filter((s) => s.workout_id === w.id);
    if (mine.length === 0 && !w.notes) continue;
    // Group sets by exercise, preserving the order they were first logged
    const groups = new Map();
    for (const s of mine) {
      if (!groups.has(s.exercise_name)) groups.set(s.exercise_name, []);
      groups.get(s.exercise_name).push(s);
    }
    sessions.push({
      date: w.date,
      notes: w.notes || undefined,
      total_sets: mine.length,
      exercises: [...groups].map(([name, ss]) => summariseExercise(name, ss, catMap)),
    });
  }

  return { timezone: TZ, from: since, to: today, session_count: sessions.length, sessions };
}

export async function getExerciseHistory({ exercise, sessions } = {}) {
  const q = String(exercise || '').trim();
  if (q.length < 2) throw new Error('exercise must be at least 2 characters.');
  const limit = clampCount(sessions, 10, 100);
  const { client, userId } = await getClient();

  const rows = await fetchAllRows(() => client
    .from('workout_sets')
    .select('id, exercise_name, weight_kg, reps, distance, distance_unit, duration_seconds, set_type, set_order, workouts!inner(date, user_id)')
    .eq('workouts.user_id', userId)
    .ilike('exercise_name', `%${q.replace(/[%_]/g, '')}%`)
    .order('set_order', { ascending: true }));
  const names = [...new Set(rows.map((r) => r.exercise_name))];
  if (names.length === 0) return { query: q, matches: [], message: 'No exercise matched.' };

  // Exact name wins; otherwise a single fuzzy match; otherwise ask the caller to pick
  let name = names.find((n) => n.toLowerCase() === q.toLowerCase());
  if (!name && names.length === 1) name = names[0];
  if (!name) {
    return { query: q, matches: names, message: 'Several exercises matched. Call again with the exact name.' };
  }

  const catMap = await exerciseCategories(client, userId);
  const byDate = new Map();
  for (const r of rows) {
    if (r.exercise_name !== name) continue;
    const d = r.workouts.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }
  const dates = [...byDate.keys()].sort().reverse();

  let allTimeBest = null;
  for (const d of dates) {
    for (const s of byDate.get(d)) {
      const e = epley1RM(s.weight_kg, s.reps);
      if (e > 0 && (!allTimeBest || e > allTimeBest.e1rm_kg)) {
        allTimeBest = { date: d, set: formatSet(s), e1rm_kg: e };
      }
    }
  }

  return {
    exercise: name,
    category: catMap.get(name.toLowerCase())?.category || '',
    total_sessions: dates.length,
    all_time_best: allTimeBest || undefined,
    sessions: dates.slice(0, limit).map((d) => {
      const s = summariseExercise(name, byDate.get(d), catMap);
      return { date: d, sets: s.sets, best_e1rm_kg: s.best_e1rm_kg, volume_kg: s.volume_kg };
    }),
  };
}

export async function getFoodLog({ days } = {}) {
  const n = clampCount(days, 7, 365);
  const { client, userId } = await getClient();
  const since = daysAgoISO(n);
  const today = todayISO();

  const [entriesRes, settingsRes] = await Promise.all([
    client
      .from('food_entries')
      .select('date, meal_type, food_name, quantity, portion_label, portion_grams, servings, serving_size, calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today)
      .order('date', { ascending: false })
      .order('created_at', { ascending: true }),
    client.from('user_settings').select('goal_calories, goal_protein_g').eq('user_id', userId).maybeSingle(),
  ]);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const byDate = new Map();
  for (const e of entriesRes.data || []) {
    if (!byDate.has(e.date)) {
      byDate.set(e.date, { date: e.date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entries: [] });
    }
    const day = byDate.get(e.date);
    day.calories += e.calories || 0;
    day.protein_g += e.protein_g || 0;
    day.carbs_g += e.carbs_g || 0;
    day.fat_g += e.fat_g || 0;
    const qty = e.quantity ?? 1;
    const amount = e.portion_label
      ? `${qty} x ${e.portion_label}${e.portion_grams ? ` (${round1(e.portion_grams * qty)} g)` : ''}`
      : `${e.servings ?? 1} x ${e.serving_size || 'serving'}`;
    day.entries.push({
      meal: e.meal_type,
      food: e.food_name,
      amount,
      kcal: Math.round(e.calories || 0),
      p: round1(e.protein_g || 0),
      c: round1(e.carbs_g || 0),
      f: round1(e.fat_g || 0),
    });
  }
  const daysOut = [...byDate.values()].map((d) => ({
    ...d,
    calories: Math.round(d.calories),
    protein_g: round1(d.protein_g),
    carbs_g: round1(d.carbs_g),
    fat_g: round1(d.fat_g),
  }));

  const logged = daysOut.length;
  const avg = (k) => (logged ? round1(daysOut.reduce((a, d) => a + d[k], 0) / logged) : 0);

  return {
    timezone: TZ,
    from: since,
    to: today,
    goals: settingsRes.data || undefined,
    days_logged: logged,
    daily_average: logged
      ? { calories: Math.round(avg('calories')), protein_g: avg('protein_g'), carbs_g: avg('carbs_g'), fat_g: avg('fat_g') }
      : undefined,
    days: daysOut,
  };
}

export async function getWeightLog({ days } = {}) {
  const n = clampCount(days, 90, 3650);
  const { client, userId } = await getClient();
  const since = daysAgoISO(n);

  const { data, error } = await client
    .from('body_weights')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data || [];
  if (rows.length === 0) {
    return { from: since, to: todayISO(), entries: [], message: 'No body weight entries in this range.' };
  }

  const latest = rows[0];
  const oldest = rows[rows.length - 1];
  const last7 = rows.filter((r) => r.date >= daysAgoISO(7));
  const avg7 = last7.length ? round1(last7.reduce((a, r) => a + r.weight_kg, 0) / last7.length) : undefined;

  return {
    from: since,
    to: todayISO(),
    latest,
    change_kg: round1(latest.weight_kg - oldest.weight_kg),
    seven_day_average_kg: avg7,
    entries: rows,
  };
}
