-- Maison Obsidian — raw oil inventory + per-size commitment counts
--
-- Fragrances are filled into 10/30/50 ml bottles on demand from raw oil, so the
-- atelier tracks oil on hand (ml). Commitments carry a size_ml, so we can count
-- outstanding commitments per size and compare the implied oil demand against
-- oil on hand.

alter table public.fragrances
  add column if not exists oil_ml integer not null default 0 check (oil_ml >= 0);

-- Seed some demo oil so the coverage view isn't all-zero (only fills untouched rows).
update public.fragrances set oil_ml = 600 where oil_ml = 0;

-- Admin: set oil on hand (ml) for a fragrance.
create or replace function public.admin_set_oil(p_id text, p_oil_ml integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  update public.fragrances set oil_ml = greatest(0, coalesce(p_oil_ml, 0)) where id = p_id;
end;
$$;

grant execute on function public.admin_set_oil(text, integer) to authenticated;

-- Admin: outstanding commitments grouped by fragrance + size. "Outstanding" =
-- authorized or captured (both still need oil to fulfil); released/void don't.
create or replace function public.commit_size_counts()
returns table (fragrance_id text, size_ml integer, outstanding bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.fragrance_id, c.size_ml, count(*)::bigint
  from public.commits c
  where public.is_admin()
    and c.status in ('authorized', 'captured')
  group by c.fragrance_id, c.size_ml;
$$;

grant execute on function public.commit_size_counts() to authenticated;
