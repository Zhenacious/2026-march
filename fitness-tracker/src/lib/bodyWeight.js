const STORAGE_KEY = 'fittrack_body_weights';

export function loadBodyWeights() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function saveBodyWeights(weights) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
}

// Returns the most recent body weight on or before the given date string (yyyy-MM-dd)
export function getBodyWeightForDate(date, bodyWeights) {
  if (!bodyWeights?.length) return null;
  const sorted = [...bodyWeights].sort((a, b) => b.date.localeCompare(a.date));
  const entry = sorted.find((e) => e.date <= date);
  return entry ? entry.weight_kg : null;
}

// Returns the latest body weight entry regardless of date
export function getLatestBodyWeight(bodyWeights) {
  if (!bodyWeights?.length) return null;
  return [...bodyWeights].sort((a, b) => b.date.localeCompare(a.date))[0];
}

// A set is bodyweight if weight = 0 and reps > 0
export function isBodyweightSet(weightKg, reps) {
  return (weightKg || 0) === 0 && (reps || 0) > 0;
}

// For a bodyweight set, substitute the tracked body weight; otherwise use the logged weight
export function effectiveWeight(weightKg, reps, date, bodyWeights) {
  if (isBodyweightSet(weightKg, reps)) {
    return getBodyWeightForDate(date, bodyWeights) || 0;
  }
  return weightKg || 0;
}

// Epley estimated 1RM
export function epley1RM(weightKg, reps) {
  if (!weightKg || weightKg <= 0) return 0;
  if (!reps || reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Database-backed storage (table: body_weights). localStorage is kept as a
// local cache so the pages that only need a quick synchronous read (history,
// records) still work, and as a fallback if the table isn't available yet.
// ---------------------------------------------------------------------------
import { supabase } from './supabase';

function sortDesc(rows) {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

// Load from the database. On first load after the switch from localStorage,
// any entries that only exist locally are pushed up so nothing is lost.
export async function fetchBodyWeights(userId) {
  const local = loadBodyWeights();
  const { data, error } = await supabase
    .from('body_weights')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.warn('body_weights unavailable, using local copy:', error.message);
    return { weights: sortDesc(local), source: 'local' };
  }

  let rows = data || [];
  if (rows.length === 0 && local.length > 0) {
    const { error: upErr } = await supabase
      .from('body_weights')
      .upsert(local.map((e) => ({ user_id: userId, date: e.date, weight_kg: e.weight_kg })), {
        onConflict: 'user_id,date',
      });
    if (!upErr) rows = local;
  }

  saveBodyWeights(rows);
  return { weights: sortDesc(rows), source: 'db' };
}

export async function upsertBodyWeight(userId, date, weightKg) {
  const { error } = await supabase
    .from('body_weights')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
  const updated = [...loadBodyWeights().filter((e) => e.date !== date), { date, weight_kg: weightKg }];
  saveBodyWeights(updated);
  return sortDesc(updated);
}

export async function deleteBodyWeight(userId, date) {
  const { error } = await supabase
    .from('body_weights')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw new Error(error.message);
  const updated = loadBodyWeights().filter((e) => e.date !== date);
  saveBodyWeights(updated);
  return sortDesc(updated);
}
