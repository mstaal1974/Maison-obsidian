-- Maison Obsidian — Monthly Pour: let the house choose
--
-- A subscription now carries a pick mode: 'choose' (the customer picks each
-- month's scent, as before) or 'surprise' (the house draws one at random each
-- month from the catalogue, never repeating a scent already sent on that
-- subscription, skipping VIP-only scents and formats hidden for that scent).

alter table public.scent_subscriptions
  add column if not exists pick_mode text not null default 'choose'
  check (pick_mode in ('choose', 'surprise'));

-- Random draw for one subscription: not yet delivered on it, not VIP-only,
-- and the subscription's format not hidden for that scent.
create or replace function public.draw_subscription_scent(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with s as (select format from public.scent_subscriptions where id = p_id),
       pool as (
         select f.id
           from public.fragrances f, s
          where not f.vip_only
            and coalesce(f.format_status ->> s.format, 'live') <> 'hidden'
            and f.id not in (select fragrance_id from public.subscription_deliveries where subscription_id = p_id)
       )
  select coalesce(
    (select id from pool order by random() limit 1),
    (select f.id from public.fragrances f order by random() limit 1)
  );
$$;

-- start_subscription: p_fragrance_id may be null in surprise mode; the first
-- month is drawn here so the charge matches a real bottle.
drop function if exists public.start_subscription(text, text, integer, text, integer);
create or replace function public.start_subscription(
  p_format            text,
  p_fragrance_id      text,
  p_charge_cents      integer,
  p_payment_intent_id text default null,
  p_months            integer default 12,
  p_pick_mode         text default 'choose'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_frag text := p_fragrance_id;
begin
  if auth.uid() is null then
    raise exception 'sign in to subscribe' using errcode = 'insufficient_privilege';
  end if;
  if p_pick_mode not in ('choose', 'surprise') then
    raise exception 'invalid pick mode' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.scent_subscriptions where user_id = auth.uid() and status = 'active') then
    raise exception 'you already have an active subscription' using errcode = 'unique_violation';
  end if;
  insert into public.scent_subscriptions (user_id, user_email, format, months, next_fragrance_id, pick_mode)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_format, coalesce(p_months, 12), p_fragrance_id, p_pick_mode)
  returning id into v_id;
  if v_frag is null then
    v_frag := public.draw_subscription_scent(v_id);
    update public.scent_subscriptions set next_fragrance_id = v_frag where id = v_id;
  end if;
  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, payment_intent_id)
  values (v_id, 1, v_frag, p_charge_cents, p_payment_intent_id);
  return v_id;
end;
$$;
grant execute on function public.start_subscription(text, text, integer, text, integer, text) to authenticated;

-- The owner switches between choosing and surprise.
create or replace function public.set_subscription_mode(p_id uuid, p_pick_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pick_mode not in ('choose', 'surprise') then
    raise exception 'invalid pick mode' using errcode = 'check_violation';
  end if;
  update public.scent_subscriptions
     set pick_mode = p_pick_mode
   where id = p_id and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'subscription not found' using errcode = 'no_data_found';
  end if;
end;
$$;
grant execute on function public.set_subscription_mode(uuid, text) to authenticated;

-- bill_subscription_month: in surprise mode the month's scent is drawn here.
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
  v_frag   text;
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
  v_frag := case when v_sub.pick_mode = 'surprise' then public.draw_subscription_scent(p_id) else v_sub.next_fragrance_id end;
  if v_frag is null then
    raise exception 'no scent chosen for this month' using errcode = 'check_violation';
  end if;
  insert into public.subscription_deliveries (subscription_id, month, fragrance_id, charge_cents, payment_intent_id)
  values (p_id, v_month, v_frag, p_charge_cents, p_payment_intent_id);
  update public.scent_subscriptions
     set next_fragrance_id = v_frag,
         status = case when v_month = months then 'completed' else status end
   where id = p_id;
  return v_month;
end;
$$;
grant execute on function public.bill_subscription_month(uuid, integer, text) to authenticated;
