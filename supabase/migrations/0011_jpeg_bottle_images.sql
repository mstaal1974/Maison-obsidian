-- Maison Obsidian — accept JPEGs in the bottle image bucket
--
-- The admin console now takes PNG, JPG or WebP for a fragrance's bottle image.
-- A JPG has no transparency, so the storefront shows it as full-frame
-- photography instead of a cut-out on the tinted backdrop.

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg']
 where id = 'fragrance-images';
