#!/usr/bin/env node

/*
 * Import data/shoes.json into the local SQLite knowledge base.
 *
 * The app catalog has one record per product fit. The KB models a shoe version,
 * so men’s and women’s records for the same model are combined into one version
 * with separate weight fields.
 *
 * Usage:
 *   node scripts/import-india-catalog.js
 *   node scripts/import-india-catalog.js /path/to/shoe_kb.sqlite
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const catalogPath = path.join(repoRoot, "data", "shoes.json");
const databasePath = process.argv[2] || path.join(repoRoot, "db", "sqlite", "shoe_kb.sqlite");

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function idPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function json(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function groupByVersion(shoes) {
  const groups = new Map();
  for (const shoe of shoes) {
    const key = [shoe.brand, shoe.model, shoe.category].join("\u0000");
    const group = groups.get(key) ?? { ...shoe, men: null, women: null };
    if (shoe.gender === "men") group.men = shoe;
    if (shoe.gender === "women") group.women = shoe;
    groups.set(key, group);
  }
  return [...groups.values()];
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (!Array.isArray(catalog.shoes)) throw new Error("data/shoes.json must contain a shoes array.");
  if (!fs.existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);

  const versions = groupByVersion(catalog.shoes);
  const statements = [
    "PRAGMA foreign_keys = ON;",
    "CREATE TABLE IF NOT EXISTS shoe_market_variant (id TEXT PRIMARY KEY, shoe_version_id TEXT NOT NULL REFERENCES shoe_version(id) ON DELETE CASCADE, market_code TEXT NOT NULL, gender TEXT NOT NULL CHECK (gender IN ('men','women','unisex')), msrp_cents INTEGER NOT NULL CHECK (msrp_cents > 0), currency_code TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)), source_url TEXT, last_verified_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (shoe_version_id, market_code, gender));",
    "CREATE INDEX IF NOT EXISTS idx_shoe_market_variant_market ON shoe_market_variant (market_code, available);",
    "BEGIN;",
    "INSERT OR REPLACE INTO source (id, type, url, retrieved_at, license_or_permission, notes) VALUES ('src-india-curated-catalog', 'manual', 'catalog://data/shoes.json', datetime('now'), 'Internal curated catalog', 'India MSRP catalog imported from data/shoes.json. Confirm product availability and price against an official India listing before publishing.');",
  ];

  for (const shoe of versions) {
    const familyId = `fam-${idPart(shoe.brand)}-${idPart(shoe.model)}-${idPart(shoe.category)}`;
    const versionId = `ver-${idPart(shoe.brand)}-${idPart(shoe.model)}-${idPart(shoe.category)}-india-current`;
    const representative = shoe.men ?? shoe.women ?? shoe;
    const price = Number(representative.msrp_inr);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid INR price for ${shoe.brand} ${shoe.model}`);

    const scores = representative.scores ?? {};
    const trail = shoe.category === "trail";
    const sourceId = representative.source_url ? `src-${idPart(shoe.brand)}-${idPart(shoe.model)}-india` : "src-india-curated-catalog";
    if (representative.source_url) {
      statements.push(
        `INSERT OR IGNORE INTO source (id, type, url, retrieved_at, license_or_permission, notes) VALUES (${quote(sourceId)}, 'manufacturer', ${quote(representative.source_url)}, datetime('now'), 'Public product listing', 'Official India product page recorded with this catalog import.');`
      );
    }
    statements.push(
      `INSERT OR REPLACE INTO shoe_family (id, brand, model, category) VALUES (${quote(familyId)}, ${quote(shoe.brand)}, ${quote(shoe.model)}, ${quote(shoe.category)});`,
      `INSERT OR REPLACE INTO shoe_version (id, family_id, version_label, msrp_cents, currency_code, discontinued) VALUES (${quote(versionId)}, ${quote(familyId)}, 'India current', ${quote(Math.round(price * 100))}, 'INR', 0);`,
      `INSERT OR REPLACE INTO shoe_specs (shoe_version_id, weight_g_men, weight_g_women, stack_mm_heel, stack_mm_forefoot, drop_mm, lug_depth_mm, rock_plate, waterproof, gaiter_compatible) VALUES (${quote(versionId)}, ${quote(shoe.men?.weight_g)}, ${quote(shoe.women?.weight_g)}, ${quote(representative.stack_mm_heel)}, ${quote(representative.stack_mm_forefoot)}, ${quote(representative.drop_mm)}, ${quote(trail ? representative.lug_depth_mm : null)}, ${quote(trail ? Number(Boolean(representative.rock_plate)) : null)}, ${quote(trail ? Number(Boolean(representative.waterproof)) : null)}, ${quote(trail ? Number(Boolean(representative.gaiter_compatible)) : null)});`,
      `INSERT OR REPLACE INTO shoe_attributes (shoe_version_id, stability, cushion, width_options_json, best_use_json, distance_focus_json, notes_json) VALUES (${quote(versionId)}, ${quote(representative.stability ?? "neutral")}, ${quote(representative.cushion ?? "balanced")}, ${quote(json(representative.width_options, ["regular"]))}, ${quote(json(representative.best_use, []))}, ${quote(json(representative.distance_focus, []))}, ${quote(json(representative.notes, []))});`,
      `INSERT OR REPLACE INTO shoe_scores (shoe_version_id, cushioning_score, responsiveness_score, stability_score, durability_score, value_score, grip_score, protection_score, method, confidence) VALUES (${quote(versionId)}, ${quote(scores.cushioning)}, ${quote(scores.responsiveness)}, ${quote(scores.stability)}, ${quote(scores.durability)}, ${quote(scores.value)}, ${quote(scores.grip)}, ${quote(scores.protection)}, 'manual', 0.55);`,
      `INSERT OR REPLACE INTO shoe_version_source (shoe_version_id, source_id) VALUES (${quote(versionId)}, ${quote(sourceId)});`
    );

    for (const variant of [shoe.men, shoe.women].filter(Boolean)) {
      const variantSourceId = variant.source_url ? `src-${idPart(shoe.brand)}-${idPart(shoe.model)}-india` : "src-india-curated-catalog";
      statements.push(
        `INSERT OR REPLACE INTO shoe_market_variant (id, shoe_version_id, market_code, gender, msrp_cents, currency_code, available, source_url, last_verified_at) VALUES (${quote(`mkt-${idPart(variant.id)}`)}, ${quote(versionId)}, 'IN', ${quote(variant.gender)}, ${quote(Math.round(Number(variant.msrp_inr) * 100))}, 'INR', 1, ${quote(variant.source_url)}, datetime('now'));`,
        `INSERT OR REPLACE INTO shoe_version_source (shoe_version_id, source_id) VALUES (${quote(versionId)}, ${quote(variantSourceId)});`
      );
    }
  }

  statements.push("COMMIT;");
  execFileSync("sqlite3", [databasePath], { input: statements.join("\n"), stdio: ["pipe", "inherit", "inherit"] });
  console.log(`Imported ${catalog.shoes.length} fit records as ${versions.length} India shoe versions into ${databasePath}.`);
}

main();
