// Shared food-entry math. One source of truth for how an entry's totals are
// computed.
//
// Per-100g nutrition is the basis for everything. An entry records which
// portion was used and how many of them, so every total is
//
//     per100g × (quantity × portion_grams) / 100
//
// Older entries logged before portions existed still carry quantity_mode /
// servings / grams; legacyEntryTotals below reads those, and is only reached
// when an entry has no usable portion.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

// Weight units convert to grams for the math; ml is 1:1 with g, matching how
// label data for liquids is per 100 ml.
export const UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1 };

/** Total grams this entry represents, or 0 when it predates portions. */
export function entryGrams(entry) {
  const q = entry.quantity ?? 1;
  const g = entry.portion_grams ?? 0;
  return q > 0 && g > 0 ? q * g : 0;
}

export function entryTotals(entry) {
  const grams = entryGrams(entry);
  if (grams > 0 && entry.cal_per_100g != null) {
    const f = grams / 100;
    return {
      calories: (entry.cal_per_100g || 0) * f,
      protein: (entry.protein_per_100g || 0) * f,
      carbs: (entry.carbs_per_100g || 0) * f,
      fat: (entry.fat_per_100g || 0) * f,
    };
  }
  return legacyEntryTotals(entry);
}

/** Pre-portion entries. Kept verbatim so nothing already logged can shift. */
function legacyEntryTotals(entry) {
  if (entry.quantity_mode === 'grams' && entry.grams > 0 && entry.cal_per_100g != null) {
    const f = entry.grams / 100;
    return {
      calories: (entry.cal_per_100g || 0) * f,
      protein: (entry.protein_per_100g || 0) * f,
      carbs: (entry.carbs_per_100g || 0) * f,
      fat: (entry.fat_per_100g || 0) * f,
    };
  }
  const s = entry.servings || 1;
  return {
    calories: (entry.calories || 0) * s,
    protein: (entry.protein_g || 0) * s,
    carbs: (entry.carbs_g || 0) * s,
    fat: (entry.fat_g || 0) * s,
  };
}

export function dayTotals(entries) {
  return entries.reduce(
    (acc, e) => {
      const t = entryTotals(e);
      acc.calories += t.calories;
      acc.protein += t.protein;
      acc.carbs += t.carbs;
      acc.fat += t.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function recentFoods(entries, limit = 8) {
  // entries must be sorted newest-first; keep first occurrence of each name
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = e.food_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * How the amount reads back in the log: "1.5 × 1 drumstick (90 g)" for a named
 * portion, "150 g" or "3.5 oz" when the portion is just a unit of weight.
 */
export function amountLabel(entry) {
  if (entryGrams(entry) > 0) {
    const label = String(entry.portion_label || '').trim();
    const qty = entry.quantity ?? 1;
    if (/^(g|ml|oz|kg|l)$/i.test(label)) return `${r1(qty)} ${label}`;
    if (/^[\d.]+\s*(g|ml|oz|kg|l)$/i.test(label)) {
      return qty === 1 ? label : `${r1(qty)} × ${label}`;
    }
    return `${r1(qty)} × ${label} (${r1(entry.portion_grams)} g)`;
  }
  // Pre-portion entries
  if (entry.quantity_mode === 'grams' && entry.grams > 0) {
    if (entry.input_amount > 0 && entry.input_unit && entry.input_unit !== 'g') {
      return `${entry.input_amount} ${entry.input_unit}`;
    }
    return `${r1(entry.grams)} g`;
  }
  return `${entry.servings || 1} × ${entry.serving_size || 'serving'}`;
}
