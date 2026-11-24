-- Maison Obsidian — gift cards on order lines
--
-- The Body & Bath page (and anything else marked as a gift) can carry a card:
-- To, From and a short note. They ride with the bag line through Stripe and are
-- recorded on the order row, so the packing desk can write the card.
--
-- record_paid_order and staff_orders are redefined with the same signatures, so
-- their existing grants stand; the only change in each is the three gift fields.

begin;

alter table public.commits
  add column if not exists gift_to   text,
  add column if not exists gift_from text,
  add column if not exists gift_note text;

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
  insert into public.commits (fragrance_id, user_id, user_email, contact_email, engraving, size_ml, charge_cents, payment_intent_id, format, qty, status, checkout_session_id, stripe_customer_id, delivery_method, delivery_name, delivery_phone, delivery_notes, ship_address, ship_city, ship_region, ship_postcode, gift_to, gift_from, gift_note)
  select r.fragrance_id, r.user_id, r.user_email, r.contact_email, r.engraving, r.size_ml, r.charge_cents, r.payment_intent_id, r.format, r.qty, r.status, r.checkout_session_id, r.stripe_customer_id, r.delivery_method, r.delivery_name, r.delivery_phone, r.delivery_notes, r.ship_address, r.ship_city, r.ship_region, r.ship_postcode, r.gift_to, r.gift_from, r.gift_note
  from jsonb_populate_recordset(null::public.commits, p_rows) r;
  get diagnostics v_count = row_count;
  insert into public.processed_checkout_sessions(session_id) values(p_session_id);
  return v_count;
end;
$$;

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
          'engraving',    c.engraving,
          'gift_to',      c.gift_to,
          'gift_from',    c.gift_from,
          'gift_note',    c.gift_note
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

commit;
