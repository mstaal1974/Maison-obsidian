-- Maison Obsidian — scent requests
--
-- When "Find my match" has nothing close to what a customer typed, they can
-- lodge a request for it. Rows are written via the request_scent RPC
-- (SECURITY DEFINER) so user_id is stamped from auth.uid() and anonymous
-- visitors can still ask. Admins read and triage them from the console.

create table if not exists public.scent_requests (
  id          uuid primary key default gen_random_uuid(),
  query       text not null,                 -- what the customer typed, as typed
  query_key   text not null,                 -- lower-cased, squashed key for grouping
  email       text,                          -- optional: where to tell them it's in
  user_id     uuid references auth.users(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'sourced', 'declined')),
  created_at  timestamptz not null default now()
);
create index if not exists scent_requests_key_idx     on public.scent_requests(query_key);
create index if not exists scent_requests_status_idx  on public.scent_requests(status, created_at desc);

alter table public.scent_requests enable row level security;

drop policy if exists "scent_requests_admin_select" on public.scent_requests;
create policy "scent_requests_admin_select"
  on public.scent_requests for select
  using (public.is_admin());

drop policy if exists "scent_requests_admin_update" on public.scent_requests;
create policy "scent_requests_admin_update"
  on public.scent_requests for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.request_scent(p_query text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := left(btrim(coalesce(p_query, '')), 200);
  v_id    uuid;
begin
  if v_query = '' then
    raise exception 'empty request' using errcode = 'check_violation';
  end if;
  insert into public.scent_requests (query, query_key, email, user_id)
  values (
    v_query,
    regexp_replace(lower(v_query), '[^a-z0-9]+', ' ', 'g'),
    nullif(left(btrim(coalesce(p_email, '')), 200), ''),
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.request_scent(text, text) to anon, authenticated;
