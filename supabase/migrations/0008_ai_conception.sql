-- Maison Obsidian — AI fragrance conception: product imagery + scent profile
--
-- The admin console can now conceive a fragrance from a reference name (Claude
-- proposes the house name, copy and olfactory breakdown) and attach a transparent
-- PNG of the bottle. This migration adds:
--   • fragrances.image_url — public URL of the uploaded bottle render (null ⇒ the
--     stock bottle photography is used)
--   • fragrances.profile   — three-word scent profile, e.g. {Dark,Resinous,Woody}
--   • a public-read `fragrance-images` storage bucket that only admins may write
--   • admin_upsert_fragrance() extended to persist both new fields

alter table public.fragrances
  add column if not exists image_url text,
  add column if not exists profile   text[] not null default '{}';

-- ─── Storage: bottle renders ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fragrance-images', 'fragrance-images', true, 4194304, array['image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fragrance_images_public_read" on storage.objects;
create policy "fragrance_images_public_read"
  on storage.objects for select
  using (bucket_id = 'fragrance-images');

drop policy if exists "fragrance_images_admin_insert" on storage.objects;
create policy "fragrance_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'fragrance-images' and public.is_admin());

drop policy if exists "fragrance_images_admin_update" on storage.objects;
create policy "fragrance_images_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'fragrance-images' and public.is_admin())
  with check (bucket_id = 'fragrance-images' and public.is_admin());

drop policy if exists "fragrance_images_admin_delete" on storage.objects;
create policy "fragrance_images_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'fragrance-images' and public.is_admin());

-- ─── admin_upsert_fragrance: persist image_url + profile ─────────────────────
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
    coalesce(array(select jsonb_array_elements_text(p_data->'profile')), '{}'),
    nullif(p_data->>'image_url', ''),
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
    profile          = excluded.profile,
    image_url        = excluded.image_url,
    stock_10ml       = excluded.stock_10ml,
    stock_30ml       = excluded.stock_30ml,
    stock_50ml       = excluded.stock_50ml,
    low_stock_threshold = excluded.low_stock_threshold;

  return v_id;
end;
$$;

grant execute on function public.admin_upsert_fragrance(jsonb) to authenticated;
