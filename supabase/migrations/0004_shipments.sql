-- Maison Obsidian — shipments / fulfillment
--
-- When a batch pours (payments captured), each commit is fulfilled and shipped.
-- Shipments are provider-agnostic: the carrier/tracking fields are filled either
-- by an admin (manual) or by the create-shipment Edge Function talking to a
-- shipping provider (Shopify / Shippo / EasyPost). Customers see their own
-- shipments; admins see and manage all.

create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  commit_id       uuid references public.commits(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  fragrance_id    text references public.fragrances(id) on delete set null,
  status          text not null default 'pending'
    check (status in ('pending', 'label_created', 'shipped', 'delivered', 'cancelled')),
  provider        text,                                  -- shopify | shippo | easypost | manual
  carrier         text,                                  -- USPS | UPS | FedEx | DHL …
  service         text,                                  -- e.g. "Priority"
  tracking_number text,
  tracking_url    text,
  ship_to         jsonb,                                 -- { name, line1, city, region, postal, country }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists shipments_user_id_idx      on public.shipments(user_id);
create index if not exists shipments_commit_id_idx    on public.shipments(commit_id);
create index if not exists shipments_fragrance_id_idx on public.shipments(fragrance_id);
create index if not exists shipments_status_idx       on public.shipments(status);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shipments_updated on public.shipments;
create trigger trg_shipments_updated
  before update on public.shipments
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.shipments enable row level security;

drop policy if exists "shipments_select_own" on public.shipments;
create policy "shipments_select_own"
  on public.shipments for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "shipments_admin_select" on public.shipments;
create policy "shipments_admin_select"
  on public.shipments for select
  using (public.is_admin());

-- Admins can read every commit (for the fulfillment queue).
drop policy if exists "commits_admin_select" on public.commits;
create policy "commits_admin_select"
  on public.commits for select
  using (public.is_admin());

-- ─── Admin RPCs: fulfillment ─────────────────────────────────────────────────

-- Create a shipment for a commit, inheriting its user + fragrance.
create or replace function public.admin_create_shipment(
  p_commit_id      uuid,
  p_provider       text default 'manual',
  p_carrier        text default null,
  p_service        text default null,
  p_tracking_number text default null,
  p_tracking_url   text default null,
  p_ship_to        jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commit public.commits%rowtype;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  select * into v_commit from public.commits where id = p_commit_id;
  if not found then
    raise exception 'unknown commit %', p_commit_id using errcode = 'no_data_found';
  end if;

  insert into public.shipments (
    commit_id, user_id, fragrance_id, provider, carrier, service,
    tracking_number, tracking_url, ship_to,
    status
  ) values (
    p_commit_id, v_commit.user_id, v_commit.fragrance_id, p_provider, p_carrier, p_service,
    p_tracking_number, p_tracking_url, p_ship_to,
    case when p_tracking_number is not null then 'label_created' else 'pending' end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_set_shipment_status(
  p_id uuid,
  p_status text,
  p_tracking_number text default null,
  p_tracking_url text default null
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
  if p_status not in ('pending', 'label_created', 'shipped', 'delivered', 'cancelled') then
    raise exception 'invalid status %', p_status using errcode = 'check_violation';
  end if;
  update public.shipments set
    status          = p_status,
    tracking_number = coalesce(p_tracking_number, tracking_number),
    tracking_url    = coalesce(p_tracking_url, tracking_url)
  where id = p_id;
end;
$$;

grant execute on function public.admin_create_shipment(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_set_shipment_status(uuid, text, text, text) to authenticated;
