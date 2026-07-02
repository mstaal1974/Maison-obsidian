-- Maison Obsidian — initial schema
--
-- Tables: fragrances, commits, subscribers
-- The frontend (src/lib/store.ts) reads live data when these exist and
-- gracefully degrades to the seed catalogue in src/lib/data.ts otherwise.
--
-- Batch model: a fragrance is poured only when `committed` reaches `moq`.
-- Each commit authorizes (never charges) the customer's card; the admin
-- captures the held payment intents once the batch is met.

create extension if not exists "pgcrypto";

-- ─── Fragrances ──────────────────────────────────────────────────────────────
-- Columns mirror the Fragrance type in src/lib/data.ts so the app can map
-- rows 1:1 with its seed shape.
create table if not exists public.fragrances (
  id            text primary key,                       -- e.g. 'f1'
  slug          text unique not null,                   -- e.g. 'obsidian-no-1'
  name          text not null,
  inspiration   text not null,
  tagline       text not null,
  story         text not null,
  price_cents   integer not null check (price_cents > 0),
  gender        text not null default 'unisex'
                check (gender in ('masculine','feminine','unisex')),
  moq           integer not null check (moq > 0),
  committed     integer not null default 0 check (committed >= 0),
  oil_percent   integer not null default 30 check (oil_percent between 0 and 40),
  volume_ml     integer not null default 50 check (volume_ml > 0),
  liquid        text not null default '#3b2a18',        -- swatch base (hex)
  accent        text not null default '#c9a961',        -- PDP glow (hex)
  vip_only      boolean not null default false,
  top           text[] not null default '{}',           -- composition — top notes
  heart         text[] not null default '{}',           -- composition — heart notes
  base          text[] not null default '{}',           -- composition — base notes
  batch_closes_at timestamptz,                           -- optional hold deadline
  sort_order    integer not null default 0,             -- catalogue display order
  created_at    timestamptz not null default now()
);
create index if not exists fragrances_sort_order_idx on public.fragrances(sort_order);

-- ─── Commits (batch reservations) ────────────────────────────────────────────
create table if not exists public.commits (
  id                uuid primary key default gen_random_uuid(),
  fragrance_id      text not null references public.fragrances(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  user_email        text,
  engraving         text,                                -- optional custom label
  payment_intent_id text,                                -- Stripe PI (authorize-later)
  status            text not null default 'authorized'
    check (status in ('authorized','captured','released','void')),
  created_at        timestamptz not null default now()
);
create index if not exists commits_fragrance_id_idx on public.commits(fragrance_id);
create index if not exists commits_user_id_idx       on public.commits(user_id);
create index if not exists commits_status_idx        on public.commits(status);

-- ─── Subscribers (general list + VIP club) ───────────────────────────────────
create table if not exists public.subscribers (
  email      text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  tier       text not null default 'general' check (tier in ('general','vip')),
  created_at timestamptz not null default now()
);
create index if not exists subscribers_tier_idx on public.subscribers(tier);

-- ─── Keep fragrances.committed in sync with the commits table ─────────────────
create or replace function public.sync_fragrance_committed()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.fragrances
       set committed = committed + 1
     where id = new.fragrance_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.fragrances
       set committed = greatest(0, committed - 1)
     where id = old.fragrance_id;
    return old;
  elsif (tg_op = 'UPDATE') then
    -- releasing a hold frees a spot back to the batch
    if (old.status <> 'released' and new.status = 'released') then
      update public.fragrances
         set committed = greatest(0, committed - 1)
       where id = new.fragrance_id;
    elsif (old.status = 'released' and new.status <> 'released') then
      update public.fragrances
         set committed = committed + 1
       where id = new.fragrance_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_commits_sync on public.commits;
create trigger trg_commits_sync
  after insert or update or delete on public.commits
  for each row execute function public.sync_fragrance_committed();

-- ─── Atomic commit RPC ───────────────────────────────────────────────────────
-- Inserts a commit and returns the batch's new state in one round-trip. Runs as
-- SECURITY DEFINER so clients don't need broad insert grants; the check keeps
-- VIP-only batches gated to VIP subscribers.
create or replace function public.commit_to_batch(
  p_fragrance_id      text,
  p_engraving         text default null,
  p_payment_intent_id text default null
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

  insert into public.commits (fragrance_id, user_id, engraving, payment_intent_id)
  values (
    p_fragrance_id,
    auth.uid(),
    nullif(btrim(coalesce(p_engraving, '')), ''),
    p_payment_intent_id
  );

  select f.committed, f.moq into committed, moq
    from public.fragrances f where f.id = p_fragrance_id;
  met := committed >= moq;
  return next;
end;
$$;

grant execute on function public.commit_to_batch(text, text, text) to anon, authenticated;

-- ─── Row-Level Security ──────────────────────────────────────────────────────
alter table public.fragrances  enable row level security;
alter table public.commits     enable row level security;
alter table public.subscribers enable row level security;

-- Catalogue is public.
drop policy if exists "fragrances_read" on public.fragrances;
create policy "fragrances_read"
  on public.fragrances for select using (true);

-- Anyone may reserve a spot (MVP). Signed-in users can read their own commits.
drop policy if exists "commits_insert" on public.commits;
create policy "commits_insert"
  on public.commits for insert with check (true);

drop policy if exists "commits_select_own" on public.commits;
create policy "commits_select_own"
  on public.commits for select
  using (auth.uid() is not null and user_id = auth.uid());

-- Subscribers: anyone may join a list; signed-in users read their own row.
drop policy if exists "subscribers_insert" on public.subscribers;
create policy "subscribers_insert"
  on public.subscribers for insert with check (true);

drop policy if exists "subscribers_select_own" on public.subscribers;
create policy "subscribers_select_own"
  on public.subscribers for select
  using (auth.uid() is not null and user_id = auth.uid());
