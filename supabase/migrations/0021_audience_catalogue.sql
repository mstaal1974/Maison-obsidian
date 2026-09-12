-- Maison Obsidian — 2026 audience catalogue
--
-- The "Fragrance Audience" sheet adds 32 scents, each with an explicit
-- Him / Her / Unisex audience, which /discover uses to decide whose shelf a
-- fragrance appears on (masculine + unisex for him, feminine + unisex for her).
-- New scents are priced flat across the range: $21 / $34 / $47.
--
-- Four of the original 25 are superseded, each a different edition of a
-- fragrance the new sheet already carries:
--   f5  Fiery Spice      (Spicebomb Extreme)   → Midnight Spice Noir (Dark Leather)
--   f15 Imperial Vintage (Aventus Absolu)      → Ventus              (Aventus)
--   f20 Fierce Amber     (SWY Intensely)       → Infinite Devotion   (same reference)
--   f23 Shadowed Oud     (Oud Wood Intense)    → Smoky Timber        (Oud Wood)
-- commits.fragrance_id cascades on delete, so a superseded scent is only
-- removed when nothing was ever reserved against it. One that carries order
-- history is left in place deliberately — retire it from the admin console once
-- those orders are settled, rather than deleting the orders with it.

insert into public.fragrances
  (id, slug, name, inspiration, tagline, story,
   price_10ml_cents, price_30ml_cents, price_50ml_cents,
   gender, moq, committed, liquid, accent, vip_only,
   top, heart, base, sort_order)
