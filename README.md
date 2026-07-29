# Runner Shoe Recommender (Offline MVP)

A simple **offline** shoe recommendation engine for runners (**road / trail / track**) with:
- In-memory shoe catalog (`src/shoes.js`)
- Transparent filter + scoring recommender (`src/recommender.js`)
- UI wizard + top-5 recommendations with reasons/cautions (`src/app.js`)

This project was intentionally built with **zero external dependencies** so it works even if npm registry access is blocked.

## Run

Option 1 (easiest): open the file directly
- Open `index.html` in your browser.

Option 2: serve locally (recommended)
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