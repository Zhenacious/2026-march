-- Remember what was actually typed (e.g. 3.5 oz) next to the canonical grams
-- used for the maths, so the entry reads back the way it was entered.
-- ml is treated 1:1 with g, matching how label data for liquids is per 100 ml.
alter table food_entries add column if not exists input_unit text not null default 'g';
alter table food_entries add column if not exists input_amount float;
