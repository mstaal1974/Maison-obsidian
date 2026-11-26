-- Prepaid Monthly Pour cards use gift_vouchers for issuance and the existing
-- subscription and delivery tables after the recipient claims the card.
alter table public.gift_vouchers
  add column gift_format text check (gift_format in ('perf10', 'perf30', 'perf50', 'car')),
  add column gift_months integer check (gift_months in (3, 6, 12)),
  add column gift_payment_intent_id text unique,
  add column gift_revoked_at timestamptz,
  add column gift_buyer_emailed_at timestamptz,
  add column gift_recipient_emailed_at timestamptz,
  add column gift_subscription_id uuid unique references public.scent_subscriptions(id) on delete set null,
  add column gift_redeemed_at timestamptz,
  add constraint gift_plan_complete check ((gift_format is null) = (gift_months is null));

alter table public.scent_subscriptions
  add column prepaid_gift boolean not null default false,
  add column gift_delivery_address jsonb;

-- Row lock prevents simultaneous Checkout sessions from spending the same card.
-- The existing partial unique index still allows only one active subscription
-- per account. A retry for the winning Stripe subscription is harmless.
create function public.redeem_subscription_gift(
  p_gift uuid, p_user uuid, p_email text, p_subscription text,
  p_customer text, p_invoice text, p_address jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_gift public.gift_vouchers%rowtype;
  v_subscription uuid;
  v_fragrance text;
begin
  select * into v_gift from public.gift_vouchers where id = p_gift for update;
  if not found or v_gift.gift_format is null then return 'unavailable'; end if;
  if v_gift.gift_redeemed_at is not null then
    if exists (select 1 from public.scent_subscriptions where id = v_gift.gift_subscription_id and stripe_subscription_id = p_subscription) then
      return 'already_recorded';
    end if;
    return 'unavailable';
  end if;
  if v_gift.gift_revoked_at is not null or v_gift.expires_at <= now() or
     (v_gift.recipient_email is not null and lower(v_gift.recipient_email) <> coalesce(lower(p_email), '')) then
    return 'unavailable';
  end if;
  if p_address ->> 'country' is distinct from 'AU' or
     coalesce(p_address ->> 'line1', '') = '' or coalesce(p_address ->> 'name', '') = '' or
     coalesce(p_address ->> 'city', '') = '' or coalesce(p_address ->> 'postal_code', '') !~ '^[0-9]{4}$' then
    return 'address';
  end if;
  select id into v_fragrance from public.fragrances
   where not vip_only and (launch_at is null or launch_at <= now())
     and coalesce(format_status ->> v_gift.gift_format, 'live') = 'live'
   order by random() limit 1;
  if v_fragrance is null then return 'unavailable'; end if;

  insert into public.scent_subscriptions (
    user_id, user_email, format, months, pick_mode, next_fragrance_id,
    stripe_subscription_id, stripe_customer_id, prepaid_gift, gift_delivery_address
  ) values (
    p_user, p_email, v_gift.gift_format, v_gift.gift_months, 'surprise', v_fragrance,
    p_subscription, p_customer, true, p_address
  ) on conflict (user_id) where status = 'active' do nothing returning id into v_subscription;
  if v_subscription is null then return 'active_subscription'; end if;

  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, invoice_id)
  values (v_subscription, 1, v_fragrance, 0, p_invoice);
  update public.gift_vouchers set gift_subscription_id = v_subscription, gift_redeemed_at = now() where id = p_gift;
  return 'recorded';
end;
$$;
revoke all on function public.redeem_subscription_gift(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.redeem_subscription_gift(uuid, uuid, text, text, text, text, jsonb) to service_role;

-- Stripe's zero-dollar invoices are delivery dates. Lock the subscription to
-- ensure retries and concurrent events cannot create an extra delivery.
create function public.record_subscription_gift_delivery(p_subscription text, p_invoice text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.scent_subscriptions%rowtype;
  v_month integer;
  v_fragrance text;
  v_done boolean;
begin
  select * into v_sub from public.scent_subscriptions
   where stripe_subscription_id = p_subscription and prepaid_gift for update;
  if not found then return 'missing'; end if;
  if v_sub.status <> 'active' then return v_sub.status; end if;
  if exists (select 1 from public.gift_vouchers where gift_subscription_id = v_sub.id and gift_revoked_at is not null) then
    return 'revoked';
  end if;
  if exists (select 1 from public.subscription_deliveries where invoice_id = p_invoice) then return 'recorded'; end if;
  select coalesce(max(month), 0) + 1 into v_month from public.subscription_deliveries where subscription_id = v_sub.id;
  select f.id into v_fragrance from public.fragrances f
   where not f.vip_only and (f.launch_at is null or f.launch_at <= now())
     and coalesce(f.format_status ->> v_sub.format, 'live') = 'live'
   order by exists (select 1 from public.subscription_deliveries d where d.subscription_id = v_sub.id and d.fragrance_id = f.id), random()
   limit 1;
  if v_fragrance is null then return 'no_scent'; end if;
  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, invoice_id)
  values (v_sub.id, v_month, v_fragrance, 0, p_invoice);
  v_done := v_month >= v_sub.months;
  update public.scent_subscriptions set next_fragrance_id = v_fragrance,
     status = case when v_done then 'completed' else 'active' end where id = v_sub.id;
  return case when v_done then 'completed' else 'recorded' end;
end;
$$;
revoke all on function public.record_subscription_gift_delivery(text, text) from public, anon, authenticated;
grant execute on function public.record_subscription_gift_delivery(text, text) to service_role;
