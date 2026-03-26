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
