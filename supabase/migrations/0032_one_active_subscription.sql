-- Maison Obsidian — one Monthly Pour per customer; refunds and disputes
--
-- /api/stripe/subscribe checks for an active subscription before sending the
-- customer to Stripe, but two checkout tabs paid one after the other both pass
-- that check and both start. The database now refuses a second active row for
-- the same account; the webhook sees the refusal and cancels and refunds the
-- extra Stripe subscription (api/_lib/record.ts, recordSubscriptionStart).
--
-- If this index fails to build, an account already has two active rows. Find
-- them with:
--   select user_id, array_agg(stripe_subscription_id) from public.scent_subscriptions
--    where status = 'active' group by user_id having count(*) > 1;
-- cancel the extra one in Stripe, mark its row cancelled, and re-run.

create unique index if not exists scent_subscriptions_one_active
  on public.scent_subscriptions(user_id)
  where status = 'active';

-- A fully refunded order is voided by the webhook (charge.refunded), which
-- takes it off the staff desk. A dispute doesn't change what was sold, so it
-- is recorded alongside the order instead.
alter table public.commits
  add column if not exists disputed_at timestamptz;
