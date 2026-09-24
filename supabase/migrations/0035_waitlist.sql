-- Maison Obsidian — the waitlist ("Notify me")
--
-- Two kinds of "tell me when it's here":
--   · a fragrance that isn't launched yet (its launch_at is in the future) —
--     format is null, and the teaser page's "Notify me when it's poured"
--     writes it;
--   · a format marked Coming soon on a live fragrance (body wash, moisturiser,
--     the ritual set) — format is that key.
--
-- Each row is consent to one email: the one saying it has arrived. The admin
-- console sends it (/api/waitlist/notify) and stamps notified_at, so nobody
-- is emailed twice for the same thing.
--
-- Rows are written only through join_waitlist() (SECURITY DEFINER), so anyone
-- can sign up without being able to read the list. Admins read it.

create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  fragrance_id  text not null references public.fragrances(id) on delete cascade,
  format        text,                          -- null: the fragrance's launch
  email         text not null,                 -- lower-cased
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  notified_at   timestamptz
);

create unique index if not exists waitlist_one_per_email
  on public.waitlist(fragrance_id, coalesce(format, ''), email);
create index if not exists waitlist_pending_idx
  on public.waitlist(fragrance_id, format)
  where notified_at is null;

alter table public.waitlist enable row level security;
revoke all on table public.waitlist from anon, authenticated;
grant select on table public.waitlist to authenticated;

drop policy if exists "waitlist_admin_select" on public.waitlist;
create policy "waitlist_admin_select"
  on public.waitlist for select
  using (public.is_admin());

create or replace function public.join_waitlist(p_fragrance_id text, p_format text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_format text := nullif(btrim(coalesce(p_format, '')), '');
begin
  if length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;
  if v_format is not null and v_format not in ('perf10', 'perf30', 'perf50', 'car', 'wash', 'moist', 'ritual') then
    raise exception 'unknown format' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.fragrances where id = p_fragrance_id) then
    raise exception 'unknown fragrance' using errcode = 'check_violation';
  end if;
  insert into public.waitlist (fragrance_id, format, email, user_id)
  values (p_fragrance_id, v_format, v_email, auth.uid())
  on conflict do nothing;
  return true;
end;
$$;

revoke execute on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
