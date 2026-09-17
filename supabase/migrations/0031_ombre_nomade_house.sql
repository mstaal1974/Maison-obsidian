-- Maison Obsidian — Ombre Nomade is Louis Vuitton's, not Tom Ford's
--
-- Desert Nomad was seeded as "Inspired by Tom Ford - Ombre Nomade". The scent
-- it is built on is Louis Vuitton's, so the reference named the wrong house —
-- on the product page, on the card, and in the "Inspired by" search, where
-- "Louis Vuitton" found nothing and "Tom Ford" found a bottle that is not one.
--
-- The catalogue table is what a deployment reads, so the seed correction in
-- src/lib/data.ts does not reach a live site on its own. 0002 is left as it
-- was written: it has been applied everywhere it is going to be, and a fresh
-- database replays it and then this.
--
-- referenceOf() splits the brand from the scent on the dash, so the shape
-- "Inspired by <house> - <scent>" has to survive the edit.

update public.fragrances
   set inspiration = 'Inspired by Louis Vuitton - Ombre Nomade'
 where slug = 'desert-nomad'
   and inspiration = 'Inspired by Tom Ford - Ombre Nomade';
