-- Maison Obsidian — customer profiles, consent and the marketing audience
--
-- Nothing about a person is used for marketing or AI personalisation unless
-- they have said yes. Two consents, both off by default:
--   • marketing_opt_in — email about new batches and offers (Spam Act: express
--     consent, recorded with time and source; withdrawn from the account page)
--   • ai_opt_in        — the concierge and the Monthly Pour's surprise draw may
--                        use their purchase / subscription / request history
-- Anonymous "inner circle" signups (the footer box) land in marketing_signups
-- keyed by email; account holders' consents live on customer_profiles and are
-- mirrored into marketing_signups so there is one audience list.

create table if not exists public.customer_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  email                text,
  marketing_opt_in     boolean not null default false,
  marketing_opt_in_at  timestamptz,
  marketing_source     text,
  ai_opt_in            boolean not null default false,
  ai_opt_in_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.marketing_signups (
  email       text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  opted_in    boolean not null default true,
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists marketing_signups_opted_idx on public.marketing_signups(opted_in, updated_at desc);

alter table public.customer_profiles enable row level security;
alter table public.marketing_signups enable row level security;

drop policy if exists "profiles_select_own" on public.customer_profiles;
create policy "profiles_select_own"
  on public.customer_profiles for select
  using (auth.uid() is not null and user_id = auth.uid());
drop policy if exists "profiles_admin_select" on public.customer_profiles;
create policy "profiles_admin_select"
  on public.customer_profiles for select
  using (public.is_admin());
drop policy if exists "signups_admin_select" on public.marketing_signups;
create policy "signups_admin_select"
  on public.marketing_signups for select
  using (public.is_admin());

-- Customers may read their own scent requests (they feed their taste profile).
drop policy if exists "scent_requests_select_own" on public.scent_requests;
create policy "scent_requests_select_own"
  on public.scent_requests for select
  using (auth.uid() is not null and user_id = auth.uid());

-- ─── Footer: anonymous inner-circle signup ───────────────────────────────────
create or replace function public.join_inner_circle(p_email text, p_source text default 'footer')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;
  insert into public.marketing_signups (email, user_id, opted_in, source)
  values (v_email, auth.uid(), true, left(coalesce(p_source, 'footer'), 40))
  on conflict (email) do update
    set opted_in = true,
        user_id = coalesce(excluded.user_id, public.marketing_signups.user_id),
        source = excluded.source,
        updated_at = now();
end;
$$;
grant execute on function public.join_inner_circle(text, text) to anon, authenticated;

-- ─── Account: set both consents ──────────────────────────────────────────────
create or replace function public.set_my_consents(p_marketing boolean, p_ai boolean, p_source text default 'account')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.customer_profiles (user_id, email, marketing_opt_in, marketing_opt_in_at, marketing_source, ai_opt_in, ai_opt_in_at)
  values (auth.uid(), v_email, p_marketing, case when p_marketing then now() end, case when p_marketing then left(coalesce(p_source, 'account'), 40) end, p_ai, case when p_ai then now() end)
  on conflict (user_id) do update
    set email = excluded.email,
        marketing_opt_in = excluded.marketing_opt_in,
        marketing_opt_in_at = case when excluded.marketing_opt_in and not public.customer_profiles.marketing_opt_in then now()
                                   when excluded.marketing_opt_in then public.customer_profiles.marketing_opt_in_at end,
        marketing_source = case when excluded.marketing_opt_in then coalesce(public.customer_profiles.marketing_source, excluded.marketing_source) end,
        ai_opt_in = excluded.ai_opt_in,
        ai_opt_in_at = case when excluded.ai_opt_in and not public.customer_profiles.ai_opt_in then now()
                            when excluded.ai_opt_in then public.customer_profiles.ai_opt_in_at end,
        updated_at = now();
  -- One audience list: mirror the marketing consent by email.
  if v_email is not null then
    insert into public.marketing_signups (email, user_id, opted_in, source)
    values (lower(v_email), auth.uid(), p_marketing, left(coalesce(p_source, 'account'), 40))
    on conflict (email) do update
      set opted_in = excluded.opted_in, user_id = excluded.user_id, updated_at = now();
  end if;
end;
$$;
grant execute on function public.set_my_consents(boolean, boolean, text) to authenticated;

-- ─── Admin: the audience in one view (RLS of the caller applies) ─────────────
create or replace view public.marketing_audience
with (security_invoker = true) as
  select s.email,
         coalesce(s.user_id, p.user_id) as user_id,
         s.opted_in as marketing_opt_in,
         coalesce(p.ai_opt_in, false) as ai_opt_in,
         s.source,
         coalesce(p.marketing_opt_in_at, s.created_at) as opted_in_at,
         s.updated_at
    from public.marketing_signups s
    left join public.customer_profiles p on p.user_id = s.user_id;

-- ─── Monthly Pour: an admin may hand the surprise draw a taste-led pick ──────
-- The processor's monthly run passes no pick and gets the uniform random draw;
-- the console passes one leaning on the customer's taste when they opted in.
create or replace function public.bill_subscription_month(
  p_id                uuid,
  p_charge_cents      integer,
  p_payment_intent_id text default null,
  p_fragrance_id      text default null
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
  if v_sub.pick_mode = 'surprise' then
    if p_fragrance_id is not null
       and exists (select 1 from public.fragrances where id = p_fragrance_id)
       and not exists (select 1 from public.subscription_deliveries where subscription_id = p_id and fragrance_id = p_fragrance_id) then
      v_frag := p_fragrance_id;
    else
      v_frag := public.draw_subscription_scent(p_id);
    end if;
  else
    v_frag := v_sub.next_fragrance_id;
  end if;
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
grant execute on function public.bill_subscription_month(uuid, integer, text, text) to authenticated;
