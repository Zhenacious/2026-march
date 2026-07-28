// Shared food-entry math. One source of truth for how an entry's totals are
// computed: grams mode uses per-100g basis; servings mode uses per-serving values.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

// Weight units convert to grams for the math; ml is 1:1 with g, matching how
// label data for liquids is per 100 ml.
export const UNIT_TO_GRAMS = { g: 1, oz: 28.35, ml: 1 };

export function entryTotals(entry) {
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

export function amountLabel(entry) {
  if (entry.quantity_mode === 'grams' && entry.grams > 0) {
    if (entry.input_amount > 0 && entry.input_unit && entry.input_unit !== 'g') {
      return `${entry.input_amount} ${entry.input_unit}`;
    }
    return `${Math.round(entry.grams * 10) / 10} g`;
  }
  return `${entry.servings || 1} × ${entry.serving_size || 'serving'}`;
}
