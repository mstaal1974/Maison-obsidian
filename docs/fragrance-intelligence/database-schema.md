# Database schema

`brands` owns fragrance houses; `fragrances` is the central identity and references one brand. Notes and accords are many-to-many through ordered/weighted association tables. `products` separates sellable SKU facts from olfactory identity. `scent_vectors` stores 16 bounded dimensions and a model version. `clone_relationships` is directional; `layering_compatibility` stores each unordered pair once.

`taxonomy_terms` supports governed vocabularies and optional hierarchies; `fragrance_taxonomy` applies weighted terms. `aliases` records supplier spellings while canonical names retain uniqueness. Collections form an independent many-to-many classification. `import_runs` preserves operational outcome reports.

Foreign keys prevent deletion of referenced master data, while dependent enrichment cascades with its fragrance. Numeric scores use checks, names use case-insensitive `citext`, and trigram indexes support discovery. `fragrance_catalogue` projects an aggregate read model; `validation_issues` exposes baseline quality failures.
