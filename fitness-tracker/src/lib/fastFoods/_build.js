// Shared row builder for the chain files. Files under fastFoods/ starting with
// "_" are helpers rather than chains.
//
// Each chain file lists its menu as
//   [name, portions, kcal, protein, carbs, fat]      nutrition per 100 g
// and this turns those into the same food shape the rest of the app uses.

export function buildChain(brand, rows, aliases = {}) {
  return rows.map(([name, portions, cal, protein, carbs, fat]) => {
    const list = portions.map(([label, grams]) => ({ label, grams }));
    const first = list[0];
    const per = (v) => Math.round(v * first.grams) / 100;
    return {
      name,
      brand,
      aliases: aliases[name] || '',
      category: 'Fast food',
      portions: list,
      cal_per_100g: cal,
      protein_per_100g: protein,
      carbs_per_100g: carbs,
      fat_per_100g: fat,
      // The default portion's values, so a saved row reads sensibly on its own
      serving_size: `${first.label} (${first.grams} g)`,
      serving_grams: first.grams,
      calories: per(cal),
      protein_g: per(protein),
      carbs_g: per(carbs),
      fat_g: per(fat),
    };
  });
}
