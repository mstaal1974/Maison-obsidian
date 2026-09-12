-- Maison Obsidian — house bottle photography
--
-- Every scent now has its own 1024 × 1024 lifestyle shot in public/assets,
-- uploaded under the inspiration reference it was styled for rather than the
-- house slug, so `image_url` is set explicitly here instead of relying on the
-- /assets/<slug>.png convention in bottleImageFor().
--
-- Paths are percent-encoded because the filenames carry spaces, ampersands and
-- em-dashes. They mirror src/lib/data.ts exactly.
--
-- Not covered: Midnight Berry Noir (Burberry Her Intense) — no shot in the
-- folder yet, so it keeps the stock fallback until one is added.

update public.fragrances f
   set image_url = v.image_url
  from (values
  ('f1', '/assets/Tom-Ford-Black-Lacquer-1.jpg'),
  ('f2', '/assets/YSL-MYSLF-L-Absolu-1.jpg'),
  ('f3', '/assets/Burberry%20Goddess.jpg'),
  ('f4', '/assets/YSL%20%E2%80%94%20Black%20Opium.jpg'),
  ('f6', '/assets/YSL%20-%20Paris.jpg'),
  ('f7', '/assets/Prada%20Paradox.jpg'),
  ('f8', '/assets/YSL%20%E2%80%94%20Y%20EDP.jpg'),
  ('f9', '/assets/Versace%20%E2%80%94%20Eros.jpg'),
  ('f10', '/assets/Tom%20Ford%20-%20%20Ebene%20Fume.jpg'),
  ('f11', '/assets/Lv%20Imagination.jpg'),
  ('f12', '/assets/Creed%20Oud%20Zarain.jpg'),
  ('f13', '/assets/Armani%20Acqua%20di%20Gio.jpg'),
  ('f14', '/assets/Dior%20Sauvage.jpg'),
  ('f16', '/assets/JPG%20Ultra%20Male.jpg'),
  ('f17', '/assets/Azzaro%20%E2%80%94%20Most%20Wanted.jpg'),
  ('f18', '/assets/Creed%20%E2%80%94%20Spice%20and%20Wood.jpg'),
  ('f19', '/assets/Jean%20Paul%20Gaultier%20%E2%80%94%20Le%20Male%20Elixir.jpg'),
  ('f21', '/assets/Tom%20Ford%20%E2%80%94%20Tuscan%20Leather.jpg'),
  ('f22', '/assets/BOSS%20Bottle%20Absolu.jpg'),
  ('f24', '/assets/Roja-Elysium-Eau-1.jpg'),
  ('f25', '/assets/Tom-Ford-Ombre-Nomade-1.jpg'),
  ('f26', '/assets/Creed%20Aventus%20Absolu.jpg'),
  ('f27', '/assets/amouage%20sindbad.jpg'),
  ('f28', '/assets/Burberry-Her-1.jpg'),
  ('f30', '/assets/Bvlgari-Man-In-Black-1.jpg'),
  ('f31', '/assets/Coco-Chanel-Mademoiselle-1.jpg'),
  ('f32', '/assets/Dior-Addict-1.jpg'),
  ('f33', '/assets/Dior-J-Adore-1.jpg'),
  ('f34', '/assets/Giorgio-Armani-Stronger-With-You-Intensely-1.jpg'),
  ('f35', '/assets/Herm-s-Twilly-d-Herm-s-1.jpg'),
  ('f36', '/assets/Issey-Miyake-Eau-D-Issey-1.jpg'),
  ('f37', '/assets/Baccarat-Rouge-540-1.jpg'),
  ('f38', '/assets/Memo-Paris-African-Leather-1.jpg'),
  ('f39', '/assets/Narciso-Rodriguez-For-Her-1.jpg'),
  ('f40', '/assets/Parfums-de-Marly-Altha-r-1.jpg'),
  ('f41', '/assets/Parfums-de-Marly-Delina-Exclusif-1.jpg'),
  ('f42', '/assets/The-Spirit-of-Dubai-Oud-1.jpg'),
  ('f43', '/assets/Tom-Ford-Oud-Wood-1.jpg'),
  ('f44', '/assets/Tom-Ford-Soleil-Blanc-1.jpg'),
  ('f45', '/assets/Valentino-Donna-Born-In-Roma-1.jpg'),
  ('f46', '/assets/Viktor-Rolf-Flowerbomb-1.jpg'),
  ('f47', '/assets/Viktor-Rolf-Spicebomb-Dark-Leather-1.jpg'),
  ('f48', '/assets/YSL-Libre-1.jpg'),
  ('f49', '/assets/Tom-Ford-Vanilla-Sex-1.jpg'),
  ('f50', '/assets/Gucci-Guilty-Absolute-Pour-Femme-1.jpg'),
  ('f51', '/assets/Issey-Miyake-L-Eau-d-Issey-Lumi-re-1.jpg'),
  ('f52', '/assets/Chlo-Eau-de-Parfum-1.jpg'),
  ('f53', '/assets/212%20VIP%20BLACK%20ELIXIR.jpg'),
  ('f54', '/assets/Hugo-Boss-The-Scent-1.jpg'),
  ('f55', '/assets/Louis-Vuitton-Afternoon-Swim-1.jpg'),
  ('f56', '/assets/Roberto-Cavalli-Paradiso-1.jpg'),
  ('f57', '/assets/Burberry-Weekend-For-Women-1.jpg')
  ) as v(id, image_url)
 where f.id = v.id;
