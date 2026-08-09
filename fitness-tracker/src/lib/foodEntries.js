import { supabase } from './supabase';
import { parsePortions, stripWeight } from './portions';

/**
 * Turns "could not find the table 'public.x' in the schema cache" into
 * something actionable — it means the setup SQL hasn't been run yet, which is
 * a setup step rather than a bug in the app.
 */
export function friendlyDbError(err, what = 'this') {
  const msg = err?.message || String(err);
  if (/schema cache|does not exist|relation .* does not exist/i.test(msg)) {
    return `The database table for ${what} hasn't been created yet. Run "npm run migrate" to bring the database up to date, then reload.`;
  }
  return msg;
}

/**
 * Saving a food entry. Nutrition is copied onto the entry at log time rather
 * than looked up later, so correcting a food never rewrites days you already
 * logged.
 */
/**
 * The panel hands back the food's whole portion list so the caller can save it
 * to the library, but an entry only records the one portion that was used —
 * `portions` is not a column on food_entries.
 */
function entryColumns(values) {
  const row = { ...values };
  delete row.portions;
  return row;
}

export async function insertFoodEntry(userId, date, values) {
  const { data, error } = await supabase
    .from('food_entries')
    .insert({ ...entryColumns(values), user_id: userId, date })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFoodEntry(id, values) {
  const { data, error } = await supabase
    .from('food_entries').update(entryColumns(values)).eq('id', id).select().single();
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

/**
 * Turns an API result or a saved library food into panel form values.
 *
 * Foods from the external databases have no portion list of their own, so one
 * is synthesised from whatever serving they do describe — that way every food
 * opens on a real portion rather than on a bare 100 g.
 */
export function toPanelFood(f) {
  const own = parsePortions(f.portions);
  // A row from the diary carries the portion it was logged with. A bare unit
  // ("g", "oz") was a custom weight rather than a portion, so it is not worth
  // offering again.
  const logged = f.portion_grams > 0 && !/^(g|ml|oz|kg|l)$/i.test(f.portion_label || '')
    ? [{ label: f.portion_label || '1 serving', grams: f.portion_grams }]
    : [];
  const described = f.serving_grams > 0
    ? [{ label: stripWeight(f.serving_size) || '1 serving', grams: f.serving_grams }]
    : [];
  const portions = own.length ? own : (logged.length ? logged : described);
  return {
    food_name: f.food_name || (f.brand ? `${f.name} (${String(f.brand).split(',')[0].trim()})` : f.name),
    brand: f.brand || '',
    barcode: f.barcode || '',
    portions,
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
