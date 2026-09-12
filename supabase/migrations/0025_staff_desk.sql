-- Maison Obsidian — the staff order desk
--
-- A paid order is several rows in `commits` (one per bag line) that share a
-- Stripe checkout session. Packing is a per-order act, not a per-line one, so
-- fulfilment state lives in its own table keyed by that session.
--
-- Access: the desk is used by whoever is packing, who may not have an account,
-- so it is reached with a shared passphrase rather than a login. The passphrase
-- is bcrypt-hashed and never leaves the database; every function below takes it
-- and refuses without it. An admin session (is_admin()) passes without one, so
-- the console can use the same functions.
--
-- Why RPCs and not a table read with RLS: the desk needs Stripe refs, customer
-- emails and addresses, and a passphrase cannot be checked by a policy. These
-- functions are the only door, and nothing here is readable through PostgREST
-- directly — both tables have RLS on with no policies at all.

create extension if not exists pgcrypto;

-- ─── Fulfilment state, one row per order ─────────────────────────────────────
create table if not exists public.order_fulfilment (
  order_ref       text primary key,           -- checkout_session_id
  packed          boolean not null default false,
  packed_at       timestamptz,
  tracking_number text,                       -- Australia Post article id
  carrier         text not null default 'Australia Post',
  shipped_at      timestamptz,
  note            text,
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_order_fulfilment_updated on public.order_fulfilment;
create trigger trg_order_fulfilment_updated
  before update on public.order_fulfilment
  for each row execute function public.set_updated_at();

-- ─── The shared passphrase ───────────────────────────────────────────────────
-- One row, enforced by a primary key that can only ever be true.
create table if not exists public.staff_access (
  id              boolean primary key default true check (id),
  passphrase_hash text not null,
  updated_at      timestamptz not null default now()
);

-- Change this before anyone else can reach the desk:
--   select public.admin_set_staff_passphrase('your new passphrase');
-- run as an admin, or straight from the SQL editor:
--   update public.staff_access set passphrase_hash = crypt('…', gen_salt('bf'));
insert into public.staff_access (id, passphrase_hash)
values (true, crypt('obsidian-change-me', gen_salt('bf')))
on conflict (id) do nothing;

-- RLS on, no policies: neither table is reachable except through the security
-- definer functions below, which is the point.
alter table public.order_fulfilment enable row level security;
alter table public.staff_access     enable row level security;

-- ─── The gate ────────────────────────────────────────────────────────────────
create or replace function public.staff_ok(p_pass text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if public.is_admin() then
    return true;
  end if;
  if p_pass is null or length(p_pass) = 0 then
    return false;
  end if;
  select passphrase_hash into v_hash from public.staff_access where id;
  if v_hash is null then
    return false;
  end if;
  if crypt(p_pass, v_hash) = v_hash then
    return true;
  end if;
  -- Enough friction that guessing through the anon key is not worth starting.
  perform pg_sleep(0.4);
  return false;
end;
$$;

create or replace function public.admin_set_staff_passphrase(p_new text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_new is null or length(p_new) < 8 then
    raise exception 'passphrase must be at least 8 characters' using errcode = 'check_violation';
  end if;
  insert into public.staff_access (id, passphrase_hash)
  values (true, crypt(p_new, gen_salt('bf')))
  on conflict (id) do update
    set passphrase_hash = crypt(p_new, gen_salt('bf')),
        updated_at = now();
end;
$$;

-- ─── The orders ──────────────────────────────────────────────────────────────
-- One row per paid order. Lines come back as a jsonb array in the order they
-- should be packed, with the engraving and the format each line was bought in.
create or replace function public.staff_orders(p_pass text, p_limit integer default 300)
returns table (
  order_ref     text,
  placed_at     timestamptz,
  amount_cents  bigint,
  email         text,
  ship_name     text,
  ship_phone    text,
  ship_notes    text,
  delivery_method text,
  ship_address  text,
  ship_city     text,
  ship_region   text,
  ship_postcode text,
  items         jsonb,
  packed        boolean,
  packed_at     timestamptz,
  tracking_number text,
  carrier       text,
  shipped_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.staff_ok(p_pass) then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  with grouped as (
    select
      -- Older rows predate Stripe checkout sessions; fall back so nothing is
      -- invisible to the person packing.
      coalesce(c.checkout_session_id, c.payment_intent_id, c.id::text) as ref,
      min(c.created_at)                                    as placed,
      -- sum() over bigint returns numeric; the cast keeps it matching the
      -- declared return type.
      sum(coalesce(c.charge_cents, 0)::bigint * greatest(coalesce(c.qty, 1), 1))::bigint as cents,
      min(coalesce(c.contact_email, c.user_email))         as mail,
      min(c.delivery_name)                                 as dname,
      min(c.delivery_phone)                                as dphone,
      min(c.delivery_notes)                                as dnotes,
      min(c.delivery_method)                               as dmethod,
      min(c.ship_address)                                  as addr,
      min(c.ship_city)                                     as city,
      min(c.ship_region)                                   as region,
      min(c.ship_postcode)                                 as postcode,
      jsonb_agg(
        jsonb_build_object(
          'fragrance_id', c.fragrance_id,
          'name',         f.name,
          'inspiration',  f.inspiration,
          'format',       c.format,
          'size_ml',      c.size_ml,
          'qty',          coalesce(c.qty, 1),
          'engraving',    c.engraving
        )
        order by f.name
      ) as lines
    from public.commits c
    left join public.fragrances f on f.id = c.fragrance_id
    where c.status = 'captured'
    group by 1
  )
  select
    g.ref, g.placed, g.cents, g.mail, g.dname, g.dphone, g.dnotes, g.dmethod,
    g.addr, g.city, g.region, g.postcode, g.lines,
    coalesce(o.packed, false), o.packed_at, o.tracking_number,
    coalesce(o.carrier, 'Australia Post'), o.shipped_at
  from grouped g
  left join public.order_fulfilment o on o.order_ref = g.ref
  order by g.placed desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

-- ─── The two things the desk writes ──────────────────────────────────────────
create or replace function public.staff_set_packed(p_pass text, p_order_ref text, p_packed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.staff_ok(p_pass) then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  insert into public.order_fulfilment (order_ref, packed, packed_at)
  values (p_order_ref, coalesce(p_packed, false), case when p_packed then now() else null end)
  on conflict (order_ref) do update
    set packed = coalesce(p_packed, false),
        packed_at = case when p_packed then coalesce(public.order_fulfilment.packed_at, now()) else null end;
end;
$$;

-- Saving a tracking number is what marks an order shipped; clearing it undoes
-- that, because the usual reason to clear one is that it was typed wrong.
create or replace function public.staff_set_tracking(p_pass text, p_order_ref text, p_tracking text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := nullif(btrim(coalesce(p_tracking, '')), '');
begin
  if not public.staff_ok(p_pass) then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  insert into public.order_fulfilment (order_ref, tracking_number, shipped_at)
  values (p_order_ref, v_clean, case when v_clean is null then null else now() end)
  on conflict (order_ref) do update
    set tracking_number = v_clean,
        shipped_at = case when v_clean is null then null else coalesce(public.order_fulfilment.shipped_at, now()) end;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and revoking from anon while
-- PUBLIC still holds it changes nothing — so every grant below starts by taking
-- it away from PUBLIC and then hands it back deliberately.
revoke execute on function public.staff_ok(text)                        from public;
revoke execute on function public.staff_orders(text, integer)           from public;
revoke execute on function public.staff_set_packed(text, text, boolean) from public;
revoke execute on function public.staff_set_tracking(text, text, text)  from public;
revoke execute on function public.admin_set_staff_passphrase(text)      from public;

-- anon included: on the desk the passphrase is the credential, not the session.
grant execute on function public.staff_orders(text, integer)            to anon, authenticated;
grant execute on function public.staff_set_packed(text, text, boolean)  to anon, authenticated;
grant execute on function public.staff_set_tracking(text, text, text)   to anon, authenticated;
grant execute on function public.admin_set_staff_passphrase(text)       to authenticated;
-- staff_ok stays private: the functions above call it as their definer, and
-- outside them it is only an oracle for guessing the passphrase.
