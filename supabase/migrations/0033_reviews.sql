-- Maison Obsidian — product reviews from verified buyers
--
-- Only someone who has bought a fragrance can review it: submit_review()
-- checks for a paid order line for that fragrance on the caller's account (or
-- their verified email, for orders placed as a guest). A review is held as
-- 'pending' until an admin publishes it from the console; editing a published
-- review sends it back for approval. The public sees published reviews only,
-- and never the reviewer's account id — just the name they chose to show.

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  fragrance_id  text not null references public.fragrances(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  title         text check (title is null or char_length(title) <= 80),
  body          text not null check (char_length(body) between 10 and 1500),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  status        text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (fragrance_id, user_id)
);

create index if not exists reviews_fragrance_published_idx on public.reviews(fragrance_id, created_at desc) where status = 'published';
create index if not exists reviews_pending_idx on public.reviews(created_at) where status = 'pending';

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;
-- Column grants: the reviewer's user_id is never readable through the API.
grant select (id, fragrance_id, rating, title, body, display_name, status, created_at) on public.reviews to anon, authenticated;

drop policy if exists reviews_read_published on public.reviews;
create policy reviews_read_published on public.reviews
  for select using (status = 'published');

drop policy if exists reviews_read_own on public.reviews;
create policy reviews_read_own on public.reviews
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reviews_read_admin on public.reviews;
create policy reviews_read_admin on public.reviews
  for select to authenticated using (public.is_admin());

-- ─── Has the caller bought this fragrance? ──────────────────────────────────
create or replace function public.can_review(p_fragrance_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commits c
    where c.fragrance_id = p_fragrance_id
      and c.status = 'captured'
      and (
        c.user_id = auth.uid()
        -- A guest order, placed under the email this account has confirmed.
        or exists (
          select 1 from auth.users u
          where u.id = auth.uid()
            and u.email_confirmed_at is not null
            and lower(u.email) in (lower(coalesce(c.user_email, '')), lower(coalesce(c.contact_email, '')))
        )
      )
  );
$$;

-- ─── Write or edit one's review (back to pending either way) ────────────────
create or replace function public.submit_review(
  p_fragrance_id text,
  p_rating       integer,
  p_body         text,
  p_display_name text,
  p_title        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to review' using errcode = 'insufficient_privilege';
  end if;
  if not public.can_review(p_fragrance_id) then
    raise exception 'only customers who bought this fragrance can review it' using errcode = 'insufficient_privilege';
  end if;
  insert into public.reviews (fragrance_id, user_id, rating, title, body, display_name)
  values (p_fragrance_id, auth.uid(), p_rating, nullif(trim(p_title), ''), trim(p_body), trim(p_display_name))
  on conflict (fragrance_id, user_id) do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        display_name = excluded.display_name,
        status = 'pending',
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Moderation ─────────────────────────────────────────────────────────────
create or replace function public.admin_set_review_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('pending', 'published', 'rejected') then
    raise exception 'invalid status %', p_status using errcode = 'check_violation';
  end if;
  update public.reviews set status = p_status, updated_at = now() where id = p_id;
end;
$$;

revoke execute on function public.can_review(text) from public, anon;
revoke execute on function public.submit_review(text, integer, text, text, text) from public, anon;
revoke execute on function public.admin_set_review_status(uuid, text) from public, anon;
grant execute on function public.can_review(text) to authenticated;
grant execute on function public.submit_review(text, integer, text, text, text) to authenticated;
grant execute on function public.admin_set_review_status(uuid, text) to authenticated;
