-- Maison Obsidian — Stripe
--
-- Hosted Stripe Checkout for reservations (a manual-capture hold plus a saved
-- card, so a batch that outlives the hold can still be charged when it pours)
-- and for the Monthly Pour (a real Stripe subscription). The Vercel webhook
-- (api/stripe/webhook.ts) writes these columns with the service-role key;
-- nothing here is reachable from the browser beyond the existing RLS.

-- Reservations: which Checkout Session made the commit (idempotent webhook),
-- and the saved card for an off-session charge if the hold has expired.
alter table public.commits
  add column if not exists checkout_session_id text,
  add column if not exists payment_method_id   text,
  add column if not exists stripe_customer_id  text;
create index if not exists commits_session_idx on public.commits(checkout_session_id);

-- One Stripe customer per account, reused across checkouts and subscriptions.
create table if not exists public.stripe_customers (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  customer_id  text not null unique,
  email        text,
  created_at   timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
drop policy if exists "stripe_customers_select_own" on public.stripe_customers;
create policy "stripe_customers_select_own"
  on public.stripe_customers for select
  using (auth.uid() is not null and user_id = auth.uid());

-- Subscriptions billed by Stripe. billing_fragrance_id is the pick the next
-- renewal was priced for (set at invoice.upcoming, consumed at invoice.paid).
alter table public.scent_subscriptions
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_customer_id     text,
  add column if not exists billing_fragrance_id   text references public.fragrances(id) on delete set null;

-- One delivery per Stripe invoice (idempotent webhook).
alter table public.subscription_deliveries
  add column if not exists invoice_id text unique;
