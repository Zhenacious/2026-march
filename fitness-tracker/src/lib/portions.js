// A portion is a named amount with a weight: { label: '1 drumstick', grams: 90 }.
// A food carries an ordered list of them and the first one is its default — the
// portion selected when that food is added to the log.
//
// Per-100g nutrition is the single source of truth everywhere. A portion only
// ever supplies the weight to scale it by, which is why the same food can be
// logged as a drumstick, a thigh or 100 g without any of the numbers disagreeing.

// The explicit .js extension keeps this importable by the plain-Node test
// scripts as well as by Vite.
import { UNIT_TO_GRAMS } from './food.js';

/** Labels that already read as a weight, so they need no "(90 g)" appended. */
const WEIGHT_LABEL = /^[\d.]*\s*(g|ml|oz|kg|l)$/i;

export function isWeightLabel(label) {
  return WEIGHT_LABEL.test(String(label || '').trim());
}

/**
 * Accepts what the database gives us — jsonb arrives as an array, but a string
 * is possible depending on the driver — and throws away rows that could not be
 * used for maths anyway.
 */
export function parsePortions(value) {
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => ({ label: String(p?.label ?? '').trim(), grams: Number(p?.grams) }))
    .filter((p) => p.label && p.grams > 0);
}

/** "1 drumstick (90 g)", or "100 g" when the label is already a weight. */
export function portionLabel(portion) {
  if (!portion) return '';
  const label = String(portion.label || '').trim();
  if (!label) return `${round1(portion.grams)} g`;
  if (isWeightLabel(label)) return label;
  return `${label} (${round1(portion.grams)} g)`;
}

/** The portion a food opens on. Never 100 g unless that is all it has. */
export function defaultPortion(portions) {
  const list = parsePortions(portions);
  return list.length ? list[0] : { label: '100 g', grams: 100 };
}

/** The food's own portions, with a plain 100 g option added when it has none. */
export function portionOptions(portions) {
  const list = parsePortions(portions);
  if (list.some((p) => isWeightLabel(p.label))) return list;
  return [...list, { label: '100 g', grams: 100 }];
}

/** Per-100g values down to what one portion of `grams` contains. Unrounded. */
export function scaleTo(per100, grams) {
  const f = (Number(grams) || 0) / 100;
  return {
    calories: (Number(per100?.calories) || 0) * f,
    protein_g: (Number(per100?.protein_g) || 0) * f,
    carbs_g: (Number(per100?.carbs_g) || 0) * f,
    fat_g: (Number(per100?.fat_g) || 0) * f,
  };
}

/** A portion's values back up to per 100 g. Unrounded, so switching portions
 *  repeatedly cannot drift. */
export function scaleFrom(values, grams) {
  const g = Number(grams) || 0;
  if (g <= 0) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const f = 100 / g;
  return {
    calories: (Number(values?.calories) || 0) * f,
    protein_g: (Number(values?.protein_g) || 0) * f,
    carbs_g: (Number(values?.carbs_g) || 0) * f,
    fat_g: (Number(values?.fat_g) || 0) * f,
  };
}

/** An ad-hoc portion for the "Custom weight…" option — 3.5 oz is 3.5 × 28.35 g. */
export function unitPortion(unit) {
  return { label: unit, grams: UNIT_TO_GRAMS[unit] ?? 1 };
}

/** Strips a trailing "(170 g)" so a legacy serving_size can become a label. */
export function stripWeight(text) {
  return String(text || '').replace(/\s*\(\s*[\d.]+\s*(g|ml)\s*\)\s*$/i, '').trim();
}

export const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
