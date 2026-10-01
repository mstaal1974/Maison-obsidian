-- Maison Obsidian — first-party site analytics (admin → Analytics)
--
-- What the storefront records, in its own database: page views, clicks (for
-- heatmaps), how far each page was scrolled, and the shopping events GA4 also
-- gets (view_item, add_to_cart, begin_checkout, purchase …). Together they
-- give the admin console a funnel, top pages, click and scroll heatmaps, and
-- each visit's journey from landing page to purchase.
--
-- Nothing personal is stored: a random visitor id (localStorage) and visit id
-- (sessionStorage), the page path without its query string, campaign tags,
-- the referring site's host, the screen width bucket, and for a click its
-- position and the clicked control's visible label — never what anyone types.
-- Admin, staff, account and reset pages are not recorded at all.
--
-- Rows are written only through log_site_events() (SECURITY DEFINER), in small
-- validated batches, so anyone can add events without being able to read
-- them. Admins read through the analytics_* functions below.
--
-- Retention: purge_site_events(days) deletes older rows; the admin tab offers
-- it for anything over 13 months.

create table if not exists public.site_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text not null,
  session_id  text not null,
  kind        text not null check (kind in ('page', 'click', 'scroll', 'event')),
  path        text not null,
  name        text,            -- event name (add_to_cart …) or clicked label
  x           real,            -- click: fraction of the viewport width, 0–1
  y           integer,         -- click: px from the top of the page
  page_h      integer,         -- click: page height in px when clicked
  depth       smallint,        -- scroll: deepest point reached, % of the page
  device      text check (device in ('mobile', 'tablet', 'desktop')),
  referrer    text,            -- host only, first page of a visit
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  value       numeric(10, 2),  -- event: order or item value in AUD
  items       text[]           -- event: fragrance ids involved
);

create index if not exists site_events_time_idx on public.site_events(created_at);
create index if not exists site_events_session_idx on public.site_events(session_id, created_at);
create index if not exists site_events_path_kind_idx on public.site_events(path, kind, created_at);

alter table public.site_events enable row level security;
revoke all on table public.site_events from anon, authenticated;
grant select on table public.site_events to authenticated;
drop policy if exists "site_events_admin_select" on public.site_events;
create policy "site_events_admin_select" on public.site_events for select using (public.is_admin());

-- ── Write: a batch of up to 40 events from one visit ────────────────────────
create or replace function public.log_site_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  n integer := 0;
  v_kind text;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 40 then
    return 0;
  end if;
  for e in select * from jsonb_array_elements(p_events) loop
    v_kind := coalesce(e->>'kind', '');
    continue when v_kind not in ('page', 'click', 'scroll', 'event');
    continue when coalesce(e->>'visitor', '') !~ '^[a-z0-9-]{8,40}$' or coalesce(e->>'session', '') !~ '^[a-z0-9-]{8,40}$';
    continue when coalesce(e->>'path', '') !~ '^/[A-Za-z0-9/_.~%-]{0,200}$';
    continue when e->>'path' ~ '^/(admin|staff|account|reset)(/|$)';
    -- Each event in its own block: a malformed one is skipped, not the batch.
    begin
    insert into public.site_events (visitor_id, session_id, kind, path, name, x, y, page_h, depth, device, referrer, utm_source, utm_medium, utm_campaign, value, items)
    values (
      e->>'visitor',
      e->>'session',
      v_kind,
      e->>'path',
      left(e->>'name', 80),
      case when v_kind = 'click' then least(greatest((e->>'x')::real, 0), 1) end,
      case when v_kind = 'click' then least(greatest((e->>'y')::integer, 0), 100000) end,
      case when v_kind = 'click' then least(greatest((e->>'h')::integer, 0), 100000) end,
      case when v_kind = 'scroll' then least(greatest((e->>'depth')::smallint, 0), 100) end,
      case when e->>'device' in ('mobile', 'tablet', 'desktop') then e->>'device' end,
      left(e->>'ref', 120),
      left(e->>'us', 80),
      left(e->>'um', 80),
      left(e->>'uc', 120),
      case when v_kind = 'event' and (e->>'value') ~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then (e->>'value')::numeric end,
      case when v_kind = 'event' and jsonb_typeof(e->'items') = 'array'
        then (select array_agg(left(i, 60)) from (select jsonb_array_elements_text(e->'items') i limit 20) t) end
    );
    n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end;
$$;
revoke execute on function public.log_site_events(jsonb) from public;
grant execute on function public.log_site_events(jsonb) to anon, authenticated;

-- ── Read: admin-only reports ────────────────────────────────────────────────
create or replace function public.analytics_require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
end;
$$;

