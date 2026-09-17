# Architecture

## Boundaries

MOFIP uses four replaceable layers: PostgreSQL is the source of truth; SQLAlchemy provides persistence; FastAPI exposes versioned JSON/OpenAPI; React provides internal administration. Batch tools communicate with PostgreSQL rather than the storefront. Configuration enters through `MOFIP_` environment variables; secrets are never stored in data files.

## Data flow

Supplier files pass through normalization, deterministic SKU deduplication, brand/fragrance identity resolution, transactional loading and validation reporting. Controlled vocabularies attach semantics. The vector builder converts weighted accords into model-versioned vectors. API scoring performs cosine similarity and returns the score for explainability.

## Operations and security

Production should place authentication and role-based authorization at the API gateway, use TLS, a least-privilege database role, private networking, encrypted backups and immutable import logs. Add request IDs, structured logs, traces, rate limits and metrics. Imports must be staged before approval for high-volume or untrusted sources.
