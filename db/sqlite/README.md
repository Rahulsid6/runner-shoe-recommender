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
sqlite3 db/sqlite/shoe_kb.sqlite < db/sqlite/seed.sql
```

## Sanity query

```bash
sqlite3 db/sqlite/shoe_kb.sqlite \
  'SELECT f.brand, f.model, v.version_label, v.msrp_cents, f.category
   FROM shoe_version v
   JOIN shoe_family f ON f.id=v.family_id
   ORDER BY f.brand;'
```

Expected output (from the current seed):
- ASICS Gel-Nimbus 26
- HOKA Speedgoat 5

## Notes
- Some fields are stored as JSON strings (e.g., width options, best-use tags, events). This keeps the schema flexible.
- The Postgres-first design still exists in `../migrations/001_init.sql` for when your environment/network supports Postgres.

## Next step: ingestion
Once you pick permissioned manufacturer sources, we can add scripts that upsert into this SQLite DB first, then port the same pipeline to Postgres later.