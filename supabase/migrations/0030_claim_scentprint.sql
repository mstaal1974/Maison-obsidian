-- Maison Obsidian — a Scentprint follows the person, not the browser
--
-- save_scentprint already stamps auth.uid() on a profile made while signed in,
-- so those rows are the customer's from the moment they exist. The gap is the
-- ordinary order of events: most people take the Scent DNA first and make an
-- account afterwards, and that row is left with user_id null for good.
--
-- attach_scentprint_email claims such a row, but only as a side effect of
-- writing an address into it, and on this table `email` means "they asked us to
-- send it to them". Signing in is not that request, so claiming needs its own
-- door rather than borrowing one that says something untrue.
--
-- Only an unclaimed row can be claimed, and only by someone holding its code —
-- which in practice is the browser that made it. A row already belonging to an
-- account is left alone, so a shared link cannot take somebody's profile.

create or replace function public.claim_scentprint(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hit integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.scent_profiles
     set user_id = auth.uid()
   where code = upper(btrim(coalesce(p_code, '')))
     and user_id is null;
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$$;

grant execute on function public.claim_scentprint(text) to authenticated;
