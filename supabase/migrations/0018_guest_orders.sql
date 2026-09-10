-- Maison Obsidian — guest checkout
--
-- An account is optional at checkout: a guest pays with just an email address,
-- so their order row carries no user_id. If they later create an account with
-- that same email, the order should appear in their history — so the select
-- policy also matches unclaimed (user_id is null) rows by email. A signed-in
-- customer's own rows are still only ever reachable through auth.uid(), never
-- by email.

drop policy if exists "commits_select_own" on public.commits;
create policy "commits_select_own"
  on public.commits for select
  using (
    (auth.uid() is not null and user_id = auth.uid())
    or (
      auth.uid() is not null
      and user_id is null
      and user_email is not null
      and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create index if not exists commits_user_email_idx on public.commits(lower(user_email));
