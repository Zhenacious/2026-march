-- Alternative names, so a food can be found by more than one word — its Chinese
-- name, a pinyin spelling, or a regional English name. Comma-separated free
-- text, searched with the same ILIKE as the name.
alter table custom_foods add column if not exists aliases text default '';
