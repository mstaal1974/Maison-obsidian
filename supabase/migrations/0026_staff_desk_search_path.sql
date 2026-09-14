-- Maison Obsidian — fix: the staff desk could not find crypt()
--
-- 0025 declared its functions `set search_path = public`. On a plain Postgres
-- that is enough, because `create extension pgcrypto` installs into public. On
-- Supabase, extensions live in the `extensions` schema, so inside the function
-- crypt() is not on the path and every call to the desk failed with
--
--   ERROR: function crypt(text, text) does not exist
--   CONTEXT: PL/pgSQL function staff_ok(text) line 15 at IF
--
-- The migration itself still applied, because the SQL editor's own search_path
-- does include `extensions` — so the failure only appeared at call time.
--
-- Naming both schemas resolves under either layout: a schema that does not
-- exist is ignored in a search_path rather than being an error. Only the two
-- functions that call crypt()/gen_salt() need it; a function's SET clause
-- replaces the caller's for the duration of that function, so the three that
-- merely call staff_ok() are unaffected.
--
-- 0025 has been corrected too, for databases created from scratch. This file is
-- for one already carrying the broken version: it replaces the two functions
-- and nothing else, so no data moves and the passphrase is untouched.

set search_path = public, extensions;

create or replace function public.staff_ok(p_pass text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if public.is_admin() then
    return true;
  end if;
  if p_pass is null or length(p_pass) = 0 then
    return false;
  end if;
  select passphrase_hash into v_hash from public.staff_access where id;
  if v_hash is null then
    return false;
  end if;
  if crypt(p_pass, v_hash) = v_hash then
    return true;
  end if;
  -- Enough friction that guessing through the anon key is not worth starting.
  perform pg_sleep(0.4);
  return false;
end;
$$;

create or replace function public.admin_set_staff_passphrase(p_new text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_new is null or length(p_new) < 8 then
    raise exception 'passphrase must be at least 8 characters' using errcode = 'check_violation';
  end if;
  insert into public.staff_access (id, passphrase_hash)
  values (true, crypt(p_new, gen_salt('bf')))
  on conflict (id) do update
    set passphrase_hash = crypt(p_new, gen_salt('bf')),
        updated_at = now();
end;
$$;

-- If 0025's seed row never landed (its INSERT used crypt() at the top level and
-- can have failed the same way), put it back. Existing rows are left alone, so
-- a passphrase already set is not reset by running this.
insert into public.staff_access (id, passphrase_hash)
values (true, crypt(gen_random_uuid()::text, gen_salt('bf')))
on conflict (id) do nothing;

revoke execute on function public.staff_ok(text)                   from public;
revoke execute on function public.admin_set_staff_passphrase(text)  from public;
grant execute on function public.admin_set_staff_passphrase(text)   to authenticated;
