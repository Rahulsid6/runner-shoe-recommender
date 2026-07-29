-- SQLite schema for Shoe Knowledge Base (production-ish MVP)
-- Mirrors the Postgres design but uses SQLite-friendly types.

PRAGMA foreign_keys = ON;

-- Core tables
CREATE TABLE IF NOT EXISTS shoe_family (
  id TEXT PRIMARY KEY, -- uuid string
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('road','trail','track')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (brand, model, category)
);

CREATE TABLE IF NOT EXISTS shoe_version (
  id TEXT PRIMARY KEY, -- uuid string
  family_id TEXT NOT NULL REFERENCES shoe_family(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  release_date TEXT, -- ISO date
  msrp_cents INTEGER NOT NULL CHECK (msrp_cents > 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  discontinued INTEGER NOT NULL DEFAULT 0 CHECK (discontinued IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (family_id, version_label)
);

CREATE TABLE IF NOT EXISTS shoe_specs (
  shoe_version_id TEXT PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  weight_g_men INTEGER CHECK (weight_g_men > 0),
  weight_g_women INTEGER CHECK (weight_g_women > 0),

  stack_mm_heel REAL CHECK (stack_mm_heel > 0),
  stack_mm_forefoot REAL CHECK (stack_mm_forefoot > 0),
  drop_mm REAL CHECK (drop_mm >= 0),

  plate TEXT,
  midsole_material TEXT,
  upper_material TEXT,
  outsole_material TEXT,

  -- trail
  lug_depth_mm REAL CHECK (lug_depth_mm >= 0),
  rock_plate INTEGER CHECK (rock_plate IN (0,1)),
  waterproof INTEGER CHECK (waterproof IN (0,1)),
  gaiter_compatible INTEGER CHECK (gaiter_compatible IN (0,1)),

  -- track
  spike_type TEXT,
  events_json TEXT, -- JSON array

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shoe_attributes (
  shoe_version_id TEXT PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  stability TEXT NOT NULL DEFAULT 'neutral' CHECK (stability IN ('neutral','mild','stability')),
  cushion TEXT NOT NULL DEFAULT 'balanced' CHECK (cushion IN ('firm','balanced','soft')),

  width_options_json TEXT NOT NULL DEFAULT '["regular"]', -- JSON array
  fit_notes TEXT,

  best_use_json TEXT NOT NULL DEFAULT '[]', -- JSON array
  distance_focus_json TEXT NOT NULL DEFAULT '[]', -- JSON array
  notes_json TEXT NOT NULL DEFAULT '[]', -- JSON array

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shoe_scores (
  shoe_version_id TEXT PRIMARY KEY REFERENCES shoe_version(id) ON DELETE CASCADE,

  cushioning_score REAL CHECK (cushioning_score BETWEEN 0 AND 10),
  responsiveness_score REAL CHECK (responsiveness_score BETWEEN 0 AND 10),
  stability_score REAL CHECK (stability_score BETWEEN 0 AND 10),
  durability_score REAL CHECK (durability_score BETWEEN 0 AND 10),
  value_score REAL CHECK (value_score BETWEEN 0 AND 10),

  grip_score REAL CHECK (grip_score BETWEEN 0 AND 10),
  protection_score REAL CHECK (protection_score BETWEEN 0 AND 10),

  method TEXT NOT NULL DEFAULT 'heuristic' CHECK (method IN ('heuristic','review_aggregation','ml_model','manual')),
  confidence REAL NOT NULL DEFAULT 0.6 CHECK (confidence BETWEEN 0 AND 1),

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sources/provenance
CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY, -- uuid string
  type TEXT NOT NULL CHECK (type IN ('manufacturer','retailer_feed','affiliate_feed','review','community','manual')),
  url TEXT NOT NULL UNIQUE,
  retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
  license_or_permission TEXT,
  notes TEXT,
  content_sha256 TEXT
);

CREATE TABLE IF NOT EXISTS shoe_version_source (
  shoe_version_id TEXT NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (shoe_version_id, source_id)
);

CREATE TABLE IF NOT EXISTS shoe_field_source (
  shoe_version_id TEXT NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (shoe_version_id, field_name, source_id)
);

-- Updated-at triggers
CREATE TRIGGER IF NOT EXISTS trg_shoe_family_updated
AFTER UPDATE ON shoe_family
FOR EACH ROW
BEGIN
  UPDATE shoe_family SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_shoe_version_updated
AFTER UPDATE ON shoe_version
FOR EACH ROW
BEGIN
  UPDATE shoe_version SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_shoe_specs_updated
AFTER UPDATE ON shoe_specs
FOR EACH ROW
BEGIN
  UPDATE shoe_specs SET updated_at = datetime('now') WHERE shoe_version_id = NEW.shoe_version_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_shoe_attributes_updated
AFTER UPDATE ON shoe_attributes
FOR EACH ROW
BEGIN
  UPDATE shoe_attributes SET updated_at = datetime('now') WHERE shoe_version_id = NEW.shoe_version_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_shoe_scores_updated
AFTER UPDATE ON shoe_scores
FOR EACH ROW
BEGIN
  UPDATE shoe_scores SET updated_at = datetime('now') WHERE shoe_version_id = NEW.shoe_version_id;
END;