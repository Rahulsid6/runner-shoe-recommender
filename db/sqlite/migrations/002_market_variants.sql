-- Adds market-level product variants to existing SQLite knowledge bases.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shoe_market_variant (
  id TEXT PRIMARY KEY,
  shoe_version_id TEXT NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  market_code TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('men','women','unisex')),
  msrp_cents INTEGER NOT NULL CHECK (msrp_cents > 0),
  currency_code TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
  source_url TEXT,
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (shoe_version_id, market_code, gender)
);

CREATE INDEX IF NOT EXISTS idx_shoe_market_variant_market
ON shoe_market_variant (market_code, available);
