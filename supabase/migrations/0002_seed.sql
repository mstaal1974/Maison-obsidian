-- Maison Obsidian — seed catalogue
--
-- Mirrors src/lib/data.ts so the live database and the offline seed render
-- identically. Idempotent: re-running refreshes descriptive fields but never
-- clobbers the live `committed` count (that is owned by the commits trigger).

insert into public.fragrances
  (id, slug, name, inspiration, tagline, story,
   price_cents, gender, moq, committed, liquid, accent, vip_only,
   top, heart, base, sort_order)
values
  ('f1','obsidian-no-1','Obsidian No. 1','Inspired by Aventus',
   'Smoked pineapple, birch, ambergris.',
   'A signature opening of Sicilian pineapple charred over Laotian oud smoke. Birch tar and rose absolute settle into a base of ambergris and oakmoss. Bold, executive, unmistakable.',
   18500,'masculine',20,12,'#3b2a18','#c9a961',false,
   array['Pineapple','Bergamot','Black Currant'],
   array['Birch Tar','Rose Absolute','Patchouli'],
   array['Ambergris','Oakmoss','Vanilla'],1),

  ('f2','noir-imperial','Noir Impérial','Inspired by Tobacco Vanille',
   'Pipe tobacco, cocoa, dried fig.',
   'An aged tobacco leaf wrapped in vanilla orchid and Madagascan cocoa. Dried fig and tonka bean linger like the embers of a private library long after midnight.',
   19500,'unisex',25,19,'#5a3514','#c9a961',false,
   array['Spicy Tobacco','Cardamom'],
   array['Tonka Bean','Cocoa','Dried Fig'],
   array['Vanilla Orchid','Sandalwood'],2),

  ('f3','saffron-vellum','Saffron Vellum','Inspired by Baccarat Rouge 540',
   'Saffron, jasmine, ambered woods.',
   'Persian saffron threads steeped in jasmine sambac, suspended over a glowing base of cedar and ambergris. A scent that signs the air around you in gold leaf.',
   21500,'unisex',30,30,'#a04a1c','#d9b370',false,
   array['Saffron'],
   array['Jasmine Sambac','Egyptian Jasmine'],
   array['Ambergris','Cedar','Fir Resin'],3),

  ('f4','atelier-rose','Atelier Rose','Inspired by Roses on Ice',
   'Taif rose, lychee, frozen oud.',
   'A glacial bouquet of Taif rose laid over chilled lychee and a whisper of Hindi oud. Romantic without being sweet — the floral equivalent of a black silk dress.',
   19000,'feminine',20,7,'#9c4660','#e0b884',true,
   array['Lychee','Pink Pepper'],
   array['Taif Rose','Bulgarian Rose'],
   array['White Oud','White Musk'],4),

  ('f5','khaleeji-oud','Khaleeji Oud','Inspired by Oud for Greatness',
   'Lavender, oud, saffron smoke.',
   'A diplomat''s signature. Bright lavender folds into smoked saffron and a column of Cambodian oud, anchored with patchouli that lingers on cashmere for days.',
   22500,'masculine',25,22,'#2c1a0c','#c9a961',false,
   array['Lavender','Nutmeg'],
   array['Saffron','Cambodian Oud'],
   array['Patchouli','Musk'],5),

  ('f6','bleu-marbre','Bleu Marbre','Inspired by Bleu de Chanel',
   'Citron, ginger, sandalwood.',
   'Mediterranean citron and pink pepper rise off icy ginger; a heart of nutmeg leads into sandalwood, cedar and a column of clean white musk. Effortless, year round.',
   17500,'masculine',20,5,'#1f3a5e','#c9a961',false,
   array['Citron','Pink Pepper','Ginger'],
   array['Nutmeg','Jasmine'],
   array['Sandalwood','Cedar','White Musk'],6),

  ('f7','velours-iris','Velours d''Iris','Inspired by La Vie est Belle',
   'Iris pallida, suede, vanilla orchid.',
   'Powdered Tuscan iris draped over honeyed suede, with pear blossom and orange flower lifting the heart. The base is a soft hum of vanilla orchid, tonka and praline.',
   18500,'feminine',20,11,'#b8627c','#e3bf7a',false,
   array['Pear Blossom','Black Currant'],
   array['Iris Pallida','Orange Flower','Suede Accord'],
   array['Vanilla Orchid','Tonka Bean','Praline'],7),

  ('f8','tubereuse-blanche','Tubéreuse Blanche','Inspired by Good Girl',
   'Tuberose, almond, cocoa noir.',
   'A heady stem of Indian tuberose snapped fresh, laid over salted almond and cocoa noir. Sambac jasmine fills the room; sandalwood and tonka leave the door behind you long after.',
   19500,'feminine',22,8,'#5b3b86','#d6b66f',false,
   array['Almond','Lemon','Coffee'],
   array['Tuberose','Jasmine Sambac','Cocoa Noir'],
   array['Tonka Bean','Sandalwood','White Musk'],8),

  ('f9','sauvage-onyx','Sauvage Onyx','Inspired by Sauvage Elixir',
   'Liquorice, grapefruit, cinnamon.',
   'An icy snap of Calabrian bergamot meets liquorice and grapefruit zest; cinnamon and nutmeg warm a heart of lavender absolute over patchouli, vetiver and amber.',
   19500,'masculine',25,17,'#13344f','#c9a961',false,
   array['Calabrian Bergamot','Grapefruit','Liquorice'],
   array['Cinnamon','Nutmeg','Lavender Absolute'],
   array['Patchouli','Vetiver','Amber'],9)

on conflict (id) do update set
  slug        = excluded.slug,
  name        = excluded.name,
  inspiration = excluded.inspiration,
  tagline     = excluded.tagline,
  story       = excluded.story,
  price_cents = excluded.price_cents,
  gender      = excluded.gender,
  moq         = excluded.moq,
  liquid      = excluded.liquid,
  accent      = excluded.accent,
  vip_only    = excluded.vip_only,
  top         = excluded.top,
  heart       = excluded.heart,
  base        = excluded.base,
  sort_order  = excluded.sort_order;
  -- NB: `committed` intentionally omitted — it is maintained live by the
  -- commits trigger and must not be reset on re-seed.
