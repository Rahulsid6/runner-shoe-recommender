# Runner Shoe Recommender (Offline MVP)

A simple **offline** shoe recommendation engine for runners (**road / trail / track**) with:
- In-memory shoe catalog (`src/shoes.js`)
- Transparent filter + scoring recommender (`src/recommender.js`)
- UI wizard + top-5 recommendations with reasons/cautions (`src/app.js`)

The browser UI is dependency-free. The local API uses **FastAPI** and SQLite.

## Run

Option 1 (recommended): run the FastAPI catalog service

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Then open http://localhost:8080. The app reads the SQLite-backed `/api/shoes`
endpoint, so catalog updates are available without rebuilding frontend code.

If port 8080 is already in use, either open `http://localhost:8080` (an existing
server may already be running) or start this copy on another port:

```bash
uvicorn app:app --reload --port 8081
```

Option 2: open the file directly
- Open `index.html` in your browser. It falls back to the bundled JSON catalog.

Option 3: serve static files
From the project folder:

```bash
python3 -m http.server 8080
```

Then open:
- http://localhost:8080

## Project structure

- `index.html` — UI
- `styles.css` — styling
- `src/shoes.js` — sample catalog (edit here to add more shoes)
- `src/recommender.js` — filter + scoring + explanations
- `src/app.js` — wiring UI to recommender
- `app.py` — FastAPI server + SQLite catalog API
- `backend/recommender.py` — backend recommendation scoring
- `scripts/import_india_catalog.py` — imports `data/shoes.json` into SQLite

## How recommendations work (MVP)

1. **Hard filters**
   - category matches surface (road/trail/track)
   - budget hard cap (reject shoes way above budget)
   - width availability (wide/narrow filters)

2. **Scoring**
   A weighted sum of:
   - distance match
   - use-case match (easy/daily/tempo/race/mixed)
   - stability match (neutral/mild/stability)
   - cushioning feel match (soft/balanced/firm)
   - width match
   - budget match
   - overall ride attributes (cushioning/responsiveness/durability/value)
   - trail-specific matching (terrain + priority)

## Next steps (when online / production)

- Replace `src/shoes.js` with Postgres catalog + admin ingestion
- Add review ingestion + normalization pipeline (with ToS-safe sourcing)
- Add “free-text” input interpreted into structured preferences (LLM)
- Add RAG explanations with citations/links to original review pages
# Catalog intake from Excel

Use the prefilled workbook at `outputs/catalog-intake-template/runwise-india-shoe-catalog-intake.xlsx` to add or review shoe variants. Run a safe preview first:

```bash
python3 scripts/import_catalog_xlsx.py
```

After fixing validation errors, update the live JSON catalog deliberately:

```bash
python3 scripts/import_catalog_xlsx.py --write
python3 scripts/import_india_catalog.py
```
