# Shoe Knowledge Base (Postgres)

This folder contains a production-style Postgres schema + seed data for the shoe knowledge base.

## What’s included
- `../docker-compose.yml` starts Postgres on port `54329`
- `migrations/001_init.sql` creates tables/enums/extensions
- `seed/001_sample_data.sql` inserts a couple of sample shoes (to validate the schema)

> Note on VS Code “dbtools” errors:
> The VS Code SQL tooling sometimes flags `BEGIN; ... COMMIT;` in standalone `.sql` files depending on the dialect/config.
> Postgres accepts these files fine when executed with `psql`.

## Start the database

From repo root:

```bash
cd runner-shoe-recommender
docker compose up -d
```

Connection details:
- Host: `localhost`
- Port: `54329`
- DB: `shoe_kb`
- User: `shoe`
- Password: `shoe_password`

## Apply migration + seed

```bash
# Apply schema
docker exec -i runner_shoe_db psql -U shoe -d shoe_kb < db/migrations/001_init.sql

# Seed sample data
docker exec -i runner_shoe_db psql -U shoe -d shoe_kb < db/seed/001_sample_data.sql
```

## Quick sanity query

```bash
docker exec -it runner_shoe_db psql -U shoe -d shoe_kb -c "
select f.brand, f.model, v.version_label, v.msrp_cents
from shoe_version v
join shoe_family f on f.id = v.family_id
order by f.brand, f.model, v.version_label;
"
```

## Next steps
- Add ingestion scripts (manufacturer pages + permissioned feeds) that upsert into these tables.
- Expand seed data or generate `COPY` imports once you have a larger curated dataset.