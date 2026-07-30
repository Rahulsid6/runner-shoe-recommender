#!/usr/bin/env python3
"""Import data/shoes.json into the SQLite knowledge base."""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.catalog_quality import quality_report

CATALOG_PATH = ROOT / "data" / "shoes.json"
DATABASE_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "db" / "sqlite" / "shoe_kb.sqlite"

MARKET_VARIANT_SCHEMA = """
CREATE TABLE IF NOT EXISTS shoe_market_variant (
  id TEXT PRIMARY KEY, shoe_version_id TEXT NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE,
  market_code TEXT NOT NULL, gender TEXT NOT NULL CHECK (gender IN ('men','women','unisex')),
  msrp_cents INTEGER NOT NULL CHECK (msrp_cents > 0), currency_code TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)), source_url TEXT,
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (shoe_version_id, market_code, gender)
);
CREATE INDEX IF NOT EXISTS idx_shoe_market_variant_market ON shoe_market_variant (market_code, available);
"""


def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def groups(shoes: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str], dict] = {}
    for shoe in shoes:
        key = shoe["brand"], shoe["model"], shoe["category"]
        record = grouped.setdefault(key, {**shoe, "men": None, "women": None})
        if shoe["gender"] in ("men", "women"):
            record[shoe["gender"]] = shoe
    return list(grouped.values())


def json_value(value: object, fallback: object) -> str:
    return json.dumps(fallback if value is None else value, separators=(",", ":"))


def main() -> None:
    if not DATABASE_PATH.exists():
        raise SystemExit(f"Database not found: {DATABASE_PATH}. Create it with db/sqlite/schema.sql first.")
    catalog = json.loads(CATALOG_PATH.read_text())
    shoes = catalog.get("shoes")
    if not isinstance(shoes, list):
        raise SystemExit("data/shoes.json must contain a shoes array.")
    report = quality_report(catalog)
    if report["summary"]["errors"]:
        raise SystemExit(f"Catalog quality check failed with {report['summary']['errors']} error(s). Run python3 scripts/catalog_quality.py for details.")

    connection = sqlite3.connect(DATABASE_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(MARKET_VARIANT_SCHEMA)
    versions = groups(shoes)
    try:
        with connection:
            connection.execute("""INSERT OR REPLACE INTO source (id,type,url,retrieved_at,license_or_permission,notes)
                VALUES ('src-india-curated-catalog','manual','catalog://data/shoes.json',datetime('now'),'Internal curated catalog','India MSRP catalog imported from data/shoes.json. Confirm product availability and price against an official India listing before publishing.')""")
            for shoe in versions:
                family_id = f"fam-{slug(shoe['brand'])}-{slug(shoe['model'])}-{slug(shoe['category'])}"
                version_id = f"ver-{slug(shoe['brand'])}-{slug(shoe['model'])}-{slug(shoe['category'])}-india-current"
                representative = shoe["men"] or shoe["women"] or shoe
                price = int(representative["msrp_inr"])
                if price <= 0:
                    raise ValueError(f"Invalid INR price for {shoe['brand']} {shoe['model']}")
                source_url = representative.get("source_url")
                source_id = f"src-{slug(shoe['brand'])}-{slug(shoe['model'])}-india" if source_url else "src-india-curated-catalog"
                if source_url:
                    connection.execute("""INSERT OR IGNORE INTO source (id,type,url,retrieved_at,license_or_permission,notes)
                        VALUES (?, 'manufacturer', ?, datetime('now'), 'Public product listing', 'Official India product page recorded with this catalog import.')""", (source_id, source_url))
                connection.execute("INSERT OR REPLACE INTO shoe_family (id,brand,model,category) VALUES (?,?,?,?)", (family_id, shoe["brand"], shoe["model"], shoe["category"]))
                connection.execute("""INSERT OR REPLACE INTO shoe_version (id,family_id,version_label,msrp_cents,currency_code,discontinued)
                    VALUES (?,?,'India current',?,'INR',0)""", (version_id, family_id, price * 100))
                connection.execute("""INSERT OR REPLACE INTO shoe_specs (shoe_version_id,weight_g_men,weight_g_women,stack_mm_heel,stack_mm_forefoot,drop_mm,lug_depth_mm,rock_plate,waterproof,gaiter_compatible)
                    VALUES (?,?,?,?,?,?,?,?,?,?)""", (version_id, (shoe["men"] or {}).get("weight_g"), (shoe["women"] or {}).get("weight_g"), representative.get("stack_mm_heel"), representative.get("stack_mm_forefoot"), representative.get("drop_mm"), representative.get("lug_depth_mm") if shoe["category"] == "trail" else None, int(bool(representative.get("rock_plate"))) if shoe["category"] == "trail" else None, int(bool(representative.get("waterproof"))) if shoe["category"] == "trail" else None, int(bool(representative.get("gaiter_compatible"))) if shoe["category"] == "trail" else None))
                connection.execute("""INSERT OR REPLACE INTO shoe_attributes (shoe_version_id,stability,cushion,width_options_json,best_use_json,distance_focus_json,notes_json)
                    VALUES (?,?,?,?,?,?,?)""", (version_id, representative.get("stability", "neutral"), representative.get("cushion", "balanced"), json_value(representative.get("width_options"), ["regular"]), json_value(representative.get("best_use"), []), json_value(representative.get("distance_focus"), []), json_value(representative.get("notes"), [])))
                scores = representative.get("scores", {})
                connection.execute("""INSERT OR REPLACE INTO shoe_scores (shoe_version_id,cushioning_score,responsiveness_score,stability_score,durability_score,value_score,grip_score,protection_score,method,confidence)
                    VALUES (?,?,?,?,?,?,?,?, 'manual', .55)""", (version_id, scores.get("cushioning"), scores.get("responsiveness"), scores.get("stability"), scores.get("durability"), scores.get("value"), scores.get("grip"), scores.get("protection")))
                connection.execute("INSERT OR REPLACE INTO shoe_version_source (shoe_version_id,source_id) VALUES (?,?)", (version_id, source_id))
                for variant in filter(None, [shoe["men"], shoe["women"]]):
                    connection.execute("""INSERT OR REPLACE INTO shoe_market_variant (id,shoe_version_id,market_code,gender,msrp_cents,currency_code,available,source_url,last_verified_at)
                        VALUES (?,?,'IN',?,?,'INR',1,?,datetime('now'))""", (f"mkt-{slug(variant['id'])}", version_id, variant["gender"], int(variant["msrp_inr"]) * 100, variant.get("source_url")))
    finally:
        connection.close()
    print(f"Imported {len(shoes)} fit records as {len(versions)} India shoe versions into {DATABASE_PATH}.")


if __name__ == "__main__":
    main()
