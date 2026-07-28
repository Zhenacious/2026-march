// Looks up nutrition info for a product barcode.
// Tries Open Food Facts first (free, no key), then USDA FoodData Central
// (needs USDA_API_KEY) as a fallback. All numbers returned are per ONE serving
// of the returned serving_size.

async function lookupOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = await resp.json();
  if (json.status !== 1 || !json.product) return null;

  const product = json.product;
  const n = product.nutriments || {};

  let calories, protein, carbs, fat, servingSize;
  if (n['energy-kcal_serving'] != null) {
    calories = n['energy-kcal_serving'];
    protein = n['proteins_serving'];
    carbs = n['carbohydrates_serving'];
    fat = n['fat_serving'];
    servingSize = product.serving_size || '1 serving';
  } else {
    // OFF stores energy_* in kJ; energy-kcal_* in kcal
    calories = n['energy-kcal_100g'] != null
      ? n['energy-kcal_100g']
      : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : 0);
    protein = n['proteins_100g'];
    carbs = n['carbohydrates_100g'];
    fat = n['fat_100g'];
    servingSize = '100 g';
  }

  // Per-100g basis + serving weight so the app can log amounts by grams
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const kcal100 = n['energy-kcal_100g'] != null
    ? n['energy-kcal_100g']
    : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null);
  const per100g = kcal100 == null ? null : {
    calories: r1(kcal100),
    protein_g: r1(n['proteins_100g']) ?? 0,
    carbs_g: r1(n['carbohydrates_100g']) ?? 0,
    fat_g: r1(n['fat_100g']) ?? 0,
  };
  const servingGrams = product.serving_quantity > 0 ? Number(product.serving_quantity) : null;

  return {
    source: 'openfoodfacts',
    name: product.product_name || 'Unknown product',
    brand: product.brands || '',
    serving_size: servingSize,
    serving_grams: servingGrams,
    per_100g: per100g,
    calories: Math.round((calories || 0) * 10) / 10,
    protein_g: Math.round((protein || 0) * 10) / 10,
    carbs_g: Math.round((carbs || 0) * 10) / 10,
    fat_g: Math.round((fat || 0) * 10) / 10,
  };
}

async function lookupUSDA(barcode) {
  const key = process.env.USDA_API_KEY;
  if (!key) return null;

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=1`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = await resp.json();
  const food = json.foods && json.foods[0];
  if (!food) return null;

  // The search is fuzzy — only accept the hit if its UPC really matches
  const foundUpc = (food.gtinUpc || '').replace(/^0+/, '');
  if (foundUpc !== barcode.replace(/^0+/, '')) return null;

  // Branded nutrient values are per 100 g/mL; nutrientNumber is the stable id
  const byNumber = {};
  for (const fn of food.foodNutrients || []) {
    byNumber[fn.nutrientNumber] = fn.value;
  }
  let calories = byNumber['208'] || 0;
  let protein = byNumber['203'] || 0;
  let carbs = byNumber['205'] || 0;
  let fat = byNumber['204'] || 0;

  // Branded values are per 100 g/mL natively — capture that basis before scaling
  const per100g = {
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
  };
  let servingGrams = null;

  let servingSize = '100 g';
  const unit = (food.servingSizeUnit || '').toLowerCase();
  if ((unit === 'g' || unit === 'ml') && food.servingSize > 0) {
    const scale = food.servingSize / 100;
    calories *= scale;
    protein *= scale;
    carbs *= scale;
    fat *= scale;
    servingSize = `${food.servingSize} ${unit}`;
    servingGrams = food.servingSize;
  }

  return {
    source: 'usda',
    name: food.description || 'Unknown product',
    brand: food.brandOwner || '',
    serving_size: servingSize,
    serving_grams: servingGrams,
    per_100g: per100g,
    calories: Math.round(calories * 10) / 10,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const barcode = String(req.query.barcode || '').trim();
  if (!/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'barcode required (8-14 digits)' });
  }

  try {
    let result = await lookupOFF(barcode);

    // US scanners often return 12-digit UPC-A while OFF stores the
    // 13-digit zero-padded EAN form — retry once with a leading zero
    if (!result && barcode.length === 12) {
      result = await lookupOFF('0' + barcode);
    }

    if (!result) {
      result = await lookupUSDA(barcode);
    }

    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
