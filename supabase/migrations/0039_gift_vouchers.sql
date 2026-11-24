-- Maison Obsidian — gift vouchers (/gift-card)
--
-- One row per voucher bought. The value is redeemed through Stripe: paying for
-- a voucher creates a one-time Stripe coupon and promotion code (the code on
-- the card), which the shop's checkout already accepts. This table is the
-- house's record of what was sold, to whom, and what the card says; it is
-- written only by the server (service role) and read by admins.

create table if not exists public.gift_vouchers (
  id                  uuid primary key default gen_random_uuid(),
  checkout_session_id text not null unique,
  code                text not null unique,
  amount_cents        integer not null check (amount_cents > 0),
  finish              text not null default 'obsidian' check (finish in ('obsidian', 'alabaster')),
  to_name             text,
  from_name           text,
  message             text,
  buyer_email         text,
  recipient_email     text,
  stripe_coupon_id    text,
  stripe_promotion_code_id text,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz not null
);
create index if not exists gift_vouchers_issued_idx on public.gift_vouchers(issued_at desc);

alter table public.gift_vouchers enable row level security;
revoke all on public.gift_vouchers from anon, authenticated;
grant select on public.gift_vouchers to authenticated;
grant all on public.gift_vouchers to service_role;

drop policy if exists "gift_vouchers_admin_select" on public.gift_vouchers;
create policy "gift_vouchers_admin_select"
  on public.gift_vouchers for select
  using (public.is_admin());
