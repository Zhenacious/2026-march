// Shared food data sources for /api/food-lookup (by barcode) and
// /api/food-search (by name). Files under api/ starting with "_" are helpers,
// not endpoints.
//
// Sources, in the order they are tried:
//   1. Open Food Facts — free, no key, global (good AU/NZ, thinner in China)
//   2. FatSecret       — needs FATSECRET_CLIENT_ID/SECRET, strong AU/NZ coverage
//   3. USDA            — needs USDA_API_KEY, US branded products
// Every source is optional: if its keys are missing or it errors, it is skipped.

const r1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const num = (v) => (v == null || v === '' ? null : parseFloat(v));

// ── Open Food Facts ─────────────────────────────────────────────────────────

const OFF_FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments';

/**
 * Returns null when the record carries no energy value at all. Open Food Facts
 * is crowd-sourced and plenty of products exist as a name and barcode with the
 * nutrition panel never filled in — reporting those as "0 kcal" would quietly
 * log nothing. A genuinely zero-calorie food still records energy as 0, so an
 * absent value is missing data rather than a real zero.
 */
function offToStandard(product, barcode) {
  const n = product.nutriments || {};

  const kcal100raw = n['energy-kcal_100g'] != null
    ? n['energy-kcal_100g']
    : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null);
  if (n['energy-kcal_serving'] == null && kcal100raw == null) return null;

  // Pure fat is 900 kcal/100g, so anything above that is a bad record — usually
  // kilojoules entered in the kcal field, or a per-kilo figure.
  if (kcal100raw != null && kcal100raw > 900) return null;

  // Some records set "serving" to the whole package (a 900 g cereal box), which
  // is arithmetically right but a terrible default to log. Above half a kilo,
  // fall back to per-100g and let the amount be entered by weight instead.
  const servingQty = product.serving_quantity > 0 ? Number(product.serving_quantity) : null;
  const servingIsSane = servingQty == null || servingQty <= 500;

  let calories, protein, carbs, fat, servingSize;
  if (n['energy-kcal_serving'] != null && servingIsSane) {
    calories = n['energy-kcal_serving'];
    protein = n['proteins_serving'];
    carbs = n['carbohydrates_serving'];
    fat = n['fat_serving'];
    servingSize = product.serving_size || '1 serving';
  } else {
    calories = n['energy-kcal_100g'] != null
      ? n['energy-kcal_100g']
      : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : 0);
    protein = n['proteins_100g'];
    carbs = n['carbohydrates_100g'];
    fat = n['fat_100g'];
    servingSize = '100 g';
  }

  const per100g = kcal100raw == null ? null : {
    calories: r1(kcal100raw),
    protein_g: r1(n['proteins_100g']) ?? 0,
    carbs_g: r1(n['carbohydrates_100g']) ?? 0,
    fat_g: r1(n['fat_100g']) ?? 0,
  };

  return {
    source: 'openfoodfacts',
    barcode: barcode || product.code || '',
    name: product.product_name || 'Unknown product',
    brand: Array.isArray(product.brands) ? product.brands.join(', ') : (product.brands || ''),
    serving_size: servingSize,
    serving_grams: servingIsSane ? servingQty : null,
    per_100g: per100g,
    calories: r1(calories || 0),
    protein_g: r1(protein || 0),
    carbs_g: r1(carbs || 0),
    fat_g: r1(fat || 0),
  };
}

export async function lookupOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = await resp.json();
  if (json.status !== 1 || !json.product) return null;
  return offToStandard(json.product, barcode);
}

// Kept small on purpose: each result costs one product request, and Open Food
// Facts rate-limits search to roughly 10 requests a minute.
export async function searchOFF(query, limit = 6) {
  // Two steps on purpose: the old cgi/search.pl endpoint is throttled to 503s,
  // and the current search service returns no nutrition data — so get matching
  // barcodes from search, then pull each product's full record.
  const sResp = await fetch(
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=${limit}`
  );
  if (!sResp.ok) return [];
  const sJson = await sResp.json();
  const codes = (sJson.hits || []).map((h) => h.code).filter(Boolean).slice(0, limit);
  if (codes.length === 0) return [];

  const products = await Promise.all(codes.map(async (code) => {
    try {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`
      );
      if (!r.ok) return null;
      const j = await r.json();
      if (j.status !== 1 || !j.product) return null;
      return offToStandard(j.product, code);
    } catch {
      return null; // patchy crowd-sourced records are expected
    }
  }));

  return products.filter((f) => f && f.name !== 'Unknown product' && f.calories > 0);
}

// ── FatSecret ───────────────────────────────────────────────────────────────

let cachedToken = null;

async function fatSecretToken() {
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const resp = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  if (!json.access_token) return null;
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 86400) * 1000,
  };
  return cachedToken.token;
}

