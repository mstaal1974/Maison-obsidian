-- Maison Obsidian — launch dates for New arrivals
--
-- A fragrance with a launch date is "New" for 30 days after it (the badge,
-- /new, the home page's Just poured row and the New filter all read this).
-- A date in the future holds the fragrance back: it isn't shown in the
-- storefront and the checkout won't sell it until the day comes. No date means
-- an established scent, which is every fragrance that exists today, so
-- nothing lights up as new when this is applied.
--
-- The column is set through admin_set_launch() rather than the (much
-- redefined) admin_upsert_fragrance(), so this migration can't disturb it.

alter table public.fragrances
  add column if not exists launch_at timestamptz;

create index if not exists fragrances_launch_at_idx
  on public.fragrances(launch_at desc)
  where launch_at is not null;

create or replace function public.admin_set_launch(p_id text, p_launch_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
  update public.fragrances set launch_at = p_launch_at where id = p_id;
end;
$$;

revoke execute on function public.admin_set_launch(text, timestamptz) from public, anon;
grant execute on function public.admin_set_launch(text, timestamptz) to authenticated;

-- The Monthly Pour's surprise draw (0013) picks in the database, so it learns
-- the rule too: nothing is poured before its launch date. Same body as 0013
-- plus the launch_at condition, on the pool and on the fallback.
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
            and (f.launch_at is null or f.launch_at <= now())
            and coalesce(f.format_status ->> s.format, 'live') <> 'hidden'
            and f.id not in (select fragrance_id from public.subscription_deliveries where subscription_id = p_id)
       )
  select coalesce(
    (select id from pool order by random() limit 1),
    (select f.id from public.fragrances f where f.launch_at is null or f.launch_at <= now() order by random() limit 1)
  );
$$;