values
  ('f26','ventus','Ventus','Inspired by Creed - Aventus','Pineapple & Blackcurrant, Birch, Musk.','Bold, sophisticated, and masculine scent that balances fresh fruitiness with a deep, smoky, and woody dry-down.',2100,3400,4700,'masculine',25,0,'#5a3514','#d9b370',false,array['Pineapple & Blackcurrant','Apple','Bergamot'],array['Birch','Patchouli','Moroccan Jasmine & Rose'],array['Musk','Oakmoss','Ambergris','Vanilla'],26),
  ('f27','mariners-odyssey','Mariner''s Odyssey','Inspired by Amouage - Sindbad','Cardamom, Frankincense, Oud.','An adventurous and opulent oriental woody fragrance blending rich spices, aromatic resins, and deep oceanic amber woods.',2100,3400,4700,'unisex',25,0,'#2c1a0c','#c9a961',false,array['Cardamom','Cinnamon','Bergamot','Saffron'],array['Frankincense','Myrrh','Rose','Osmanthus'],array['Oud','Sandalwood','Amber','Leather'],27),
  ('f28','london-berry-blossom','London Berry Blossom','Inspired by Burberry - Her','Strawberry, Violet, Musk.','A vibrant, fruity-floral gourmand scent bursting with luscious red berries, jasmine, and a warm, powdery musk base.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Strawberry','Raspberry','Blackberry','Sour Cherry','Black Currant','Mandarin Orange','Lemon'],array['Violet','Jasmine'],array['Musk','Vanilla','Cashmeran','Woody Notes','Amber','Oakmoss'],28),
  ('f29','midnight-berry-noir','Midnight Berry Noir','Inspired by Burberry - Her Intense','Blackberry, Jasmine, Benzoin.','A richer, bolder, and more seductive interpretation of the original, dominated by dark blackberry, jasmine, and warm benzoin.',2100,3400,4700,'feminine',25,0,'#5a3514','#d9b370',false,array['Blackberry','Red Fruits'],array['Jasmine'],array['Benzoin'],29),
  ('f30','obsidian-gentleman','Obsidian Gentleman','Inspired by Bvlgari - Man In Black','Spices, Leather, Tonka Bean.','A charismatic amber floral fragrance featuring bold rum, intoxicating spices, tuberose, leather, and rich tonka bean.',2100,3400,4700,'masculine',25,0,'#5a3514','#d9b370',false,array['Spices','Rum','Tobacco'],array['Leather','Iris','Tuberose'],array['Tonka Bean','Guaiac Wood','Benzoin'],30),
  ('f31','mademoiselle-elegance','Mademoiselle Elegance','Inspired by Chanel - Coco Mademoiselle','Orange, Turkish Rose, Patchouli.','A timeless and alluring amber floral scent combining sparkling citrus with delicate rose, jasmine, patchouli, and sweet vanilla.',2100,3400,4700,'feminine',25,0,'#5a3514','#d9b370',false,array['Orange','Mandarin Orange','Bergamot','Orange Blossom'],array['Turkish Rose','Jasmine','Mimosa','Ylang-Ylang'],array['Patchouli','White Musk','Vanilla','Vetiver','Tonka Bean','Opoponax'],31),
  ('f32','midnight-addiction','Midnight Addiction','Inspired by Dior - Addict','Silk Tree Blossom, Night Blooming Cereus, Bourbon Vanilla.','A captivating and intensely sensual floral oriental fragrance dominated by silky night-blooming cereus, mandarin leaf, and warm bourbon vanilla.',2100,3400,4700,'feminine',25,0,'#5a3514','#d9b370',false,array['Silk Tree Blossom','Mandarin Leaf'],array['Night Blooming Cereus','Orange Blossom'],array['Bourbon Vanilla','Tonka Bean','Sandalwood'],32),
  ('f33','golden-blossom','Golden Blossom','Inspired by Dior - J''Adore','Magnolia, Tuberose, Musk.','A radiant and sophisticated floral bouquet celebrating ylang-ylang, Damask rose, and precious jasmine notes.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Magnolia','Melon','Peach','Pear','Bergamot','Mandarin Orange'],array['Tuberose','Plum','Violet','Orchid','Freesia','Jasmine','Lily-of-the-Valley','Rose'],array['Musk','Vanilla','Cedar','Blackberry'],33),
  ('f34','infinite-devotion','Infinite Devotion','Inspired by Giorgio Armani - Stronger With You Intensely','Pink Pepper, Toffee, Vanilla.','An addictive and warm fougère fragrance blending pink pepper, lavender, and a rich, sweet heart of chestnut and vanilla.',2100,3400,4700,'masculine',25,0,'#5a3514','#d9b370',false,array['Pink Pepper','Juniper','Violet'],array['Toffee','Cinnamon','Lavender','Sage'],array['Vanilla','Tonka Bean','Amber','Suede'],34),
  ('f35','ginger-ribbon','Ginger Ribbon','Inspired by Hermès - Twilly d''Hermès','Ginger, Tuberose, Sandalwood.','A spirited and daring floral fragrance driven by zesty ginger, tuberose, and warm sandalwood.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Ginger','Bitter Orange','Bergamot'],array['Tuberose','Orange Blossom','Jasmine'],array['Sandalwood','Vanilla'],35),
  ('f36','cascade-pure','Cascade Pure','Inspired by Issey Miyake - Eau D''Issey','Lotus, Lily-of-the-Valley, Musk.','A clean, aquatic, and transparent floral fragrance evoking fresh spring water mixed with delicate lotus, rose, and precious woods.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Lotus','Melon','Calone','Rose','Freesia','Lotus','Cyclamen'],array['Lily-of-the-Valley','Water Peony','Carnation','Fresh Lily'],array['Musk','Tuberose','Exotic Woods','Osmanthus','Cedar','Sandalwood','Amber'],36),
  ('f37','aura-crystal','Aura Crystal','Inspired by Maison Francis Kurkdjian - Baccarat Rouge 540','Saffron, Amberwood, Fir Resin.','A luminous and ultra-sophisticated amber floral woody scent featuring airy jasmine, radiant saffron, cedarwood, and warm ambergris.',2100,3400,4700,'unisex',25,0,'#2c1a0c','#c9a961',false,array['Saffron','Jasmine'],array['Amberwood','Ambergris'],array['Fir Resin','Cedar'],37),
  ('f38','savanna-nomad','Savanna Nomad','Inspired by Memo Paris - African Leather','Cardamom, Geranium, Leather.','An exotic and leathery spicy fragrance inspired by wild safari journeys, blending cardamom, saffron, cumin, patchouli, and rich leather.',2100,3400,4700,'unisex',25,0,'#2c1a0c','#c9a961',false,array['Cardamom','Saffron','Cumin','Bergamot'],array['Geranium','Patchouli','Oud'],array['Leather','Cumin','Vetiver','Musk','Oud'],38),
  ('f39','velvet-musk-noir','Velvet Musk Noir','Inspired by Narciso Rodriguez - For Her','African Orange Flower, Musk, Vetiver.','A magnetic and intimate musky floral chypre featuring honeyed orange blossom, osmanthus, amber, and rich patchouli.',2100,3400,4700,'feminine',25,0,'#5a3514','#d9b370',false,array['African Orange Flower','Osmanthus','Bergamot'],array['Musk','Amber'],array['Vetiver','Vanille','Patchouli'],39),
  ('f40','golden-vanilla-royale','Golden Vanilla Royale','Inspired by Parfums de Marly - Althaïr','Cinnamon, Bourbon Vanilla, Praline.','A decadent and creamy amber vanilla fragrance highlighting warm cinnamon, orange blossom, Bourbon vanilla, and praline.',2100,3400,4700,'masculine',25,0,'#5a3514','#d9b370',false,array['Cinnamon','Cardamom','Orange Blossom','Bergamot'],array['Bourbon Vanilla','Elemi'],array['Praline','Musk','Ambroxan','Guaiac Wood'],40),
  ('f41','royal-damask-rose','Royal Damask Rose','Inspired by Parfums de Marly - Delina Exclusif','Pear, Turkish Rose, Vanilla.','An opulent, powdery floral masterpiece centered around luscious Turkish rose, pear, incense, and a creamy vanilla-musk base.',2100,3400,4700,'feminine',25,0,'#2c1a0c','#c9a961',false,array['Pear','Bergamot','Litchi'],array['Turkish Rose','Oud','Incense'],array['Vanilla','Amber','Woody Notes'],41),
  ('f42','majestic-arabian-oud','Majestic Arabian Oud','Inspired by The Spirit of Dubai - Oud','Spices, Oud, Amber.','A majestic and deeply resinous oriental woody fragrance featuring rich natural oud, spices, rose, leather, and precious amber.',2100,3400,4700,'unisex',25,0,'#2c1a0c','#c9a961',false,array['Spices','Fruity Notes','Pine','Cypriol Oil','Lavender','Bergamot','Saffron'],array['Oud','Agarwood','Amber','Patchouli','Caramel','Myrrh','Incense','Rose','Floral Notes'],array['Oud','Amber','Leather','Tobacco','Cedar','Musk','Sandalwood','Vetiver'],42),
  ('f43','smoky-timber','Smoky Timber','Inspired by Tom Ford - Oud Wood','Rosewood, Oud Wood, Tonka Bean.','A luxurious and smoky woody fragrance pairing rare oud wood with exotic rosewood, cardamom, tonka bean, and amber.',2100,3400,4700,'unisex',25,0,'#2c1a0c','#c9a961',false,array['Rosewood','Cardamom','Chinese Pepper'],array['Oud Wood','Sandalwood','Vetiver'],array['Tonka Bean','Vanilla','Amber'],43),
  ('f44','solar-amber-breeze','Solar Amber Breeze','Inspired by Tom Ford - Soleil Blanc','Pistachio, Tuberose, Coconut.','A solar, amber-floral coco-infused fragrance evoking sun-drenched private islands with coconut, white florals, and amber.',2100,3400,4700,'unisex',25,0,'#5a3514','#d9b370',false,array['Pistachio','Bergamot','Cardamom','Pink Pepper'],array['Tuberose','Ylang-Ylang','Jasmine'],array['Coconut','Amber','Tonka Bean','Benzoin'],44),
  ('f45','roman-sunrise','Roman Sunrise','Inspired by Valentino - Donna Born In Roma','Black Currant, Jasmine, Bourbon Vanilla.','A modern couture floral floriental scent combining vibrant blackcurrant, jasmine, pink pepper, and rich bourbon vanilla.',2100,3400,4700,'feminine',25,0,'#2c1a0c','#c9a961',false,array['Black Currant','Pink Pepper','Bergamot'],array['Jasmine','Jasmine Sambac','Jasmine Tea'],array['Bourbon Vanilla','Cashmeran','Guaiac Wood'],45),
  ('f46','floral-explosion','Floral Explosion','Inspired by Viktor&Rolf - Flowerbomb','Tea, Orchid, Patchouli.','An explosive bouquet of sweet and opulent floral notes featuring tea, bergamot, freesia, jasmine, orchid, and patchouli.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Tea','Bergamot','Osmanthus'],array['Orchid','Jasmine','Rose','Freesia','African Orange Flower'],array['Patchouli','Musk','Vanilla'],46),
  ('f47','midnight-spice-noir','Midnight Spice Noir','Inspired by Viktor&Rolf - Spicebomb Dark Leather','Black Pepper, Cinnamon, Tobacco.','An intense and rebellious leather and spice creation blending dark black pepper, nutmeg, cinnamon, leather, and tobacco.',2100,3400,4700,'masculine',25,0,'#2c1a0c','#c9a961',false,array['Black Pepper','Nutmeg'],array['Cinnamon','Leather','Saffron'],array['Tobacco','Dark Wood','Cedar'],47),
  ('f48','freesia-horizon','Freesia Horizon','Inspired by YSL - Libre','Mandarin Orange, Jasmine, Madagascar Vanilla.','A bold and freedom-loving floral lavender fragrance featuring French lavender, Moroccan orange blossom, and warm golden ambergris.',2100,3400,4700,'feminine',25,0,'#1f3a5e','#c9a961',false,array['Mandarin Orange','Lavender','Black Currant','Petitgrain'],array['Jasmine','Lavender','Orange Blossom'],array['Madagascar Vanilla','Musk','Cedar','Ambergris'],48),
  ('f49','velvet-vanilla-indulgence','Velvet Vanilla Indulgence','Inspired by Tom Ford - Vanilla Sex','Bitter Almond, Vanilla Absolute, Tonka Bean.','A decadent, sensual amber-vanilla fragrance blending distinctive Indian vanilla tincture, creamy sandalwood, and warm floral undertones.',2100,3400,4700,'unisex',25,0,'#5a3514','#d9b370',false,array['Bitter Almond','Clary Sage'],array['Vanilla Absolute','Floral Notes','Orris'],array['Tonka Bean','Vanilla Tincture','Sandalwood','Leather'],49),
  ('f50','crimson-leather-femme','Crimson Leather Femme','Inspired by Gucci - Guilty Absolute Pour Femme','Blackberry, Bulgarian Rose, Amber.','A rich, woody-chypre fragrance highlighting dark blackberry, golden wood, bulgarian rose, and mysterious patchouli.',2100,3400,4700,'feminine',25,0,'#2c1a0c','#c9a961',false,array['Blackberry','Bergamot','Pink Pepper'],array['Bulgarian Rose','Woody Notes','Cypress','Vetiver'],array['Amber','Patchouli'],50),
  ('f51','solar-lotus-radiance','Solar Lotus Radiance','Inspired by Issey Miyake - L''Eau d''Issey Lumière','Lotus, White Flowers, Cedar.','A luminous and airy floral aquatic scent capturing morning dew, delicate lotus, freesia, and precious woods.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Lotus','Freesia','Lemon'],array['White Flowers','Ylang-Ylang','Tuberose','Rose'],array['Cedar','Sandalwood','Musk'],51),
  ('f52','chloe-chiffon-rose','Chloé Chiffon Rose','Inspired by Chloé - Eau de Parfum','Peony, Rose, Amber.','A classic, elegant, and breezy floral powdery rose fragrance paired with magnolia, lily-of-the-valley, and warm amber.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Peony','Litchi','Freesia'],array['Rose','Lily-of-the-Valley','Magnolia'],array['Amber','Virginia Cedar'],52),
  ('f53','electric-night-vip','Electric Night VIP','Inspired by Carolina Herrera - 212 VIP Black','Absinthe, Lavender, Musk.','A bold, energetic aromatic fougère fragrance blending absinthe, anise, lavender, and rich dark vanilla-musk.',2100,3400,4700,'masculine',25,0,'#1f3a5e','#c9a961',false,array['Absinthe','Anise','Fennel'],array['Lavender'],array['Musk','Vanilla Husk'],53),
  ('f54','amber-leather-scent','Amber Leather Scent','Inspired by Hugo Boss - The Scent','Peach, Osmanthus, Roasted Cocoa.','A magnetic and seductive fragrance featuring honeyed peach, exotic freesia, toasted roasted cocoa, and rich leather.',2100,3400,4700,'masculine',25,0,'#5a3514','#d9b370',false,array['Peach','Freesia'],array['Osmanthus'],array['Roasted Cocoa','Leather Notes'],54),
  ('f55','citrus-oceanic-splash','Citrus Oceanic Splash','Inspired by Louis Vuitton - Afternoon Swim','Sicilian Orange, Ginger, Ambergris.','A vibrant, uplifting citrus aquatic fragrance bursting with sun-drenched Sicilian orange, bergamot, and crisp mandarin.',2100,3400,4700,'unisex',25,0,'#1f3a5e','#c9a961',false,array['Sicilian Orange','Bergamot','Mandarin Orange'],array['Ginger','Sea Notes'],array['Ambergris','Ambroxan'],55),
  ('f56','mediterranean-sunlit-citrus','Mediterranean Sunlit Citrus','Inspired by Roberto Cavalli - Paradiso','Citrus, Jasmine, Pine.','A radiant, sun-soaked woody floral fragrance celebrating sparkling citrus, jasmine, pine, and warm cypress.',2100,3400,4700,'feminine',25,0,'#1f3a5e','#c9a961',false,array['Citrus','Mandarin Orange','Bergamot'],array['Jasmine'],array['Pine','Cypress','Laurel','Parasol Pine','White Nerium Oleander'],56),
  ('f57','weekend-blossom-breeze','Weekend Blossom Breeze','Inspired by Burberry - Weekend For Women','Mignonette, Nectarine, Sandalwood.','A relaxed, sparkling floral fragrance combining zesty tangerine, reseda plant, wild rose, peach blossom, and cedar.',2100,3400,4700,'feminine',25,0,'#9c4660','#e0b884',false,array['Mignonette','Mandarin Orange','Sage'],array['Nectarine','Blue Hyacinth','Peach Blossom','Rose','Iris','Red Cyclamen'],array['Sandalwood','Cedar','Musk'],57)

