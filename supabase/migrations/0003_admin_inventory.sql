-- Maison Obsidian — admin access, inventory, and fragrance CRUD
--
-- Adds an admins table + is_admin() guard, per-size stock columns, and
-- SECURITY DEFINER RPCs so an admin (and only an admin) can add, edit, remove
-- and restock fragrances. RLS keeps direct table writes closed; all mutations
-- go through these guarded functions.

-- ─── Admins ──────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ─── Inventory (on-hand stock per size) ──────────────────────────────────────
alter table public.fragrances
  add column if not exists stock_10ml integer not null default 0 check (stock_10ml >= 0),
  add column if not exists stock_30ml integer not null default 0 check (stock_30ml >= 0),
  add column if not exists stock_50ml integer not null default 0 check (stock_50ml >= 0),
  add column if not exists low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0);

-- Seed some demo stock so the inventory views aren't empty (idempotent-ish:
-- only fills rows still at the default zero, so it won't stomp admin edits).
update public.fragrances
   set stock_10ml = 24, stock_30ml = 12, stock_50ml = 6
 where stock_10ml = 0 and stock_30ml = 0 and stock_50ml = 0;

-- ─── Admin RPCs: fragrance CRUD ──────────────────────────────────────────────

-- Upsert from a JSON payload (flexible for the client form). Returns the id.
create or replace function public.admin_upsert_fragrance(p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  v_id := nullif(p_data->>'id', '');
  if v_id is null then
    v_id := 'f_' || left(replace(gen_random_uuid()::text, '-', ''), 10);
  end if;

  insert into public.fragrances as f (
    id, slug, name, inspiration, tagline, story,
    price_10ml_cents, price_30ml_cents, price_50ml_cents,
    gender, moq, liquid, accent, vip_only,
    top, heart, base,
    stock_10ml, stock_30ml, stock_50ml, low_stock_threshold,
    sort_order
  ) values (
    v_id,
    p_data->>'slug',
    p_data->>'name',
    coalesce(p_data->>'inspiration', ''),
    coalesce(p_data->>'tagline', ''),
    coalesce(p_data->>'story', ''),
    coalesce((p_data->>'price_10ml_cents')::int, 0),
    coalesce((p_data->>'price_30ml_cents')::int, 0),
    coalesce((p_data->>'price_50ml_cents')::int, 0),
    coalesce(p_data->>'gender', 'unisex'),
    coalesce((p_data->>'moq')::int, 20),
    coalesce(p_data->>'liquid', '#3b2a18'),
    coalesce(p_data->>'accent', '#c9a961'),
    coalesce((p_data->>'vip_only')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(p_data->'top')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_data->'heart')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_data->'base')), '{}'),
    coalesce((p_data->>'stock_10ml')::int, 0),
    coalesce((p_data->>'stock_30ml')::int, 0),
    coalesce((p_data->>'stock_50ml')::int, 0),
    coalesce((p_data->>'low_stock_threshold')::int, 5),
    coalesce((p_data->>'sort_order')::int, (select coalesce(max(sort_order), 0) + 1 from public.fragrances))
  )
  on conflict (id) do update set
    slug             = excluded.slug,
    name             = excluded.name,
    inspiration      = excluded.inspiration,
    tagline          = excluded.tagline,
    story            = excluded.story,
    price_10ml_cents = excluded.price_10ml_cents,
    price_30ml_cents = excluded.price_30ml_cents,
    price_50ml_cents = excluded.price_50ml_cents,
    gender           = excluded.gender,
    moq              = excluded.moq,
    liquid           = excluded.liquid,
    accent           = excluded.accent,
    vip_only         = excluded.vip_only,
    top              = excluded.top,
    heart            = excluded.heart,
    base             = excluded.base,
    stock_10ml       = excluded.stock_10ml,
    stock_30ml       = excluded.stock_30ml,
    stock_50ml       = excluded.stock_50ml,
    low_stock_threshold = excluded.low_stock_threshold;

  return v_id;
end;
$$;

create or replace function public.admin_delete_fragrance(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  delete from public.fragrances where id = p_id;
end;
$$;

-- Set absolute stock for one or more sizes (null = leave unchanged).
create or replace function public.admin_set_stock(
  p_id text,
  p_stock_10ml integer default null,
  p_stock_30ml integer default null,
  p_stock_50ml integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  update public.fragrances set
    stock_10ml = greatest(0, coalesce(p_stock_10ml, stock_10ml)),
    stock_30ml = greatest(0, coalesce(p_stock_30ml, stock_30ml)),
    stock_50ml = greatest(0, coalesce(p_stock_50ml, stock_50ml))
  where id = p_id;
end;
$$;

-- Relative stock adjustment for a single size (+ restock / − fulfil).
create or replace function public.admin_adjust_stock(
  p_id text,
  p_size_ml integer,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_size_ml = 10 then
    update public.fragrances set stock_10ml = greatest(0, stock_10ml + p_delta)
      where id = p_id returning stock_10ml into v_new;
  elsif p_size_ml = 30 then
    update public.fragrances set stock_30ml = greatest(0, stock_30ml + p_delta)
      where id = p_id returning stock_30ml into v_new;
  elsif p_size_ml = 50 then
    update public.fragrances set stock_50ml = greatest(0, stock_50ml + p_delta)
      where id = p_id returning stock_50ml into v_new;
  else
    raise exception 'invalid size %', p_size_ml using errcode = 'check_violation';
  end if;
  return v_new;
end;
$$;

grant execute on function public.admin_upsert_fragrance(jsonb) to authenticated;
grant execute on function public.admin_delete_fragrance(text) to authenticated;
grant execute on function public.admin_set_stock(text, integer, integer, integer) to authenticated;
grant execute on function public.admin_adjust_stock(text, integer, integer) to authenticated;
