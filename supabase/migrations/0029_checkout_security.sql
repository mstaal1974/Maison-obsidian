-- Apply before deploying the checkout code in this branch.
begin;

-- Paid order state may only be written by trusted server handlers.
drop policy if exists commits_insert on public.commits;
revoke insert, update, delete on public.commits from anon, authenticated;
revoke execute on function public.commit_to_batch(text,text,integer,integer,text,text,integer) from public, anon, authenticated;

-- Legacy client-side billing RPCs cannot assert a payment happened.
revoke execute on function public.start_subscription(text,text,integer,text,integer,text) from public, anon, authenticated;
revoke execute on function public.bill_subscription_month(uuid,integer,text,text) from public, anon, authenticated;

-- Membership is managed by an administrator using the database console.
create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant all on public.staff_members to service_role;

-- Preserve old RPC signatures for clients, but never accept passwords.
create or replace function public.staff_ok(p_pass text)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and
    (public.is_admin() or exists (select 1 from public.staff_members where user_id = auth.uid()));
$$;
revoke execute on function public.staff_ok(text) from public, anon;
revoke execute on function public.staff_orders(text,integer) from public, anon;
revoke execute on function public.staff_set_packed(text,text,boolean) from public, anon;
revoke execute on function public.staff_set_tracking(text,text,text) from public, anon;
grant execute on function public.staff_orders(text,integer) to authenticated;
grant execute on function public.staff_set_packed(text,text,boolean) to authenticated;
grant execute on function public.staff_set_tracking(text,text,text) to authenticated;
revoke execute on function public.admin_set_staff_passphrase(text) from public, anon, authenticated;

-- One transaction serialises all handlers for a Checkout Session. Existing
-- orders are preserved; the marker also prevents replays after a line is removed.
create table if not exists public.processed_checkout_sessions (
  session_id text primary key,
  recorded_at timestamptz not null default now()
);
alter table public.processed_checkout_sessions enable row level security;
revoke all on public.processed_checkout_sessions from anon, authenticated;
grant all on public.processed_checkout_sessions to service_role;

create or replace function public.record_paid_order(p_session_id text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if p_session_id is null or p_session_id not like 'cs_%' or
     jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Invalid order';
  end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 100 then
    raise exception 'Invalid order size';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id, 0));
  if exists(select 1 from public.processed_checkout_sessions where session_id = p_session_id) then
    return 0;
  end if;
  if exists(select 1 from public.commits where checkout_session_id = p_session_id) then
    insert into public.processed_checkout_sessions(session_id) values(p_session_id);
    return 0;
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where
    r->>'checkout_session_id' is distinct from p_session_id or
    r->>'status' is distinct from 'captured') then
    raise exception 'Invalid paid order rows';
  end if;
  insert into public.commits (fragrance_id, user_id, user_email, contact_email, engraving, size_ml, charge_cents, payment_intent_id, format, qty, status, checkout_session_id, stripe_customer_id, delivery_method, delivery_name, delivery_phone, delivery_notes, ship_address, ship_city, ship_region, ship_postcode)
  select r.fragrance_id, r.user_id, r.user_email, r.contact_email, r.engraving, r.size_ml, r.charge_cents, r.payment_intent_id, r.format, r.qty, r.status, r.checkout_session_id, r.stripe_customer_id, r.delivery_method, r.delivery_name, r.delivery_phone, r.delivery_notes, r.ship_address, r.ship_city, r.ship_region, r.ship_postcode
  from jsonb_populate_recordset(null::public.commits, p_rows) r;
  get diagnostics v_count = row_count;
  insert into public.processed_checkout_sessions(session_id) values(p_session_id);
  return v_count;
end;
$$;
revoke execute on function public.record_paid_order(text,jsonb) from public, anon, authenticated;
grant execute on function public.record_paid_order(text,jsonb) to service_role;
commit;
