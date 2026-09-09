-- Maison Obsidian — the address given at checkout
--
-- Checkout now collects contact and delivery details on our own page before
-- handing the payment to Stripe, so the postal address arrives with the order
-- rather than being typed a second time on Stripe's page. The webhook (and
-- /api/stripe/confirm) store it here for the Fulfillment tab; when an older
-- client skips the address, Stripe still collects one and it lands in the same
-- columns.

alter table public.commits
  add column if not exists contact_email  text,
  add column if not exists ship_address   text,
  add column if not exists ship_city      text,
  add column if not exists ship_region    text,
  add column if not exists ship_postcode  text;
