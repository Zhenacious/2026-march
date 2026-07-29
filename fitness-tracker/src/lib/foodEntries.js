import { supabase } from './supabase';

/**
 * Saving a food entry. Nutrition is copied onto the entry at log time rather
 * than looked up later, so correcting a food never rewrites days you already
 * logged.
 */
export async function insertFoodEntry(userId, date, values) {
  const { data, error } = await supabase
    .from('food_entries')
    .insert({ ...values, user_id: userId, date })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFoodEntry(id, values) {
  const { data, error } = await supabase
    .from('food_entries').update(values).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFoodEntry(id) {
  const { error } = await supabase.from('food_entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Sensible meal for the time of day, so the common case needs no tap. */
export function defaultMealForNow(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

/** Turns an API result or a saved library food into panel form values. */
export function toPanelFood(f) {
  return {
    food_name: f.food_name || (f.brand ? `${f.name} (${String(f.brand).split(',')[0].trim()})` : f.name),
    brand: f.brand || '',
    barcode: f.barcode || '',
    serving_size: f.serving_size || '',
    serving_grams: f.serving_grams ?? null,
    calories: f.calories ?? 0,
    protein_g: f.protein_g ?? 0,
    carbs_g: f.carbs_g ?? 0,
    fat_g: f.fat_g ?? 0,
    cal_per_100g: f.per_100g?.calories ?? f.cal_per_100g ?? null,
    protein_per_100g: f.per_100g?.protein_g ?? f.protein_per_100g ?? null,
    carbs_per_100g: f.per_100g?.carbs_g ?? f.carbs_per_100g ?? null,
    fat_per_100g: f.per_100g?.fat_g ?? f.fat_per_100g ?? null,
  };
}