on conflict (id) do update set
  slug             = excluded.slug,
  name             = excluded.name,
  inspiration      = excluded.inspiration,
  tagline          = excluded.tagline,
  story            = excluded.story,
  price_10ml_cents = excluded.price_10ml_cents,
  price_30ml_cents = excluded.price_30ml_cents,
  price_50ml_cents = excluded.price_50ml_cents,
  gender           = excluded.gender,
  moq              = excluded.moq,
  liquid           = excluded.liquid,
  accent           = excluded.accent,
  vip_only         = excluded.vip_only,
  top              = excluded.top,
  heart            = excluded.heart,
  base             = excluded.base,
  sort_order       = excluded.sort_order;
  -- NB: `committed` intentionally omitted — maintained live by the commits trigger.

-- Retire the superseded four, but never at the cost of an order.
delete from public.fragrances f
 where f.id in ('f5', 'f15', 'f20', 'f23')
   and not exists (select 1 from public.commits c where c.fragrance_id = f.id);

do $$
declare
  v_left text;
begin
  select string_agg(id || ' (' || name || ')', ', ')
    into v_left
    from public.fragrances
   where id in ('f5', 'f15', 'f20', 'f23');
  if v_left is not null then
    raise notice 'Superseded scents kept because they carry order history: %', v_left;
  end if;
end;
$$;
