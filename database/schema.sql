BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE note_position AS ENUM ('top', 'heart', 'base');
CREATE TYPE gender_type AS ENUM ('feminine', 'masculine', 'unisex');
CREATE TYPE import_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE brands (
  id BIGSERIAL PRIMARY KEY,
  name CITEXT NOT NULL UNIQUE,
  country TEXT,
  website TEXT,
  logo TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fragrances (
  id BIGSERIAL PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  name CITEXT NOT NULL,
  concentration TEXT,
  description TEXT,
  family TEXT,
  gender gender_type,
  release_year SMALLINT CHECK (release_year BETWEEN 1700 AND 2200),
  perfumer TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, name, concentration)
);

CREATE TABLE notes (id BIGSERIAL PRIMARY KEY, name CITEXT NOT NULL UNIQUE, type TEXT, description TEXT);
CREATE TABLE fragrance_notes (
  fragrance_id BIGINT NOT NULL REFERENCES fragrances(id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE RESTRICT,
  type note_position NOT NULL,
  "order" SMALLINT NOT NULL DEFAULT 0 CHECK ("order" >= 0),
  strength NUMERIC(4,3) NOT NULL DEFAULT .5 CHECK (strength BETWEEN 0 AND 1),
  PRIMARY KEY (fragrance_id, note_id, type)
);
CREATE TABLE accords (id BIGSERIAL PRIMARY KEY, name CITEXT NOT NULL UNIQUE, description TEXT);
CREATE TABLE fragrance_accords (
  fragrance_id BIGINT NOT NULL REFERENCES fragrances(id) ON DELETE CASCADE,
  accord_id BIGINT NOT NULL REFERENCES accords(id) ON DELETE RESTRICT,
  weight NUMERIC(4,3) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (fragrance_id, accord_id)
);
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  fragrance_id BIGINT NOT NULL REFERENCES fragrances(id) ON DELETE RESTRICT,
  size TEXT NOT NULL,
  product_type TEXT NOT NULL,
  sku CITEXT NOT NULL UNIQUE,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE clone_relationships (
  id BIGSERIAL PRIMARY KEY,
  clone_id BIGINT NOT NULL REFERENCES fragrances(id) ON DELETE CASCADE,
  original_id BIGINT NOT NULL REFERENCES fragrances(id) ON DELETE CASCADE,
  accuracy_score NUMERIC(5,2) NOT NULL CHECK (accuracy_score BETWEEN 0 AND 100),
  performance_difference NUMERIC(6,2), longevity_difference NUMERIC(6,2),
  projection_difference NUMERIC(6,2), price_difference NUMERIC(12,2),
  differences TEXT, notes TEXT,
  CHECK (clone_id <> original_id), UNIQUE (clone_id, original_id)
);
CREATE TABLE scent_vectors (
  fragrance_id BIGINT PRIMARY KEY REFERENCES fragrances(id) ON DELETE CASCADE,
  warm NUMERIC(4,3), fresh NUMERIC(4,3), sweet NUMERIC(4,3), dark NUMERIC(4,3),
  woody NUMERIC(4,3), leather NUMERIC(4,3), marine NUMERIC(4,3), powdery NUMERIC(4,3),
  floral NUMERIC(4,3), fruit NUMERIC(4,3), green NUMERIC(4,3), spicy NUMERIC(4,3),
  resinous NUMERIC(4,3), luxury NUMERIC(4,3), projection NUMERIC(4,3), longevity NUMERIC(4,3),
  model_version TEXT NOT NULL DEFAULT 'mofip-v1', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(warm,fresh,sweet,dark,woody,leather,marine,powdery,floral,fruit,green,spicy,resinous,luxury,projection,longevity)=16),
  CHECK (warm BETWEEN 0 AND 1 AND fresh BETWEEN 0 AND 1 AND sweet BETWEEN 0 AND 1 AND dark BETWEEN 0 AND 1
    AND woody BETWEEN 0 AND 1 AND leather BETWEEN 0 AND 1 AND marine BETWEEN 0 AND 1 AND powdery BETWEEN 0 AND 1
    AND floral BETWEEN 0 AND 1 AND fruit BETWEEN 0 AND 1 AND green BETWEEN 0 AND 1 AND spicy BETWEEN 0 AND 1
    AND resinous BETWEEN 0 AND 1 AND luxury BETWEEN 0 AND 1 AND projection BETWEEN 0 AND 1 AND longevity BETWEEN 0 AND 1)
);

CREATE TABLE taxonomy_terms (
  id BIGSERIAL PRIMARY KEY, vocabulary TEXT NOT NULL,
  slug TEXT NOT NULL, label TEXT NOT NULL, description TEXT,
  parent_id BIGINT REFERENCES taxonomy_terms(id), active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(vocabulary, slug)
);
CREATE TABLE fragrance_taxonomy (
  fragrance_id BIGINT REFERENCES fragrances(id) ON DELETE CASCADE,
  term_id BIGINT REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  weight NUMERIC(4,3) DEFAULT 1 CHECK(weight BETWEEN 0 AND 1), PRIMARY KEY(fragrance_id, term_id)
);
CREATE TABLE aliases (
  id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL CHECK(entity_type IN ('brand','fragrance','note','accord')),
  entity_id BIGINT NOT NULL, alias CITEXT NOT NULL, source TEXT, UNIQUE(entity_type, alias)
);
CREATE TABLE collections (id BIGSERIAL PRIMARY KEY, name CITEXT NOT NULL UNIQUE, description TEXT);
CREATE TABLE fragrance_collections (fragrance_id BIGINT REFERENCES fragrances(id) ON DELETE CASCADE, collection_id BIGINT REFERENCES collections(id) ON DELETE CASCADE, PRIMARY KEY(fragrance_id, collection_id));
CREATE TABLE layering_compatibility (
  fragrance_a_id BIGINT REFERENCES fragrances(id) ON DELETE CASCADE,
  fragrance_b_id BIGINT REFERENCES fragrances(id) ON DELETE CASCADE,
  compatibility NUMERIC(5,2) NOT NULL CHECK(compatibility BETWEEN 0 AND 100), reason TEXT NOT NULL,
  CHECK(fragrance_a_id < fragrance_b_id), PRIMARY KEY(fragrance_a_id, fragrance_b_id)
);
CREATE TABLE import_runs (
  id UUID PRIMARY KEY, source_name TEXT NOT NULL, status import_status NOT NULL DEFAULT 'pending',
  rows_received INTEGER NOT NULL DEFAULT 0, rows_loaded INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);

CREATE INDEX fragrances_search_idx ON fragrances USING gin ((name::text) gin_trgm_ops);
CREATE INDEX brands_search_idx ON brands USING gin ((name::text) gin_trgm_ops);
CREATE INDEX fragrance_notes_note_idx ON fragrance_notes(note_id);
CREATE INDEX fragrance_accords_accord_idx ON fragrance_accords(accord_id);
CREATE INDEX products_fragrance_active_idx ON products(fragrance_id, active);
CREATE INDEX taxonomy_lookup_idx ON taxonomy_terms(vocabulary, active);

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER fragrances_updated BEFORE UPDATE ON fragrances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
COMMIT;
