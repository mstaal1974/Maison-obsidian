-- Maison Obsidian — seed catalogue
--
-- Generated from the "Fragrance upload" spreadsheet; mirrors src/lib/data.ts so
-- the live database and the offline seed render identically. Idempotent:
-- re-running refreshes descriptive fields but never clobbers the live
-- `committed` count (that is owned by the commits trigger).

insert into public.fragrances
  (id, slug, name, inspiration, tagline, story,
   price_10ml_cents, price_30ml_cents, price_50ml_cents,
   gender, moq, committed, liquid, accent, vip_only,
   top, heart, base, sort_order)
values
  ('f1','smoky-obsidian','Smoky Obsidian','Inspired by Tom Ford - Black Lacquer','Black Ink, Leather, Ebony Wood.','Mysterious, avant-garde scent dominated by dark resins, rich ink accords, and warm, smoky woodiness.',2100,3400,4700,'unisex',20,3,'#2c1a0c','#c9a961',false,array['Black Ink','Rum'],array['Leather','Elemi Resin'],array['Ebony Wood','Olibanum'],1),
  ('f2','velvet-absolute','Velvet Absolute','Inspired by YSL - MYSLF L''Absolu','Bergamot, Orange Blossom, Amber.','Modern, deeply sensual masculine scent blending rich ambery woods with an intense, clean floral core.',2100,3500,4900,'masculine',22,10,'#5a3514','#d9b370',false,array['Bergamot','Black Pepper'],array['Orange Blossom'],array['Amber','Patchouli'],2),
  ('f3','golden-aura','Golden Aura','Inspired by Burberry - Goddess','Vanilla Infusion, Vanilla Caviar, Vanilla Absolute.','Luxurious, uniquely multi-dimensional vanilla fragrance elevated by clean lavender and rich earthy undertones.',2100,3500,4900,'feminine',25,17,'#5a3514','#d9b370',false,array['Vanilla Infusion','Lavender'],array['Vanilla Caviar'],array['Vanilla Absolute'],3),
  ('f4','midnight-velvet','Midnight Velvet','Inspired by YSL - Black Opium','Pear, Coffee, Vanilla.','Addictive, seductive gourmand blend balancing energizing dark coffee with sweet vanilla and white florals.',2000,3100,4200,'feminine',30,24,'#5a3514','#d9b370',false,array['Pear','Pink Pepper'],array['Coffee','Jasmine'],array['Vanilla','Patchouli','Cedar'],4),
  ('f5','fiery-spice','Fiery Spice','Inspired by Viktor&Rolf - Spicebomb Extreme','Black Pepper, Cinnamon, Tobacco.','Explosive, deeply warming oriental blend of heavy spices, rich tobacco, and a sweet, creamy vanilla dry-down.',2000,3100,4200,'masculine',20,10,'#2c1a0c','#c9a961',false,array['Black Pepper','Pimento'],array['Cinnamon','Cumin'],array['Tobacco','Vanilla'],5),
  ('f6','romance-vintage','Romance Vintage','Inspired by YSL - Paris','Rose, Violet, Iris.','Timeless, romantic, and powdery floral masterpiece celebrating a classic, vibrant bouquet of roses and violets.',2000,3100,4300,'feminine',22,15,'#9c4660','#e0b884',false,array['Rose','Mimosa'],array['Violet','Ylang-Ylang'],array['Iris','Sandalwood','Musk'],6),
  ('f7','floral-paradox','Floral Paradox','Inspired by Prada - Prada Paradoxe','Pear, Orange Blossom, Amber.','Vibrant, multi-faceted floral scent capturing a fresh white bouquet reinvented with intense warmth and clean musk.',2100,3300,4500,'feminine',25,19,'#5a3514','#d9b370',false,array['Pear','Tangerine','Bergamot'],array['Orange Blossom','Jasmine'],array['Amber','White Musk'],7),
  ('f8','azure-edge','Azure Edge','Inspired by YSL - Y EDP','Apple, Sage, Amberwood.','Bold, long-lasting fresh woody fragrance contrasting sharp, crisp clean notes with a deep amber base.',2000,3100,4200,'masculine',30,21,'#5a3514','#d9b370',false,array['Apple','Ginger','Bergamot'],array['Sage','Juniper Berries'],array['Amberwood','Tonka Bean'],8),
  ('f9','erosian-desire','Erosian Desire','Inspired by Versace - Eros','Mint, Tonka Bean, Vanilla.','Vibrant, high-energy fresh oriental blend showcasing sweet mint, crisp green apple, and rich, warm tonka bean.',2000,3100,4300,'masculine',20,17,'#5a3514','#d9b370',false,array['Mint','Green Apple','Lemon'],array['Tonka Bean','Ambroxan'],array['Vanilla','Cedarwood'],9),
  ('f10','sacred-smoke','Sacred Smoke','Inspired by Tom Ford - Ebene Fume','Palo Santo, Leather, Ebony Wood.','Deeply meditative, spiritual woody scent centered around warm Palo Santo smoke, rich ebony, and luxurious resins.',1900,2900,3900,'unisex',22,20,'#2c1a0c','#c9a961',false,array['Palo Santo','Incense'],array['Leather','Labdanum'],array['Ebony Wood','Guaiac Wood'],10),
  ('f11','ethereal-drift','Ethereal Drift','Inspired by Louis Vuitton - Imagination','Citron, Nigerian Ginger, Chinese Black Tea.','Ultra-refined, luminous fresh fragrance combining sparkling citrus fruits with rare black tea and warm ambroxan.',2000,3100,4200,'masculine',25,21,'#1f3a5e','#c9a961',false,array['Citron','Calabrian Bergamot'],array['Nigerian Ginger','Ceylon Cinnamon'],array['Chinese Black Tea','Ambroxan'],11),
  ('f12','imperial-oud','Imperial Oud','Inspired by Creed - Oud Zarian','Saffron, Rose, Oud.','Regal, sophisticated oriental woody blend pairing rich, smooth agarwood with warm spices and subtle leather.',2100,3400,4700,'unisex',30,18,'#2c1a0c','#c9a961',false,array['Saffron','Nutmeg'],array['Rose','Labdanum'],array['Oud','Leather','Amber'],12),
  ('f13','marine-absolute','Marine Absolute','Inspired by Giorgio Armani - Acqua Di Gio Absolu','Marine Notes, Rosemary, Patchouli.','Powerful marine fragrance where fresh sea water meets warm, elegant woods and rich patchouli.',2000,3000,4200,'masculine',20,3,'#9c4660','#e0b884',false,array['Marine Notes','Bergamot'],array['Rosemary','Lavender'],array['Patchouli','Warm Woods'],13),
  ('f14','wild-horizon','Wild Horizon','Inspired by Dior - Sauvage EDP','Calabria Bergamot, Sichuan Pepper, Ambroxan.','Fiercely fresh, raw masculine composition balancing sharp bergamot with rich, smoky vanilla and heavy ambroxan.',1900,3000,4000,'masculine',22,2,'#5a3514','#d9b370',false,array['Calabria Bergamot'],array['Sichuan Pepper','Lavender'],array['Ambroxan','Papua Vanilla'],14),
  ('f15','imperial-vintage','Imperial Vintage','Inspired by Creed - Aventus Absolu','Grapefruit, Ginger, Patchouli.','Sophisticated, darker evolution of a classic, blending rich, smoky dark woods with bright, juicy citrus top notes.',1900,3000,4100,'masculine',25,23,'#1f3a5e','#c9a961',false,array['Grapefruit','Bergamot','Blackcurrant'],array['Ginger','Cinnamon','Cardamom'],array['Patchouli','Vetiver'],15),
  ('f16','neon-pulse','Neon Pulse','Inspired by Jean Paul Gaultier - Ultra Male','Pear, Cinnamon, Black Vanilla.','Intensely sweet, high-impact masculine gourmand scent balancing spicy cinnamon with heavy black vanilla and juicy pear.',1900,2900,3900,'masculine',30,15,'#5a3514','#d9b370',false,array['Pear','Lavender','Mint'],array['Cinnamon','Clary Sage'],array['Black Vanilla','Amber'],16),
  ('f17','dark-caramel','Dark Caramel','Inspired by Azzaro - Most Wanted','Cardamom, Toffee, Amberwood.','Ultra-addictive, rich fiery fragrance combining spicy cardamom with warm toffee and a deep woody trail.',1900,2900,3900,'masculine',20,10,'#5a3514','#d9b370',false,array['Cardamom'],array['Toffee'],array['Amberwood'],17),
  ('f18','noble-woods','Noble Woods','Inspired by Creed - Spice & Wood','Apple, Angelica, Cedarwood.','Incredibly refined, aristocratic blend of crisp green apple, sharp aromatic spices, and a clean, precious wood base.',1900,2800,3800,'unisex',22,7,'#9c4660','#e0b884',false,array['Apple','Bergamot','Lemon'],array['Angelica','Clove','Pepper'],array['Cedarwood','Birch','Iris'],18),
  ('f19','golden-elixir','Golden Elixir','Inspired by Jean Paul Gaultier - Le Male Elixir','Lavender, Vanilla, Honey.','Rich, deeply aromatic oriental blend featuring intensely warm honeyed tobacco, clean lavender, and sweet tonka bean.',1900,2900,3900,'masculine',25,25,'#2c1a0c','#c9a961',false,array['Lavender','Mint'],array['Vanilla','Benzoin'],array['Honey','Tobacco','Tonka Bean'],19),
  ('f20','fierce-amber','Fierce Amber','Inspired by Giorgio Armani - Stronger With You Intensely','Pink Pepper, Toffee, Vanilla.','Addictive, cozy oriental woody scent dominated by rich, sweet toffee notes, warm cinnamon, and deep amber.',1900,2800,3800,'masculine',30,12,'#5a3514','#d9b370',false,array['Pink Pepper','Juniper'],array['Toffee','Cinnamon'],array['Vanilla','Amber','Suede'],20),
  ('f21','smoked-suede','Smoked Suede','Inspired by Tom Ford - Tuscan Leather','Raspberry, Olibanum, Leather.','Bold, ultra-luxurious lifestyle scent combining raw, heavy dark leather with sweet, bright wild raspberries.',1900,3000,4000,'unisex',20,17,'#2c1a0c','#c9a961',false,array['Raspberry','Saffron'],array['Olibanum','Jasmine'],array['Leather','Suede','Amberwood'],21),
  ('f22','dark-prestige','Dark Prestige','Inspired by BOSS Bottle Absolu','Leather Accord, Patchouli, Davana.','Deeply intense, roasted woody-amber composition featuring rich leather accords, warm patchouli, and deep cedar.',1800,2700,3600,'masculine',22,12,'#2c1a0c','#c9a961',false,array['Leather Accord'],array['Patchouli','Cedarwood'],array['Davana','Labdanum'],22),
  ('f23','shadowed-oud','Shadowed Oud','Inspired by Tom Ford - Oud Wood Intense','Angelica Root, Oud (Agarwood), Castoreum.','Rich, amplified woody fragrance delivering an earthy, primal take on traditional oud with sharp spices.',1900,2900,4000,'unisex',25,1,'#2c1a0c','#c9a961',false,array['Angelica Root','Ginger'],array['Oud (Agarwood)'],array['Castoreum','Cypress'],23),
  ('f24','celestial-fields','Celestial Fields','Inspired by Roja - Elysium Eau','Grapefruit, Lily-of-the-Valley, Ambergris.','Brilliantly bright, sophisticated fresh fragrance bursting with crisp citrus, green apple, and clean, elegant musk.',2000,3100,4200,'masculine',30,9,'#2c1a0c','#c9a961',false,array['Grapefruit','Bergamot','Lime'],array['Lily-of-the-Valley','Jasmine','Apple'],array['Ambergris','Musk','Leather'],24),
  ('f25','desert-nomad','Desert Nomad','Inspired by Tom Ford - Ombre Nomade','Raspberry, Saffron, Oud.','Masterful, high-impact oriental fragrance combining deeply smoky oud wood with rich leather and sweet, dark raspberry.',2500,4400,6300,'unisex',20,3,'#2c1a0c','#c9a961',true,array['Raspberry'],array['Saffron','Rose'],array['Oud','Leather','Incense'],25)

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
