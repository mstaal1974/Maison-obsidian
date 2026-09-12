-- Maison Obsidian — the learning Scentprint
--
-- A Scentprint taken once is a snapshot. What makes it an asset is that it
-- sharpens: every bottle bought, every sample worn, every "too sweet" moves it.
-- Each of those is a signal, and the profile a customer sees is their original
-- print with the signals applied on top — so the raw answer is never lost and
-- the learning can always be replayed, audited, or undone.
--
-- Signals are keyed by share code (which is anonymous) and, when the person is
-- signed in, by user_id as well. Nothing personal is required to start
-- learning; signing in later joins the history up.

create table if not exists public.scent_signals (
  id            uuid primary key default gen_random_uuid(),
  code          text references public.scent_profiles(code) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('purchase', 'sample', 'loved', 'passed', 'feedback', 'retake')),
  fragrance_id  text references public.fragrances(id) on delete set null,
  -- { "sweet": -15, "projection": 8 } — Scentprint points, already bounded by
  -- the client and re-bounded here.
  adjustments   jsonb not null default '{}'::jsonb,
  note          text,
  weight        real not null default 1 check (weight > 0 and weight <= 3),
  created_at    timestamptz not null default now()
);

create index if not exists scent_signals_code_idx on public.scent_signals(code, created_at desc);
create index if not exists scent_signals_user_idx on public.scent_signals(user_id, created_at desc);

alter table public.scent_signals enable row level security;

-- Signals are written through the RPC below and read back by their owner: the
-- signed-in customer, or whoever holds the share code for an anonymous profile.
drop policy if exists "scent_signals_select_own" on public.scent_signals;
create policy "scent_signals_select_own"
  on public.scent_signals for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "scent_signals_admin_select" on public.scent_signals;
create policy "scent_signals_admin_select"
  on public.scent_signals for select
  using (public.is_admin());

-- ─── Record one signal ───────────────────────────────────────────────────────
create or replace function public.record_scent_signal(
  p_code         text,
  p_kind         text,
  p_adjustments  jsonb default '{}'::jsonb,
  p_fragrance_id text default null,
  p_note         text default null,
  p_weight       real default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_id   uuid;
begin
  if p_kind not in ('purchase', 'sample', 'loved', 'passed', 'feedback', 'retake') then
    raise exception 'unknown signal kind %', p_kind using errcode = 'check_violation';
  end if;
  -- An unknown code is dropped rather than raised: a signal is never worth
  -- failing a checkout or a page over.
  if v_code is not null and not exists (select 1 from public.scent_profiles where code = v_code) then
    v_code := null;
  end if;
  if v_code is null and auth.uid() is null then
    return null;
  end if;

  insert into public.scent_signals (code, user_id, kind, fragrance_id, adjustments, note, weight)
  values (
    v_code,
    auth.uid(),
    p_kind,
    nullif(btrim(coalesce(p_fragrance_id, '')), ''),
    coalesce(p_adjustments, '{}'::jsonb),
    nullif(left(btrim(coalesce(p_note, '')), 400), ''),
    least(3, greatest(0.01, coalesce(p_weight, 1)))
  )
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.record_scent_signal(text, text, jsonb, text, text, real) to anon, authenticated;

-- ─── Read a profile's signals back ───────────────────────────────────────────
-- Anonymous callers get the signals for a code they hold; signed-in callers
-- also get everything recorded under their account.
create or replace function public.scent_signals_for(p_code text)
returns table (kind text, fragrance_id text, adjustments jsonb, note text, weight real, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.kind, s.fragrance_id, s.adjustments, s.note, s.weight, s.created_at
    from public.scent_signals s
   where (p_code is not null and s.code = upper(btrim(p_code)))
      or (auth.uid() is not null and s.user_id = auth.uid())
   order by s.created_at desc
   limit 400;
$$;
grant execute on function public.scent_signals_for(text) to anon, authenticated;
