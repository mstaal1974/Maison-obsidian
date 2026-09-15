# Supplier import guide

Accepted inputs are CSV or Excel. Required columns are `brand`, `name`, `sku`, and `price`; optional columns include `concentration`, `size`, `product_type`, and ISO 4217 `currency`. Headers and whitespace are normalized, prices coerced to numbers, invalid rows removed and duplicate SKUs resolved with the final row winning.

Run without `--database-url` for a safe preview and optional JSON report. A database run upserts brands case-insensitively, matches fragrance variants by brand/name/concentration, then upserts products by SKU inside a transaction. `import_runs` stores counts, status and row errors.

After loading, run `validate_database.py`. Review duplicate identities, missing enrichment, aliases and clone links. Production ingestion should quarantine unexpected columns and require an operator approval between staging and publication.
