-- Amounts by weight as well as by serving. quantity_mode records which one was
-- used; the per-100g columns are the basis the grams maths works from.
alter table food_entries add column if not exists quantity_mode text not null default 'servings';
alter table food_entries add column if not exists grams float;
alter table food_entries add column if not exists serving_grams float;
alter table food_entries add column if not exists cal_per_100g float;
alter table food_entries add column if not exists protein_per_100g float;
alter table food_entries add column if not exists carbs_per_100g float;
alter table food_entries add column if not exists fat_per_100g float;
