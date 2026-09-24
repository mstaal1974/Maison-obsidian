# Maison Obsidian Fragrance Intelligence Platform

MOFIP is an isolated, enterprise-oriented knowledge platform for fragrance data, product intelligence and explainable vector recommendations. It combines a normalized PostgreSQL knowledge graph, FastAPI service, governed import pipeline, Scentprint™ computation and a standalone React operations console.

## Quick start

1. Create PostgreSQL database `mofip`; run `psql -f database/schema.sql`, then `views.sql` and `seed.sql`.
2. Create a Python 3.12 environment and install `api/requirements.txt`.
3. Set `MOFIP_DATABASE_URL`, then run `uvicorn api.mofip.main:app --reload`.
4. In `frontend/`, run `npm install && npm run dev`.
5. Import a list with `python scripts/import_supplier.py supplier.xlsx --database-url "$MOFIP_DATABASE_URL"`.

The platform is intentionally independent from the existing Maison Obsidian storefront. See the linked architecture, schema, API, import, taxonomy and model guides before integration.
