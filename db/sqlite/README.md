# Shoe Knowledge Base (SQLite)

This is a **production-ish MVP** version of the shoe knowledge base implemented in SQLite so you can run it **without Docker** and without installing Postgres.

## Files
- `schema.sql` — creates tables for shoe families, versions, specs, attributes, scores, and provenance sources
- `seed.sql` — inserts a couple of sample shoes
- `shoe_kb.sqlite` — generated database file (created by the commands below)

## Create the database

From repo root:

```bash
cd runner-shoe-recommender

rm -f db/sqlite/shoe_kb.sqlite
sqlite3 db/sqlite/shoe_kb.sqlite < db/sqlite/schema.sql
node scripts/import-india-catalog.js
```

## Sanity query

```bash
sqlite3 db/sqlite/shoe_kb.sqlite \
  'SELECT f.brand, f.model, v.version_label, v.msrp_cents, f.category
   FROM shoe_version v
   JOIN shoe_family f ON f.id=v.family_id
   ORDER BY f.brand;'
```

The importer reads `data/shoes.json`, joins men's and women's variants into a
single KB shoe version, and stores INR prices in `shoe_version`.

To refresh the database after updating the catalog:

```bash
node scripts/import-india-catalog.js
```

## Run the catalog API locally

```bash
npm start
```

Open `http://localhost:8080`. The app will use `/api/shoes`, which reads the
SQLite database. It falls back to `data/shoes.json` when hosted as static files.

The legacy `seed.sql` remains available as a minimal schema smoke test.

## Notes
- Some fields are stored as JSON strings (e.g., width options, best-use tags, events). This keeps the schema flexible.
- The Postgres-first design still exists in `../migrations/001_init.sql` for when your environment/network supports Postgres.

## India catalog coverage

The initial catalog contains verified-in-app starter records. It is deliberately
not presented as complete market coverage. Every new item should include an
official India product URL or an approved retailer-feed URL before it is marked
ready for publication. The importer keeps a provenance row for this curated
catalog; source URLs can be added per shoe through `shoe_version_source` and
`shoe_field_source` as the catalogue grows.