-- Headline numbers, daily series, sources and devices for the last p_days.
create or replace function public.analytics_overview(p_days integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
  out jsonb;
begin
  perform public.analytics_require_admin();
  with ev as (select * from public.site_events where created_at >= since),
  sess as (
    select session_id,
      bool_or(kind = 'event' and name = 'add_to_cart') as carted,
      bool_or(kind = 'event' and name = 'purchase') as bought,
      count(*) filter (where kind = 'page') as pages,
      max(created_at) - min(created_at) as span,
      (array_agg(device order by created_at, id) filter (where device is not null))[1] as device,
      (array_agg(referrer order by created_at, id) filter (where referrer is not null))[1] as referrer,
      (array_agg(utm_source order by created_at, id) filter (where utm_source is not null))[1] as source
    from ev group by session_id
  )
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from ev),
    'sessions', (select count(*) from sess),
    'pageviews', (select count(*) from ev where kind = 'page'),
    'pages_per_session', (select round(avg(pages)::numeric, 1) from sess),
    'avg_seconds', (select round(avg(extract(epoch from span))::numeric) from sess),
    'bounce_rate', (select round(100.0 * count(*) filter (where pages <= 1) / nullif(count(*), 0), 1) from sess),
    'cart_rate', (select round(100.0 * count(*) filter (where carted) / nullif(count(*), 0), 1) from sess),
    'conversion_rate', (select round(100.0 * count(*) filter (where bought) / nullif(count(*), 0), 2) from sess),
    'revenue', (select coalesce(sum(value), 0) from ev where kind = 'event' and name = 'purchase'),
    'orders', (select count(*) from ev where kind = 'event' and name = 'purchase'),
    'daily', (select coalesce(jsonb_agg(d order by d->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(date_trunc('day', created_at at time zone 'Australia/Brisbane'), 'YYYY-MM-DD'),
          'sessions', count(distinct session_id),
          'orders', count(*) filter (where kind = 'event' and name = 'purchase')) d
        from ev group by date_trunc('day', created_at at time zone 'Australia/Brisbane')) t),
    'sources', (select coalesce(jsonb_agg(s order by (s->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('source', coalesce(source, referrer, 'direct'), 'sessions', count(*),
          'orders', count(*) filter (where bought)) s
        from sess group by coalesce(source, referrer, 'direct') order by count(*) desc limit 12) t),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', coalesce(device, 'unknown'), 'sessions', c, 'orders', o)), '[]')
        from (select device, count(*) c, count(*) filter (where bought) o from sess group by device) t)
  ) into out;
  return out;
end;
$$;

