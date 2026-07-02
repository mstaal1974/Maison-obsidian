-- Maison Obsidian — reconcile the batch "committed" count with real commit rows
--
-- The batch progress number (fragrances.committed) and the admin per-size panel
-- (commit_size_counts) must always agree: the batch total is just the sum of the
-- per-size counts. They diverged because 0002 seeded committed with static launch
-- numbers that had no backing rows in the commits table, so the batch bar showed
-- e.g. 21/30 while every per-size count read 0.
--
-- This migration (a) redefines the committed-sync trigger so committed counts
-- exactly the statuses the per-size panel counts — authorized + captured — and
-- (b) recomputes committed from the commits table, discarding the seeded numbers.
-- On a catalogue with no real commits yet this resets every count to 0.

-- (a) Delta-based sync: a fragrance "holds a spot" only while a commit is
--     authorized or captured. Releasing OR voiding frees it; capturing keeps it.
create or replace function public.sync_fragrance_committed()
returns trigger
language plpgsql
as $$
declare
  old_counts int := 0;
  new_counts int := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status in ('authorized', 'captured') then
    old_counts := 1;
  end if;
  if tg_op in ('UPDATE', 'INSERT') and new.status in ('authorized', 'captured') then
    new_counts := 1;
  end if;
  if new_counts <> old_counts then
    update public.fragrances
       set committed = greatest(0, committed + (new_counts - old_counts))
     where id = coalesce(new.fragrance_id, old.fragrance_id);
  end if;
  return coalesce(new, old);
end;
$$;

-- (b) Recompute committed from real rows (idempotent — safe to re-run).
update public.fragrances f
   set committed = coalesce((
     select count(*)
       from public.commits c
      where c.fragrance_id = f.id
        and c.status in ('authorized', 'captured')
   ), 0);
