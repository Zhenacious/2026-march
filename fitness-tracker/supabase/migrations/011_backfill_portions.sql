-- Converts existing foods and entries into the portion model.
--
-- This mirrors the backfill() helper in scripts/test-food-math.mjs exactly. That
-- helper runs every legacy entry shape through both the old and the new
-- arithmetic and asserts the totals are identical, because this migration
-- reinterprets rows that represent real logged history. If the two ever
-- disagree, this file is the one that is wrong.
--
-- Run the check with:  node scripts/test-food-math.mjs

-- ── custom_foods ────────────────────────────────────────────────────────────

-- 1. Has a serving weight: one portion, with the weight stripped out of the
--    label so "1 breast (170 g)" does not render as "1 breast (170 g) (170 g)".
update custom_foods
set portions = jsonb_build_array(jsonb_build_object(
      'label', coalesce(nullif(btrim(regexp_replace(
                 coalesce(serving_size, ''),
                 '\s*\(\s*[0-9.]+\s*(g|ml)\s*\)\s*$', '', 'i')), ''), '1 serving'),
      'grams', serving_grams))
where portions = '[]'::jsonb
  and serving_grams > 0;

-- 2. No serving weight but per-100g data is present: that data is the reliable
--    half, so the food is logged by weight until someone adds a real portion.
update custom_foods
set portions = jsonb_build_array(jsonb_build_object('label', '100 g', 'grams', 100))
where portions = '[]'::jsonb
  and cal_per_100g is not null;

-- 3. Neither: the food only knows "one serving = these macros". The serving
--    becomes a 100 g-equivalent unit whose per-100g values are the old
--    per-serving values, so the arithmetic lands on the same numbers. The gram
--    figure is a unit rather than a real weight, and can be corrected later.
update custom_foods
set portions = jsonb_build_array(jsonb_build_object(
      'label', coalesce(nullif(btrim(coalesce(serving_size, '')), ''), '1 serving'),
      'grams', 100)),
    cal_per_100g = coalesce(calories, 0),
    protein_per_100g = coalesce(protein_g, 0),
    carbs_per_100g = coalesce(carbs_g, 0),
    fat_per_100g = coalesce(fat_g, 0)
where portions = '[]'::jsonb;

-- ── food_entries ────────────────────────────────────────────────────────────

-- 1. Logged by weight with the typed amount recorded: 3.5 oz becomes
--    quantity 3.5 of a 28.35 g portion, which reads back exactly as entered.
update food_entries
set portion_label = coalesce(nullif(input_unit, ''), 'g'),
    portion_grams = case lower(coalesce(nullif(input_unit, ''), 'g'))
                      when 'oz' then 28.35
                      else 1
                    end,
    quantity = input_amount
where portion_grams is null
  and quantity_mode = 'grams'
  and input_amount is not null;

-- 2. Logged by weight with no typed amount: fall back to plain grams.
update food_entries
set portion_label = 'g',
    portion_grams = 1,
    quantity = grams
where portion_grams is null
  and quantity_mode = 'grams'
  and grams > 0;

-- 3. Logged in servings with a known serving weight. per-100g is derived from
--    this entry's own per-serving snapshot rather than from the stored
--    per-100g columns: the per-serving values are what the old maths used, and
--    they were rounded when saved, so trusting the stored per-100g would shift
--    already-logged days by a fraction of a gram.
update food_entries
set portion_label = coalesce(nullif(btrim(regexp_replace(
                      coalesce(serving_size, ''),
                      '\s*\(\s*[0-9.]+\s*(g|ml)\s*\)\s*$', '', 'i')), ''), '1 serving'),
    portion_grams = serving_grams,
    quantity = coalesce(servings, 1),
    cal_per_100g = coalesce(calories, 0) * 100.0 / serving_grams,
    protein_per_100g = coalesce(protein_g, 0) * 100.0 / serving_grams,
    carbs_per_100g = coalesce(carbs_g, 0) * 100.0 / serving_grams,
    fat_per_100g = coalesce(fat_g, 0) * 100.0 / serving_grams
where portion_grams is null
  and coalesce(quantity_mode, 'servings') <> 'grams'
  and serving_grams > 0
  and calories is not null;

-- 3b. Same, but the entry never recorded per-serving calories: keep whatever
--     per-100g data it has.
update food_entries
set portion_label = coalesce(nullif(btrim(regexp_replace(
                      coalesce(serving_size, ''),
                      '\s*\(\s*[0-9.]+\s*(g|ml)\s*\)\s*$', '', 'i')), ''), '1 serving'),
    portion_grams = serving_grams,
    quantity = coalesce(servings, 1)
where portion_grams is null
  and coalesce(quantity_mode, 'servings') <> 'grams'
  and serving_grams > 0;

-- 4. Servings with no weight but per-100g present.
update food_entries
set portion_label = '100 g',
    portion_grams = 100,
    quantity = coalesce(servings, 1)
where portion_grams is null
  and coalesce(quantity_mode, 'servings') <> 'grams'
  and cal_per_100g is not null;

-- 5. Servings with no weight and no per-100g: the serving becomes a
--    100 g-equivalent unit, exactly as for custom_foods case 3.
update food_entries
set portion_label = coalesce(nullif(btrim(coalesce(serving_size, '')), ''), '1 serving'),
    portion_grams = 100,
    quantity = coalesce(servings, 1),
    cal_per_100g = coalesce(calories, 0),
    protein_per_100g = coalesce(protein_g, 0),
    carbs_per_100g = coalesce(carbs_g, 0),
    fat_per_100g = coalesce(fat_g, 0)
where portion_grams is null
  and coalesce(quantity_mode, 'servings') <> 'grams';
