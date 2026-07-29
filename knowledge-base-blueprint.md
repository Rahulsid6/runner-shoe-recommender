# Shoe Knowledge Base Blueprint (Hybrid approach)

This document describes a practical, production-friendly way to build a **shoe knowledge base** (KB) for a shoe recommendation engine, starting with **manufacturer specs + permissioned sources**, while keeping the door open for **future scraping**.

---

## 0) Reality check: “All shoes in the market”
You don’t need *every* shoe to ship value.
A better target is:

- **Phase 1:** 200–500 “relevant” models (current + 1 previous version) across road/trail/track from major brands  
- **Phase 2:** 1,000–3,000 models (add regional and niche brands)  
- **Phase 3:** long-tail coverage + discontinued models, with availability tracking

The KB needs **consistent structured fields** more than maximum coverage.

---

## 1) KB design goals
A good KB must be:

- **Structured**: consistent schema across brands and categories
- **Traceable**: each field should have provenance (“manufacturer”, “review”, “community”, “derived”)
- **Updatable**: handle new versions, price changes, and seasonal updates
- **Explainable**: store “why” features (e.g., fit runs narrow, outsole grip strong) used in explanations

---

## 2) Canonical schema (minimum viable, extendable)

### 2.1 ShoeModel (the core entity)
- `id` (UUID)
- `brand` (e.g., ASICS)
- `model` (e.g., Gel-Nimbus)
- `version` (e.g., 26)
- `category` (road | trail | track)
- `release_date` (optional)
- `msrp` (currency + amount)
- `typical_sale_price_range` (min/max; optional)
- `gender` / `unisex` handling (optional)

### 2.2 Specs (objective fields)
- `weight_g_men`, `weight_g_women` (optional)
- `stack_mm_heel`, `stack_mm_forefoot`, `drop_mm`
- `plate` (none | nylon | carbon | tpu | unknown)
- `midsole_material` (text)
- `upper_material` (text)
- `outsole_material` (text)

Trail-specific:
- `lug_depth_mm`
- `rock_plate` (bool)
- `waterproof` (bool)
- `gaiter_compatible` (bool)

Track-specific:
- `spike_type` (spike | track-flat)
- `events` (array)

### 2.3 Fit & use tags (semi-structured)
- `width_options` (narrow/regular/wide + brand sizing notes)
- `fit_notes` (runs small / narrow toe box / etc.)
- `best_for` (easy, daily, tempo, race, ultra, technical trail, muddy, etc.)
- `stability_type` (neutral | mild | stability)

### 2.4 Derived scores (normalized 0–10)
These are the “engine-ready” features:
- `cushioning_score`
- `responsiveness_score`
- `stability_score`
- `durability_score`
- `grip_score` (trail)
- `protection_score` (trail)
- `value_score`

Each score should store:
- `score_value`
- `method` (heuristic | review-aggregation | ML model)
- `confidence` (0–1)
- `inputs` (links/refs)

### 2.5 Sources & provenance
For every shoe:
- `sources[]`: { `type`, `url`, `retrieved_at`, `license/permission`, `notes` }
- `field_provenance`: per-field pointer to source(s)

This prevents “LLM hallucinated shoe facts” in production.

---

## 3) Data sourcing (hybrid)

### 3.1 Manufacturer specs (baseline, safest)
Pros:
- Accurate for objective specs
Cons:
- Missing “feel”, “fit”, “durability in real life”

Implementation:
- Maintain a **brand source registry** (one file/table) of allowed domains and parsing strategies.
- Prefer official JSON-LD / schema.org / embedded product JSON when available.
- If HTML-only, parse stable sections (weight, drop, stack).

### 3.2 Permissioned sources (preferred add-ons)
Examples:
- Affiliate product feeds (where you have rights)
- Retailer catalog feeds with permission
- APIs from data partners

Pros:
- SKU/availability/pricing, sometimes specs
Cons:
- May have less editorial review signal

### 3.3 Reviews/community (carefully)
For Phase 1, don’t scrape aggressively. Use:
- “Allowed” sources (explicit permission, or your own user-submitted reviews)
- Store **derived attributes**, not copied content; link out for citations.

Later (Phase 3):
- If you choose to scrape, do it with legal review + robots/ToS compliance + caching + rate limiting.

---

## 4) KB pipeline (end-to-end)

### Step A: Discovery (what shoes exist)
- Start with a **curated brand list** + known model families.
- Track releases:
  - brand “running shoes” pages
  - press releases / RSS where available
  - permissioned retailer feed diffs

Output: “shoe candidates queue”.

### Step B: Extraction (turn pages into structured data)
- Fetch page
- Extract:
  - product name/model/version
  - category
  - objective specs
  - images (optional)
  - MSRP
- Save raw HTML/JSON snapshot for reproducibility (internal only)

### Step C: Normalization (make all brands comparable)
- Convert all weights to grams
- Convert stack/drop to mm
- Normalize width options to: narrow/regular/wide
- Normalize stability types to: neutral/mild/stability
- De-duplicate variants (wide colorways etc.)

### Step D: Enrichment (add “feel” fields + scores)
Methods:
- Heuristics from specs (e.g., high stack + low weight => “cushioning likely high”)
- Aggregation from permissioned reviews
- Later: ML model trained on labeled shoes

### Step E: Validation
Rules:
- drop = heel_stack - forefoot_stack (if both present) with tolerance
- suspicious weights (too low/high) flagged
- missing critical fields flagged

### Step F: Publish
- Export into the app as:
  - JSON bundle (for MVP)
  - DB tables + search index (production)

---

## 5) Practical “Phase 1” plan (you can execute quickly)

### Phase 1 target
- 250 road shoes, 150 trail, 50 track (current year + previous)
- Brands: Nike, ASICS, Saucony, Brooks, HOKA, Adidas, New Balance, Puma, On, Mizuno, Salomon, Altra, La Sportiva

### Deliverables
- A single canonical dataset: `shoes.json` (or DB)
- A repeatable pipeline that can update monthly

---

## 6) Tooling & storage recommendations
Even if your UI is Next.js, keep ingestion separate.

- Storage:
  - Start: versioned JSON in git (`data/shoes.json`)
  - Next: Postgres for production
- Pipeline:
  - Python scripts (requests/bs4) or Node + cheerio
  - Scheduler: cron/GitHub Actions (later)
- Observability:
  - logs + a “data QA dashboard” of missing/invalid fields

---

## 7) How this plugs into the recommender
The recommender should consume:
- normalized specs
- normalized tags
- derived scores + confidence

This lets you:
- rank shoes deterministically
- explain decisions
- improve data without rewriting the algorithm

---

## 8) What to do next in THIS repo
1. Add a `data/` folder and move the in-memory catalog to `data/shoes.json`.
2. Add a small ingestion script skeleton (manufacturer specs only).
3. Add validation rules and a “missing fields” report.

When your network environment allows, we can implement the ingestion scripts with `curl` + parsing, but keep the actual list of sources permissioned and configurable.