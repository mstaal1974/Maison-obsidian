-- Maison Obsidian — one price list for the whole house
--
-- Every fragrance is priced the same; what differs between them is the scent,
-- not the bill:
--
--   10 ml discovery  $12      30 ml  $32      50 ml  $40      car diffuser  $10
--
-- These are the same numbers as HOUSE_PRICE in src/lib/data.ts, which the app
-- falls back to when the catalogue table is empty. Per-format price overrides
-- for the perfume sizes and the car diffuser are cleared so every fragrance
-- follows this list; overrides for body care and the ritual set are left
-- alone, and the car diffuser falls back to its $10 house default.

update public.fragrances
   set price_10ml_cents = 1200,
       price_30ml_cents = 3200,
       price_50ml_cents = 4000,
       format_prices    = coalesce(format_prices, '{}'::jsonb) - 'perf10' - 'perf30' - 'perf50' - 'car';
