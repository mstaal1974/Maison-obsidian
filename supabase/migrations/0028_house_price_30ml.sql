-- Maison Obsidian — the 30 ml moves to $30
--
-- 0027 put the house on $12 / $32 / $40. The 30 ml is now $30, so the list
-- reads:
--
--   10 ml discovery  $12      30 ml  $30      50 ml  $40      car diffuser  $10
--
-- 0027 has already been applied to the live database and is left as it was
-- written; correcting it in place would not re-run there. This migration
-- carries the new number instead, so a database that has seen 0027 and a
-- database built from scratch both end on the same price list.
--
-- These are the same numbers as HOUSE_PRICE in src/lib/data.ts. The per-format
-- override for the 30 ml is cleared again so no fragrance sits off the list;
-- body-care and ritual-set overrides are left alone.

update public.fragrances
   set price_30ml_cents = 3000,
       format_prices    = coalesce(format_prices, '{}'::jsonb) - 'perf30';
