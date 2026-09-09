-- Maison Obsidian — how each order gets to the customer
--
-- At checkout the customer either ships via Australia Post (a live rate,
-- quoted and charged) or arranges delivery with the house — hand delivery, a
-- pickup, or via a friend — in which case no postage is charged and they tell
-- us how to get it to them. The webhook records the choice alongside the
-- order so the Fulfillment tab knows what to do with it.

alter table public.commits
  add column if not exists delivery_method text not null default 'auspost'
    check (delivery_method in ('auspost', 'alternate')),
  add column if not exists delivery_name   text,
  add column if not exists delivery_phone  text,
  add column if not exists delivery_notes  text;