-- Visits reaching each step of the purchase funnel, in order.
create or replace function public.analytics_funnel(p_days integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
begin
  perform public.analytics_require_admin();
  return (
    with s as (
      select session_id,
        bool_or(kind = 'page') as visited,
        bool_or(name = 'view_item') as viewed,
        bool_or(name = 'add_to_cart') as carted,
        bool_or(name = 'begin_checkout') as checkout,
        bool_or(name = 'add_payment_info') as payment,
        bool_or(name = 'purchase') as bought
      from public.site_events where created_at >= since group by session_id
    )
    select jsonb_build_array(
      jsonb_build_object('step', 'Visited', 'sessions', count(*) filter (where visited)),
      jsonb_build_object('step', 'Viewed a fragrance', 'sessions', count(*) filter (where viewed)),
      jsonb_build_object('step', 'Added to bag', 'sessions', count(*) filter (where carted)),
      jsonb_build_object('step', 'Started checkout', 'sessions', count(*) filter (where checkout)),
      jsonb_build_object('step', 'Went to payment', 'sessions', count(*) filter (where payment)),
      jsonb_build_object('step', 'Purchased', 'sessions', count(*) filter (where bought))
    ) from s
  );
end;
$$;

-- Pages: views, visits, landings, exits and average scroll depth.
create or replace function public.analytics_pages(p_days integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
begin
  perform public.analytics_require_admin();
  return (
    with pv as (
      select session_id, path, created_at,
        row_number() over (partition by session_id order by created_at, id) as n,
        row_number() over (partition by session_id order by created_at desc, id desc) as r
      from public.site_events where created_at >= since and kind = 'page'
    ),
    sc as (
      select path, round(avg(depth)) as depth from (
        select session_id, path, max(depth) as depth from public.site_events
        where created_at >= since and kind = 'scroll' group by session_id, path) v
      group by path
    )
    select coalesce(jsonb_agg(p order by (p->>'views')::int desc), '[]') from (
      select jsonb_build_object('path', pv.path, 'views', count(*), 'sessions', count(distinct session_id),
        'landings', count(*) filter (where n = 1), 'exits', count(*) filter (where r = 1),
        'scroll', max(sc.depth)) p
      from pv left join sc on sc.path = pv.path
      group by pv.path order by count(*) desc limit 60
    ) t
  );
end;
$$;

-- The most common next page from each page: the site's main paths.
create or replace function public.analytics_flows(p_days integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
begin
  perform public.analytics_require_admin();
  return (
    with pv as (
      select session_id, path, lead(path) over (partition by session_id order by created_at, id) as next
      from public.site_events where created_at >= since and kind = 'page'
    )
    select coalesce(jsonb_agg(f order by (f->>'count')::int desc), '[]') from (
      select jsonb_build_object('from', path, 'to', coalesce(next, '(left)'), 'count', count(*)) f
      from pv where path is distinct from next
      group by path, coalesce(next, '(left)') order by count(*) desc limit 40
    ) t
  );
end;
$$;

-- Recent visits, each as its ordered steps. p_filter: 'all' | 'carted' | 'purchased' | 'abandoned'.
create or replace function public.analytics_journeys(p_days integer, p_filter text, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
begin
  perform public.analytics_require_admin();
  return (
    with s as (
      select session_id, min(created_at) as started, max(created_at) as ended,
        bool_or(name = 'add_to_cart') as carted, bool_or(name = 'purchase') as bought,
        max(value) filter (where name = 'purchase') as revenue
      from public.site_events where created_at >= since group by session_id
    ),
    pick as (
      select * from s
      where case coalesce(p_filter, 'all')
        when 'carted' then carted
        when 'purchased' then bought
        when 'abandoned' then carted and not bought
        else true end
      order by started desc limit greatest(1, least(p_limit, 200))
    )
    select coalesce(jsonb_agg(j order by j->>'started' desc), '[]') from (
      select jsonb_build_object(
        'session', pick.session_id, 'started', pick.started, 'seconds', extract(epoch from pick.ended - pick.started)::int,
        'bought', pick.bought, 'carted', pick.carted, 'revenue', pick.revenue,
        'device', (select device from public.site_events e where e.session_id = pick.session_id and device is not null order by created_at, id limit 1),
        'source', (select coalesce(utm_source, referrer) from public.site_events e where e.session_id = pick.session_id and coalesce(utm_source, referrer) is not null order by created_at, id limit 1),
        'steps', (select jsonb_agg(jsonb_build_object('t', e.created_at, 'kind', e.kind, 'path', e.path, 'name', e.name, 'value', e.value) order by e.created_at, e.id)
                  from (select * from public.site_events e where e.session_id = pick.session_id and e.kind in ('page', 'event') order by created_at, id limit 80) e)
      ) j from pick
    ) t
  );
end;
$$;

-- Clicks on one page for the heatmap, and how far down its visitors scrolled.
create or replace function public.analytics_heatmap(p_days integer, p_path text, p_device text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 400)));
begin
  perform public.analytics_require_admin();
  return jsonb_build_object(
    'clicks', (select coalesce(jsonb_agg(jsonb_build_array(x, y, page_h)), '[]') from (
        select x, y, page_h from public.site_events
        where created_at >= since and kind = 'click' and path = p_path and device = p_device
        order by created_at desc limit 5000) c),
    'labels', (select coalesce(jsonb_agg(jsonb_build_object('label', name, 'clicks', n) order by n desc), '[]') from (
        select name, count(*) n from public.site_events
        where created_at >= since and kind = 'click' and path = p_path and device = p_device and name is not null
        group by name order by count(*) desc limit 25) l),
    'scroll', (select jsonb_build_object(
        'visits', count(*),
        'reached25', count(*) filter (where depth >= 25),
        'reached50', count(*) filter (where depth >= 50),
        'reached75', count(*) filter (where depth >= 75),
        'reached100', count(*) filter (where depth >= 95))
      from (select session_id, max(depth) as depth from public.site_events
            where created_at >= since and kind = 'scroll' and path = p_path and device = p_device
            group by session_id) v)
  );
end;
$$;

-- Retention: delete events older than p_days (at least 30).
create or replace function public.purge_site_events(p_days integer)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.analytics_require_admin();
  delete from public.site_events where created_at < now() - make_interval(days => greatest(30, p_days));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.analytics_require_admin() from public;
revoke execute on function public.analytics_overview(integer) from public;
revoke execute on function public.analytics_funnel(integer) from public;
revoke execute on function public.analytics_pages(integer) from public;
revoke execute on function public.analytics_flows(integer) from public;
revoke execute on function public.analytics_journeys(integer, text, integer) from public;
revoke execute on function public.analytics_heatmap(integer, text, text) from public;
revoke execute on function public.purge_site_events(integer) from public;
grant execute on function public.analytics_require_admin() to authenticated;
grant execute on function public.analytics_overview(integer) to authenticated;
grant execute on function public.analytics_funnel(integer) to authenticated;
grant execute on function public.analytics_pages(integer) to authenticated;
grant execute on function public.analytics_flows(integer) to authenticated;
grant execute on function public.analytics_journeys(integer, text, integer) to authenticated;
grant execute on function public.analytics_heatmap(integer, text, text) to authenticated;
grant execute on function public.purge_site_events(integer) to authenticated;
