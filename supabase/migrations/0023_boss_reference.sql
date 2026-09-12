-- Maison Obsidian — one inspiration reference, written without its separator
--
-- Dark Prestige was stored as "Inspired by BOSS Bottle Absolu". referenceOf()
-- splits a reference on " - ", so with no separator the whole string was read
-- as the house name: the product page showed a house and no fragrance, and a
-- search for "Hugo Boss" returned only Amber Leather Scent, since Dark Prestige
-- sat under a house of its own called "BOSS Bottle Absolu".

update public.fragrances
   set inspiration = 'Inspired by Hugo Boss - Boss Bottled Absolu'
 where id = 'f22'
   and inspiration = 'Inspired by BOSS Bottle Absolu';
