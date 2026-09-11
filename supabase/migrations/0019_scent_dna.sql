-- Maison Obsidian — Scent DNA (Scentprint™ profiles and share codes)
--
-- The /discover experience produces a Scentprint: sixteen scent dimensions and
-- eight behavioural attributes, 0–100. Rows here do two jobs:
--   • give every result a short, opaque share code (…/scent/7HD92K) so the link
--     works from Instagram, a QR code or an ad on any device
--   • start a customer's fragrance preference profile, which sharpens as they
--     retake the experience, buy, subscribe and ask the concierge
--
-- A code carries no personal information. An email is stored only when the
-- visitor asked us to send them the result; express consent to *marketing*
-- stays where it already lives, in marketing_signups (migration 0014), and is
-- recorded separately by the client.

create table if not exists public.scent_profiles (
  code        text primary key,
  dims        jsonb not null,                 -- { "fresh": 88, "woody": 79, … }
  behaviour   jsonb not null default '{}',    -- { "projection": 62, … }
  occasions   text[] not null default '{}',
  loves       text,                           -- a fragrance they told us they love
  email       text,                           -- only when they asked for it by email
  user_id     uuid references auth.users(id) on delete set null,
  source      text,                           -- discover / scent-dna / campaign tag
  created_at  timestamptz not null default now()
);
create index if not exists scent_profiles_created_idx on public.scent_profiles(created_at desc);
create index if not exists scent_profiles_email_idx   on public.scent_profiles(lower(email));
create index if not exists scent_profiles_user_idx    on public.scent_profiles(user_id);

alter table public.scent_profiles enable row level security;

-- Reading a profile goes through get_scentprint (which never returns the email),
-- so no public select policy exists. Customers may read their own rows; admins
-- read the lot for the audience console.
drop policy if exists "scent_profiles_select_own" on public.scent_profiles;
create policy "scent_profiles_select_own"
  on public.scent_profiles for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "scent_profiles_admin_select" on public.scent_profiles;
create policy "scent_profiles_admin_select"
  on public.scent_profiles for select
  using (public.is_admin());

-- ─── Share codes ─────────────────────────────────────────────────────────────
-- Crockford base32 without I, L, O or U: six characters a person can read off a
-- phone screen or a printed QR without landing on somebody else's result.
create or replace function public.new_scent_code()
returns text
language plpgsql
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code text;
  v_i    integer;
begin
  v_code := '';
  for v_i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return v_code;
end;
$$;

-- ─── Save a Scentprint, get a code back ──────────────────────────────────────
create or replace function public.save_scentprint(
  p_dims      jsonb,
  p_behaviour jsonb default '{}'::jsonb,
  p_occasions text[] default '{}',
  p_loves     text default null,
  p_email     text default null,
  p_source    text default 'discover'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_attempt integer := 0;
begin
  if p_dims is null or jsonb_typeof(p_dims) <> 'object' then
    raise exception 'a Scentprint needs its dimensions' using errcode = 'check_violation';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;
  loop
    v_attempt := v_attempt + 1;
    v_code := public.new_scent_code();
    begin
      insert into public.scent_profiles (code, dims, behaviour, occasions, loves, email, user_id, source)
      values (
        v_code,
        p_dims,
        coalesce(p_behaviour, '{}'::jsonb),
        coalesce(p_occasions, '{}'),
        nullif(left(btrim(coalesce(p_loves, '')), 120), ''),
        v_email,
        auth.uid(),
        left(coalesce(p_source, 'discover'), 40)
      );
      return v_code;
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;
end;
$$;
grant execute on function public.save_scentprint(jsonb, jsonb, text[], text, text, text) to anon, authenticated;

-- ─── Open a shared result ────────────────────────────────────────────────────
-- Numbers only: the email and the account behind a profile never leave the row.
create or replace function public.get_scentprint(p_code text)
returns table (dims jsonb, behaviour jsonb, occasions text[], loves text)
language sql
security definer
set search_path = public
as $$
  select p.dims, p.behaviour, p.occasions, p.loves
    from public.scent_profiles p
   where p.code = upper(btrim(coalesce(p_code, '')))
   limit 1;
$$;
grant execute on function public.get_scentprint(text) to anon, authenticated;

-- ─── Lead capture: attach an email to a result already saved ─────────────────
-- Called when the visitor asks for their Scentprint by email, so a result isn't
-- stored twice. Only fills an empty slot: a code someone else already claimed
-- cannot be overwritten by whoever holds the link.
create or replace function public.attach_scentprint_email(p_code text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_hit   integer;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;
  update public.scent_profiles
     set email = v_email,
         user_id = coalesce(user_id, auth.uid())
   where code = upper(btrim(coalesce(p_code, '')))
     and email is null;
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$$;
grant execute on function public.attach_scentprint_email(text, text) to anon, authenticated;
