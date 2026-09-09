-- Maison Obsidian — The Monthly Pour (12-month fragrance subscription)
--
-- A customer picks a format (10 / 30 / 50 ml perfume or the car diffuser),
-- commits to twelve monthly payments, and receives one fragrance a month at
-- 10% under that month's shelf price. They choose the upcoming scent from
-- their account; each billed month becomes a delivery row.
--
-- Recurring billing itself lives with the payment processor (Stripe
-- Subscriptions or a scheduled job): whoever runs the monthly charge calls
-- bill_subscription_month() with the resulting payment intent, and the admin
-- console can do the same by hand. Everything here is RLS-closed; customers
-- and admins act through the SECURITY DEFINER RPCs below.

create table if not exists public.scent_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  user_email         text,
  format             text not null check (format in ('perf10', 'perf30', 'perf50', 'car')),
  months             integer not null default 12 check (months between 1 and 36),
  status             text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  next_fragrance_id  text references public.fragrances(id) on delete set null,
  started_at         timestamptz not null default now(),
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists scent_subscriptions_user_idx   on public.scent_subscriptions(user_id);
create index if not exists scent_subscriptions_status_idx on public.scent_subscriptions(status, started_at desc);

create table if not exists public.subscription_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  subscription_id    uuid not null references public.scent_subscriptions(id) on delete cascade,
  month              integer not null check (month between 1 and 36),
  fragrance_id       text not null references public.fragrances(id) on delete restrict,
  charge_cents       integer not null check (charge_cents >= 0),
  payment_intent_id  text,
  status             text not null default 'paid' check (status in ('paid', 'shipped', 'delivered')),
  billed_at          timestamptz not null default now(),
  unique (subscription_id, month)
);
create index if not exists subscription_deliveries_sub_idx on public.subscription_deliveries(subscription_id, month);

alter table public.scent_subscriptions    enable row level security;
alter table public.subscription_deliveries enable row level security;

drop policy if exists "subs_select_own" on public.scent_subscriptions;
create policy "subs_select_own"
  on public.scent_subscriptions for select
  using (auth.uid() is not null and user_id = auth.uid());
drop policy if exists "subs_admin_select" on public.scent_subscriptions;
create policy "subs_admin_select"
  on public.scent_subscriptions for select
  using (public.is_admin());

drop policy if exists "deliveries_select_own" on public.subscription_deliveries;
create policy "deliveries_select_own"
  on public.subscription_deliveries for select
  using (exists (select 1 from public.scent_subscriptions s where s.id = subscription_id and s.user_id = auth.uid()));
drop policy if exists "deliveries_admin_select" on public.subscription_deliveries;
create policy "deliveries_admin_select"
  on public.subscription_deliveries for select
  using (public.is_admin());
drop policy if exists "deliveries_admin_update" on public.subscription_deliveries;
create policy "deliveries_admin_update"
  on public.subscription_deliveries for update
  using (public.is_admin()) with check (public.is_admin());

-- ─── Start: records the subscription and its first (already paid) month ──────
create or replace function public.start_subscription(
  p_format            text,
  p_fragrance_id      text,
  p_charge_cents      integer,
  p_payment_intent_id text default null,
  p_months            integer default 12
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to subscribe' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.scent_subscriptions where user_id = auth.uid() and status = 'active') then
    raise exception 'you already have an active subscription' using errcode = 'unique_violation';
  end if;
  insert into public.scent_subscriptions (user_id, user_email, format, months, next_fragrance_id)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_format, coalesce(p_months, 12), p_fragrance_id)
  returning id into v_id;
  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, payment_intent_id)
  values (v_id, 1, p_fragrance_id, p_charge_cents, p_payment_intent_id);
  return v_id;
end;
$$;
grant execute on function public.start_subscription(text, text, integer, text, integer) to authenticated;

-- ─── Pick: the owner changes the upcoming month's fragrance ──────────────────
create or replace function public.set_subscription_pick(p_id uuid, p_fragrance_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scent_subscriptions
     set next_fragrance_id = p_fragrance_id
   where id = p_id and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'subscription not found' using errcode = 'no_data_found';
  end if;
end;
$$;
grant execute on function public.set_subscription_pick(uuid, text) to authenticated;

-- ─── Cancel: the owner (or an admin) ends it; paid months still ship ─────────
create or replace function public.cancel_subscription(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scent_subscriptions
     set status = 'cancelled', cancelled_at = now()
   where id = p_id and status = 'active' and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'subscription not found' using errcode = 'no_data_found';
  end if;
end;
$$;
grant execute on function public.cancel_subscription(uuid) to authenticated;

-- ─── Bill: records the next month's charge as a delivery (admin / processor) ─
create or replace function public.bill_subscription_month(
  p_id                uuid,
  p_charge_cents      integer,
  p_payment_intent_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub    public.scent_subscriptions%rowtype;
  v_month  integer;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
  select * into v_sub from public.scent_subscriptions where id = p_id for update;
  if not found or v_sub.status <> 'active' then
    raise exception 'subscription is not active' using errcode = 'no_data_found';
  end if;
  select coalesce(max(month), 0) + 1 into v_month from public.subscription_deliveries where subscription_id = p_id;
  if v_month > v_sub.months then
    raise exception 'all months billed' using errcode = 'check_violation';
  end if;
  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, payment_intent_id)
  values (p_id, v_month, v_sub.next_fragrance_id, p_charge_cents, p_payment_intent_id);
  if v_month = v_sub.months then
    update public.scent_subscriptions set status = 'completed' where id = p_id;
  end if;
  return v_month;
end;
$$;
grant execute on function public.bill_subscription_month(uuid, integer, text) to authenticated;
