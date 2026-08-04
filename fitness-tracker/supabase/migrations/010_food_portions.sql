-- Portions. A food carries an ordered list of named amounts with weights, e.g.
--   [{"label": "1 drumstick", "grams": 90}, {"label": "1 thigh", "grams": 130}]
-- The first one is the food's default — the portion selected when it is added
-- to the log. This replaces the old single serving_size/serving_grams pair,
-- which could only ever describe one amount and duplicated the weight in both
-- the text label and the number.
--
-- An entry records which portion was used and how many of them, so every total
-- is per100g x (quantity x portion_grams) / 100. The old quantity_mode,
-- servings, serving_size, serving_grams, input_unit and input_amount columns
-- are left in place but no longer written to; entries logged before this change
-- still read correctly through a fallback in src/lib/food.js.

alter table custom_foods add column if not exists portions jsonb not null default '[]'::jsonb;

-- Lets the library be filtered — "Fast food" is the first user of this.
alter table custom_foods add column if not exists category text default '';

alter table food_entries add column if not exists portion_label text default '';
alter table food_entries add column if not exists portion_grams float;
alter table food_entries add column if not exists quantity float default 1;

create index if not exists custom_foods_user_category on custom_foods (user_id, category);
