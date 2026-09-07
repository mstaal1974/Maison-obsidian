-- Maison Obsidian — one fragrance, multiple formats
--
-- The fragrance stays the master product. Each way of buying it (10/30/50 ml
-- perfume, car diffuser, body wash, moisturiser, the Ritual set) is a format.
-- Rather than one row per SKU, a fragrance carries per-format overrides:
--   • format_prices  — jsonb {format_key: cents}; unset keys use house defaults
--   • format_status  — jsonb {format_key: 'live'|'coming_soon'|'hidden'}
--   • stock_car / stock_wash / stock_moist — on-hand stock for the new formats
--     (perfume sizes keep stock_10ml/30ml/50ml; the Ritual set's availability is
--     derived from its parts, so it has no stock of its own)
-- Commits record which format was reserved.

alter table public.fragrances
  add column if not exists format_prices jsonb not null default '{}'::jsonb,
  add column if not exists format_status jsonb not null default '{}'::jsonb,
  add column if not exists stock_car   integer not null default 0 check (stock_car >= 0),
  add column if not exists stock_wash  integer not null default 0 check (stock_wash >= 0),
  add column if not exists stock_moist integer not null default 0 check (stock_moist >= 0);

alter table public.commits
  add column if not exists format text not null default 'perf50'
    check (format in ('perf10','perf30','perf50','car','wash','moist','ritual')),
  add column if not exists qty integer not null default 1 check (qty > 0);

-- Body formats aren't 10/30/50 ml bottles; relax the size check.
alter table public.commits drop constraint if exists commits_size_ml_check;
alter table public.commits add constraint commits_size_ml_check check (size_ml > 0);

-- ─── commit_to_batch: accept the format + quantity ───────────────────────────
drop function if exists public.commit_to_batch(text, text, integer, integer, text);
create or replace function public.commit_to_batch(
  p_fragrance_id      text,
  p_engraving         text default null,
  p_size_ml           integer default 50,
  p_charge_cents      integer default null,
  p_payment_intent_id text default null,
  p_format            text default 'perf50',
  p_qty               integer default 1
)
returns table (committed integer, moq integer, met boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_frag public.fragrances%rowtype;
begin
  select * into v_frag from public.fragrances where id = p_fragrance_id;
  if not found then
    raise exception 'unknown fragrance %', p_fragrance_id using errcode = 'no_data_found';
  end if;

  if v_frag.vip_only then
    if auth.uid() is null
       or not exists (
         select 1 from public.subscribers s
          where s.user_id = auth.uid() and s.tier = 'vip'
       ) then
      raise exception 'fragrance % is VIP-only', p_fragrance_id using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.commits (fragrance_id, user_id, engraving, size_ml, charge_cents, payment_intent_id, format, qty)
  values (
    p_fragrance_id,
    auth.uid(),
    nullif(btrim(coalesce(p_engraving, '')), ''),
    coalesce(p_size_ml, 50),
    p_charge_cents,
    p_payment_intent_id,
    coalesce(p_format, 'perf50'),
    greatest(1, coalesce(p_qty, 1))
  );

  select f.committed, f.moq into committed, moq
    from public.fragrances f where f.id = p_fragrance_id;
  met := committed >= moq;
  return next;
end;
$$;

grant execute on function public.commit_to_batch(text, text, integer, integer, text, text, integer) to anon, authenticated;

-- ─── Admin: patch a fragrance's format matrix ────────────────────────────────
-- p_prices merges into format_prices (a null value removes the override);
-- p_status merges into format_status; stock args null = unchanged.
create or replace function public.admin_set_formats(
  p_id          text,
  p_prices      jsonb default '{}'::jsonb,
  p_status      jsonb default '{}'::jsonb,
  p_stock_car   integer default null,
  p_stock_wash  integer default null,
  p_stock_moist integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prices jsonb;
  v_key text;
  v_val jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  select format_prices into v_prices from public.fragrances where id = p_id;
  for v_key, v_val in select * from jsonb_each(coalesce(p_prices, '{}'::jsonb)) loop
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      v_prices := v_prices - v_key;
    else
      v_prices := v_prices || jsonb_build_object(v_key, v_val);
    end if;
  end loop;

  update public.fragrances set
    format_prices = coalesce(v_prices, '{}'::jsonb),
    format_status = format_status || coalesce(p_status, '{}'::jsonb),
    stock_car   = greatest(0, coalesce(p_stock_car, stock_car)),
    stock_wash  = greatest(0, coalesce(p_stock_wash, stock_wash)),
    stock_moist = greatest(0, coalesce(p_stock_moist, stock_moist))
  where id = p_id;
end;
$$;

grant execute on function public.admin_set_formats(text, jsonb, jsonb, integer, integer, integer) to authenticated;

-- ─── admin_upsert_fragrance: persist the matrix on create/edit ───────────────
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
    top, heart, base, profile, image_url,
    format_prices, format_status,
    stock_10ml, stock_30ml, stock_50ml, stock_car, stock_wash, stock_moist,
    low_stock_threshold, sort_order
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
    coalesce(array(select jsonb_array_elements_text(p_data->'profile')), '{}'),
    nullif(p_data->>'image_url', ''),
    coalesce(p_data->'format_prices', '{}'::jsonb),
    coalesce(p_data->'format_status', '{}'::jsonb),
    coalesce((p_data->>'stock_10ml')::int, 0),
    coalesce((p_data->>'stock_30ml')::int, 0),
    coalesce((p_data->>'stock_50ml')::int, 0),
    coalesce((p_data->>'stock_car')::int, 0),
    coalesce((p_data->>'stock_wash')::int, 0),
    coalesce((p_data->>'stock_moist')::int, 0),
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
    profile          = excluded.profile,
    image_url        = excluded.image_url,
    format_prices    = excluded.format_prices,
    format_status    = excluded.format_status,
    stock_10ml       = excluded.stock_10ml,
    stock_30ml       = excluded.stock_30ml,
    stock_50ml       = excluded.stock_50ml,
    stock_car        = excluded.stock_car,
    stock_wash       = excluded.stock_wash,
    stock_moist      = excluded.stock_moist,
    low_stock_threshold = excluded.low_stock_threshold;

  return v_id;
end;
$$;

grant execute on function public.admin_upsert_fragrance(jsonb) to authenticated;
