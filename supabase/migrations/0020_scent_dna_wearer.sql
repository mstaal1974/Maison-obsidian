-- Maison Obsidian — Scent DNA: who the fragrance is for
--
-- /discover now opens by asking who we are pouring for, and matches only the
-- shelf that answer implies: masculine + unisex for him, feminine + unisex for
-- her, everything when no preference is given. It filters the catalogue; it
-- never changes the Scentprint, so two people who answer the questions the same
-- way get the same profile and a different set of bottles.
--
-- Stored so a shared link opens on the same shelf it was created on.

alter table public.scent_profiles
  add column if not exists wearer text not null default 'all'
    check (wearer in ('him', 'her', 'all'));

-- Both RPCs change shape, so the previous signatures go rather than sit
-- alongside as ambiguous overloads.
drop function if exists public.save_scentprint(jsonb, jsonb, text[], text, text, text);
create or replace function public.save_scentprint(
  p_dims      jsonb,
  p_behaviour jsonb default '{}'::jsonb,
  p_occasions text[] default '{}',
  p_loves     text default null,
  p_email     text default null,
  p_source    text default 'discover',
  p_wearer    text default 'all'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_wearer  text := lower(btrim(coalesce(p_wearer, 'all')));
  v_attempt integer := 0;
begin
  if p_dims is null or jsonb_typeof(p_dims) <> 'object' then
    raise exception 'a Scentprint needs its dimensions' using errcode = 'check_violation';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email' using errcode = 'check_violation';
  end if;
  if v_wearer not in ('him', 'her', 'all') then
    v_wearer := 'all';
  end if;
  loop
    v_attempt := v_attempt + 1;
    v_code := public.new_scent_code();
    begin
      insert into public.scent_profiles (code, dims, behaviour, occasions, loves, email, user_id, source, wearer)
      values (
        v_code,
        p_dims,
        coalesce(p_behaviour, '{}'::jsonb),
        coalesce(p_occasions, '{}'),
        nullif(left(btrim(coalesce(p_loves, '')), 120), ''),
        v_email,
        auth.uid(),
        left(coalesce(p_source, 'discover'), 40),
        v_wearer
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
grant execute on function public.save_scentprint(jsonb, jsonb, text[], text, text, text, text) to anon, authenticated;

-- Numbers only, as before — plus the shelf the result was built against.
drop function if exists public.get_scentprint(text);
create or replace function public.get_scentprint(p_code text)
returns table (dims jsonb, behaviour jsonb, occasions text[], loves text, wearer text)
language sql
security definer
set search_path = public
as $$
  select p.dims, p.behaviour, p.occasions, p.loves, p.wearer
    from public.scent_profiles p
   where p.code = upper(btrim(coalesce(p_code, '')))
   limit 1;
$$;
grant execute on function public.get_scentprint(text) to anon, authenticated;
