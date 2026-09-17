CREATE OR REPLACE VIEW fragrance_catalogue AS
SELECT f.id, b.name AS brand, f.name, f.concentration, f.family, f.gender,
       COALESCE(jsonb_agg(DISTINCT jsonb_build_object('name', n.name, 'position', fn.type, 'strength', fn.strength))
         FILTER (WHERE n.id IS NOT NULL), '[]') AS notes,
       COALESCE(jsonb_agg(DISTINCT jsonb_build_object('name', a.name, 'weight', fa.weight))
         FILTER (WHERE a.id IS NOT NULL), '[]') AS accords
FROM fragrances f JOIN brands b ON b.id=f.brand_id
LEFT JOIN fragrance_notes fn ON fn.fragrance_id=f.id LEFT JOIN notes n ON n.id=fn.note_id
LEFT JOIN fragrance_accords fa ON fa.fragrance_id=f.id LEFT JOIN accords a ON a.id=fa.accord_id
GROUP BY f.id,b.name;

CREATE OR REPLACE VIEW validation_issues AS
SELECT 'missing_description' AS issue, 'fragrance' AS entity, id, name::text AS label FROM fragrances WHERE description IS NULL OR btrim(description)=''
UNION ALL SELECT 'orphan_product','product',p.id,p.sku::text FROM products p LEFT JOIN fragrances f ON f.id=p.fragrance_id WHERE f.id IS NULL
UNION ALL SELECT 'missing_notes','fragrance',f.id,f.name::text FROM fragrances f LEFT JOIN fragrance_notes fn ON fn.fragrance_id=f.id WHERE fn.fragrance_id IS NULL;
