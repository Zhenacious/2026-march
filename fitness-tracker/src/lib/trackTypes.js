// How an exercise is measured. Stored on exercises.track_type.
//   weight_reps   — weight (kg) + reps          (default; e1RM / volume apply)
//   time          — duration only               (plank, dead hang, stretch)
//   distance_time — distance (+ unit) + duration (run, row, cycle)

export const DEFAULT_TRACK_TYPE = 'weight_reps';

export const TRACK_TYPES = [
  { value: 'weight_reps', label: 'Weight & reps', short: 'Weight' },
  { value: 'time', label: 'Time', short: 'Time' },
  { value: 'distance_time', label: 'Distance & time', short: 'Distance' },
];

export const DISTANCE_UNITS = ['km', 'mi', 'm'];

export function trackTypeLabel(value) {
  return (TRACK_TYPES.find((t) => t.value === value) || TRACK_TYPES[0]).label;
}

export function trackTypeShort(value) {
  return (TRACK_TYPES.find((t) => t.value === value) || TRACK_TYPES[0]).short;
}

// Sensible default when seeding the starter library or importing.
export function defaultTrackTypeForCategory(category) {
  return (category || '').toLowerCase() === 'mobility' ? 'time' : DEFAULT_TRACK_TYPE;
}

// ── Time helpers ──────────────────────────────────────────────────────────
export function secondsToHMS(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

export function hmsToSeconds(h, m, s) {
  return (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
}

// "1:05:09" when there are hours, otherwise "5:09"
export function formatDuration(totalSeconds) {
  const { h, m, s } = secondsToHMS(totalSeconds);
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

// ── Entry-pad value helpers ─────────────────────────────────────────────────
// A single "values" shape covers every type; only the relevant fields are used.
export function emptyValues() {
  return { weightKg: '', reps: '', h: '', m: '', s: '', distance: '', distanceUnit: 'km', setType: 'normal' };
}

// Build entry-pad starting values from a previous set (the "remember last" data).
export function prefillFromSet(set, trackType) {
  const v = emptyValues();
  if (!set) return v;
  v.setType = set.set_type || 'normal';
  if (trackType === 'time') {
    const { h, m, s } = secondsToHMS(set.duration_seconds);
    v.h = h ? String(h) : '';
    v.m = m ? String(m) : '';
    v.s = s ? String(s) : '';
  } else if (trackType === 'distance_time') {
    v.distance = set.distance > 0 ? String(set.distance) : '';
    v.distanceUnit = set.distance_unit || 'km';
    const { h, m, s } = secondsToHMS(set.duration_seconds);
    v.h = h ? String(h) : '';
    v.m = m ? String(m) : '';
    v.s = s ? String(s) : '';
  } else {
    v.weightKg = set.weight_kg > 0 ? String(set.weight_kg) : '';
    v.reps = set.reps > 0 ? String(set.reps) : '';
  }
  return v;
}

// Turn entry-pad values into the workout_sets columns for the given type.
export function setPayloadFromValues(values, trackType) {
  const base = { weight_kg: 0, reps: 0, distance: 0, distance_unit: 'km', duration_seconds: 0 };
  if (trackType === 'time') {
    base.duration_seconds = hmsToSeconds(values.h, values.m, values.s);
  } else if (trackType === 'distance_time') {
    base.distance = parseFloat(values.distance) || 0;
    base.distance_unit = values.distanceUnit || 'km';
    base.duration_seconds = hmsToSeconds(values.h, values.m, values.s);
  } else {
    base.weight_kg = parseFloat(values.weightKg) || 0;
    base.reps = parseInt(values.reps, 10) || 0;
  }
  return base;
}
