-- Shoe Knowledge Base (Postgres) - Initial schema
-- Designed to be production-friendly:
-- - normalized shoes + versions
-- - specs
-- - derived scores with provenance
-- - sources and per-field provenance via field_sources

BEGIN;

-- Helpful extensions (uuid generation + case-insensitive text)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums
DO $$ BEGIN
  CREATE TYPE shoe_category AS ENUM ('road', 'trail', 'track');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stability_type AS ENUM ('neutral', 'mild', 'stability');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cushion_feel AS ENUM ('firm', 'balanced', 'soft');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('manufacturer', 'retailer_feed', 'affiliate_feed', 'review', 'community', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE score_method AS ENUM ('heuristic', 'review_aggregation', 'ml_model', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Core: shoe family (model line) and versions
CREATE TABLE IF NOT EXISTS shoe_family (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand citext NOT NULL,
  model citext NOT NULL,
  category shoe_category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, model, category)
);

CREATE TABLE IF NOT EXISTS shoe_version (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES shoe_family(id) ON DELETE CASCADE,
  version_label text NOT NULL, -- e.g. "26", "v13", "5", "2025"
  release_date date,
  msrp_cents integer NOT NULL CHECK (msrp_cents > 0),
  currency_code char(3) NOT NULL DEFAULT 'USD',
  discontinued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, version_label)
);

-- Specs: objective measurements
CREATE TABLE IF NOT EXISTS shoe_specs (
  shoe_version_id uuid PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  weight_g_men integer CHECK (weight_g_men > 0),
  weight_g_women integer CHECK (weight_g_women > 0),

  stack_mm_heel numeric(5,2) CHECK (stack_mm_heel > 0),
  stack_mm_forefoot numeric(5,2) CHECK (stack_mm_forefoot > 0),
  drop_mm numeric(4,2) CHECK (drop_mm >= 0),

  plate text, -- 'none' | 'nylon' | 'carbon' | etc. (keep flexible)
  midsole_material text,
  upper_material text,
  outsole_material text,

  -- trail-specific
  lug_depth_mm numeric(4,2) CHECK (lug_depth_mm >= 0),
  rock_plate boolean,
  waterproof boolean,
  gaiter_compatible boolean,

  -- track-specific
  spike_type text, -- 'spike' | 'track-flat'
  events text[],

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Attributes/tags that are not purely objective
CREATE TABLE IF NOT EXISTS shoe_attributes (
  shoe_version_id uuid PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  stability stability_type NOT NULL DEFAULT 'neutral',
  cushion cushion_feel NOT NULL DEFAULT 'balanced',
  width_options text[] NOT NULL DEFAULT ARRAY['regular']::text[],

  fit_notes text,
  best_use text[] NOT NULL DEFAULT ARRAY[]::text[],
  distance_focus text[] NOT NULL DEFAULT ARRAY[]::text[],

  notes text[] NOT NULL DEFAULT ARRAY[]::text[],

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Derived scores (0..10) with confidence and method
CREATE TABLE IF NOT EXISTS shoe_scores (
  shoe_version_id uuid PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  cushioning_score numeric(4,2) CHECK (cushioning_score BETWEEN 0 AND 10),
  responsiveness_score numeric(4,2) CHECK (responsiveness_score BETWEEN 0 AND 10),
  stability_score numeric(4,2) CHECK (stability_score BETWEEN 0 AND 10),
  durability_score numeric(4,2) CHECK (durability_score BETWEEN 0 AND 10),
  value_score numeric(4,2) CHECK (value_score BETWEEN 0 AND 10),

  -- trail
  grip_score numeric(4,2) CHECK (grip_score BETWEEN 0 AND 10),
  protection_score numeric(4,2) CHECK (protection_score BETWEEN 0 AND 10),

  method score_method NOT NULL DEFAULT 'heuristic',
  confidence numeric(3,2) NOT NULL DEFAULT 0.6 CHECK (confidence BETWEEN 0 AND 1),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sources (where we got facts from)
CREATE TABLE IF NOT EXISTS source (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type source_type NOT NULL,
  url text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  license_or_permission text,
  notes text,

  -- optional content hash for auditing/cache (store raw snapshots elsewhere)
  content_sha256 char(64),

  UNIQUE (url)
);

-- Link sources to shoes
CREATE TABLE IF NOT EXISTS shoe_version_source (
  shoe_version_id uuid NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (shoe_version_id, source_id)
);

-- Per-field provenance (field_name points to a field in specs/attributes/scores/version)
CREATE TABLE IF NOT EXISTS shoe_field_source (
  shoe_version_id uuid NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  source_id uuid NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (shoe_version_id, field_name, source_id)
);

-- Updated-at triggers (basic)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_shoe_family_updated
  BEFORE UPDATE ON shoe_family
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_shoe_version_updated
  BEFORE UPDATE ON shoe_version
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_shoe_specs_updated
  BEFORE UPDATE ON shoe_specs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_shoe_attributes_updated
  BEFORE UPDATE ON shoe_attributes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_shoe_scores_updated
  BEFORE UPDATE ON shoe_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;