async function fatSecretCall(params, token) {
  const qs = new URLSearchParams({ ...params, format: 'json' }).toString();
  const resp = await fetch(`https://platform.fatsecret.com/rest/server.api?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json && json.error ? null : json;
}

/** Full detail for one FatSecret food id — has real per-serving and metric data. */
async function fatSecretFood(foodId, token, barcode) {
  const json = await fatSecretCall({ method: 'food.get.v2', food_id: foodId }, token);
  const food = json && json.food;
  if (!food) return null;

  let servings = food.servings && food.servings.serving;
  if (!servings) return null;
  if (!Array.isArray(servings)) servings = [servings];

  const s = servings[0];
  const isMetric = (x) => ['g', 'ml'].includes(String(x.metric_serving_unit || '').toLowerCase());

  let per100g = null;
  const metric = servings.find((x) => num(x.metric_serving_amount) > 0 && isMetric(x));
  if (metric) {
    const f = 100 / num(metric.metric_serving_amount);
    per100g = {
      calories: r1(num(metric.calories) * f),
      protein_g: r1(num(metric.protein) * f) ?? 0,
      carbs_g: r1(num(metric.carbohydrate) * f) ?? 0,
      fat_g: r1(num(metric.fat) * f) ?? 0,
    };
  }

  return {
    source: 'fatsecret',
    barcode: barcode || '',
    name: food.food_name || 'Unknown product',
    brand: food.brand_name || '',
    serving_size: s.serving_description || '1 serving',
    serving_grams: num(s.metric_serving_amount) > 0 && isMetric(s) ? num(s.metric_serving_amount) : null,
    per_100g: per100g,
    calories: r1(num(s.calories) || 0),
    protein_g: r1(num(s.protein) || 0),
    carbs_g: r1(num(s.carbohydrate) || 0),
    fat_g: r1(num(s.fat) || 0),
  };
}

export async function lookupFatSecret(barcode) {
  const token = await fatSecretToken();
  if (!token) return null;
  // FatSecret matches on GTIN-13, so short UPCs need zero-padding
  const gtin13 = String(barcode).padStart(13, '0');
  const json = await fatSecretCall(
    { method: 'food.find_id_for_barcode', barcode: gtin13 }, token
  );
  const foodId = json && json.food_id && json.food_id.value;
  if (!foodId || String(foodId) === '0') return null;
  return fatSecretFood(foodId, token, barcode);
}

/**
 * Search results carry macros inside food_description, e.g.
 * "Per 100g - Calories: 393kcal | Fat: 5.40g | Carbs: 78.60g | Protein: 7.10g"
 * Parsing it avoids a detail call per result.
 */
function parseFatSecretDescription(desc) {
  const m = /^Per\s+(.+?)\s*-\s*Calories:\s*([\d.]+)kcal\s*\|\s*Fat:\s*([\d.]+)g\s*\|\s*Carbs:\s*([\d.]+)g\s*\|\s*Protein:\s*([\d.]+)g/i
    .exec(desc || '');
  if (!m) return null;
  const servingText = m[1].trim();
  const values = {
    serving_size: servingText,
    calories: r1(parseFloat(m[2])),
    fat_g: r1(parseFloat(m[3])),
    carbs_g: r1(parseFloat(m[4])),
    protein_g: r1(parseFloat(m[5])),
  };
  const metric = /^([\d.]+)\s*(g|ml)$/i.exec(servingText);
  if (metric) {
    const grams = parseFloat(metric[1]);
    const f = 100 / grams;
    values.serving_grams = grams;
    values.per_100g = {
      calories: r1(values.calories * f),
      protein_g: r1(values.protein_g * f),
      carbs_g: r1(values.carbs_g * f),
      fat_g: r1(values.fat_g * f),
    };
  }
  return values;
}

export async function searchFatSecret(query, limit = 12) {
  const token = await fatSecretToken();
  if (!token) return [];
  const json = await fatSecretCall(
    { method: 'foods.search', search_expression: query, max_results: String(limit) }, token
  );
  let foods = json && json.foods && json.foods.food;
  if (!foods) return [];
  if (!Array.isArray(foods)) foods = [foods];

  return foods.map((f) => {
    const parsed = parseFatSecretDescription(f.food_description) || {};
    return {
      source: 'fatsecret',
      fatsecret_id: f.food_id,
      barcode: '',
      name: f.food_name || 'Unknown product',
      brand: f.brand_name || '',
      serving_size: parsed.serving_size || '1 serving',
      serving_grams: parsed.serving_grams ?? null,
      per_100g: parsed.per_100g ?? null,
      calories: parsed.calories ?? 0,
      protein_g: parsed.protein_g ?? 0,
      carbs_g: parsed.carbs_g ?? 0,
      fat_g: parsed.fat_g ?? 0,
    };
  }).filter((f) => f.calories > 0);
}

// ── USDA FoodData Central ───────────────────────────────────────────────────

export async function lookupUSDA(barcode) {
  const key = process.env.USDA_API_KEY;
  if (!key) return null;

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}`
    + `&query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=1`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = await resp.json();
  const food = json.foods && json.foods[0];
  if (!food) return null;

  // The search is fuzzy — only accept the hit if its UPC really matches
  const foundUpc = (food.gtinUpc || '').replace(/^0+/, '');
  if (foundUpc !== String(barcode).replace(/^0+/, '')) return null;

  const byNumber = {};
  for (const fn of food.foodNutrients || []) byNumber[fn.nutrientNumber] = fn.value;
  let calories = byNumber['208'] || 0;
  let protein = byNumber['203'] || 0;
  let carbs = byNumber['205'] || 0;
  let fat = byNumber['204'] || 0;

  // Branded values are per 100 g/mL natively
  const per100g = {
    calories: r1(calories), protein_g: r1(protein), carbs_g: r1(carbs), fat_g: r1(fat),
  };
  let servingGrams = null;
  let servingSize = '100 g';
  const unit = (food.servingSizeUnit || '').toLowerCase();
  if ((unit === 'g' || unit === 'ml') && food.servingSize > 0) {
    const scale = food.servingSize / 100;
    calories *= scale; protein *= scale; carbs *= scale; fat *= scale;
    servingSize = `${food.servingSize} ${unit}`;
    servingGrams = food.servingSize;
  }

  return {
    source: 'usda',
    barcode: String(barcode),
    name: food.description || 'Unknown product',
    brand: food.brandOwner || '',
    serving_size: servingSize,
    serving_grams: servingGrams,
    per_100g: per100g,
    calories: r1(calories),
    protein_g: r1(protein),
    carbs_g: r1(carbs),
    fat_g: r1(fat),
  };
}
