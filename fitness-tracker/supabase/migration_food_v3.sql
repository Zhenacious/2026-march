-- v3: flexible units — remember what the user typed (e.g. 3.5 oz) alongside
-- the canonical grams used for the math. ml is treated 1:1 with g (liquids).

alter table food_entries add column if not exists input_unit text not null default 'g'
  check (input_unit in ('g','oz','ml'));
alter table food_entries add column if not exists input_amount float;
