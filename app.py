"""FastAPI application serving the runner shoe recommender."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.catalog_quality import quality_report
from backend.recommender import recommend

ROOT = Path(__file__).parent
DATABASE_PATH = Path(os.environ.get("SHOE_DB_PATH", ROOT / "db/sqlite/shoe_kb.sqlite"))
CATALOG_PATH = ROOT / "data/shoes.json"
app = FastAPI(title="Runner Shoe Recommender API", version="1.0.0")
logger = logging.getLogger(__name__)

COUNTRIES = {"IN": ("INR", "₹", 83), "US": ("USD", "$", 1), "GB": ("GBP", "£", .78), "EU": ("EUR", "€", .92), "CA": ("CAD", "C$", 1.35), "AU": ("AUD", "A$", 1.5), "SG": ("SGD", "S$", 1.35)}


class RunnerPreferences(BaseModel):
    country: Literal["IN", "US", "GB", "EU", "CA", "AU", "SG"] = "IN"
    currencyCode: str = "INR"
    surface: Literal["road", "trail", "track"]
    budget: float = Field(gt=0)
    distance: Literal["5k", "10k", "hm", "fm", "ultra"]
    use: Literal["easy", "daily", "tempo", "race", "mixed"]
    gender: Literal["men", "women", "all"] = "all"
    stability: Literal["neutral", "mild", "stability"] = "neutral"
    width: Literal["regular", "wide", "narrow"] = "regular"
    cushion: Literal["firm", "balanced", "soft"] = "balanced"
    weightKg: float = Field(ge=35, le=130)
    terrain: Literal["mixed", "rocky", "muddy", "buffed"] = "mixed"
    trailPriority: Literal["grip", "protection", "weight"] = "grip"


class RecommendationRequest(BaseModel):
    prefs: RunnerPreferences


def read_json(value: str | None, fallback: Any) -> Any:
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def fetch_catalog(market: str = "IN") -> list[dict[str, Any]]:
    if not DATABASE_PATH.exists():
        raise RuntimeError("Catalog database is missing. Run python3 scripts/import_india_catalog.py first.")
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute("""
            SELECT mv.id variant_id, mv.gender, mv.msrp_cents, mv.source_url, f.brand, f.model, f.category,
                   sp.weight_g_men, sp.weight_g_women, sp.stack_mm_heel, sp.stack_mm_forefoot, sp.drop_mm, sp.lug_depth_mm, sp.rock_plate, sp.waterproof, sp.gaiter_compatible,
                   a.stability, a.cushion, a.width_options_json, a.best_use_json, a.distance_focus_json, a.notes_json,
                   sc.cushioning_score, sc.responsiveness_score, sc.stability_score, sc.durability_score, sc.value_score, sc.grip_score, sc.protection_score
            FROM shoe_market_variant mv JOIN shoe_version v ON v.id=mv.shoe_version_id JOIN shoe_family f ON f.id=v.family_id
            LEFT JOIN shoe_specs sp ON sp.shoe_version_id=v.id LEFT JOIN shoe_attributes a ON a.shoe_version_id=v.id LEFT JOIN shoe_scores sc ON sc.shoe_version_id=v.id
            WHERE mv.market_code=? AND mv.available=1 AND v.discontinued=0 ORDER BY f.brand, f.model, mv.gender
        """, (market,)).fetchall()
    finally:
        connection.close()
    return [{"id": row["variant_id"], "brand": row["brand"], "model": row["model"], "gender": row["gender"], "category": row["category"], "msrp_inr": round(row["msrp_cents"] / 100), "weight_g": row["weight_g_women"] if row["gender"] == "women" else row["weight_g_men"], "drop_mm": row["drop_mm"], "stack_mm_heel": row["stack_mm_heel"], "stack_mm_forefoot": row["stack_mm_forefoot"], "stability": row["stability"] or "neutral", "cushion": row["cushion"] or "balanced", "width_options": read_json(row["width_options_json"], ["regular"]), "best_use": read_json(row["best_use_json"], []), "distance_focus": read_json(row["distance_focus_json"], []), "lug_depth_mm": row["lug_depth_mm"], "rock_plate": bool(row["rock_plate"]), "waterproof": bool(row["waterproof"]), "gaiter_compatible": bool(row["gaiter_compatible"]), "scores": {"cushioning": row["cushioning_score"], "responsiveness": row["responsiveness_score"], "stability": row["stability_score"], "durability": row["durability_score"], "value": row["value_score"], "grip": row["grip_score"], "protection": row["protection_score"]}, "source_url": row["source_url"], "notes": read_json(row["notes_json"], [])} for row in rows]


def ranking_catalog(prefs: dict[str, Any]) -> list[dict[str, Any]]:
    country = prefs.get("country") if prefs.get("country") in COUNTRIES else "IN"
    currency, _symbol, rate = COUNTRIES[country]
    return [{**shoe, "msrp": shoe["msrp_inr"] if country == "IN" else round(shoe["msrp_inr"] / COUNTRIES["IN"][2] * rate), "priceCurrency": currency, "priceSource": "local" if country == "IN" else "estimated", "weightG": shoe["weight_g"], "dropMm": shoe["drop_mm"], "cushionFeel": shoe["cushion"], "widthOptions": shoe["width_options"], "bestUse": shoe["best_use"], "distance": shoe["distance_focus"], "ride": {key: shoe["scores"].get(key) or 5 for key in ["cushioning", "responsiveness", "stability", "durability", "value"]}, "trail": {"lugMm": shoe["lug_depth_mm"], "grip": shoe["scores"].get("grip"), "protection": shoe["scores"].get("protection"), "rockPlate": shoe["rock_plate"], "waterproof": shoe["waterproof"], "gaiterCompatible": shoe["gaiter_compatible"], "terrain": ["mixed"]} if shoe["category"] == "trail" else None} for shoe in fetch_catalog()]


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": DATABASE_PATH.exists()}


@app.get("/api/shoes")
@app.get("/api/catalog")
def shoes(market: str = "IN") -> dict[str, Any]:
    if market.upper() != "IN":
        raise HTTPException(400, "Only the IN market is currently available.")
    return {"schema_version": "1.0", "market": "IN", "currency": "INR", "shoes": fetch_catalog()}


@app.get("/api/catalog/quality")
def catalog_quality() -> dict[str, Any]:
    """Expose the raw-catalog review queue for the admin/data workflow."""
    try:
        return quality_report(json.loads(CATALOG_PATH.read_text()))
    except (OSError, json.JSONDecodeError):
        logger.exception("Catalog quality check failed")
        raise HTTPException(500, "Catalog quality service unavailable.")


@app.post("/api/recommend")
def recommendations(request: RecommendationRequest) -> dict[str, Any]:
    try:
        prefs = request.prefs.model_dump()
        return {"ranking_version": "2026.1", "recommendations": recommend(prefs, ranking_catalog(prefs))}
    except Exception:
        logger.exception("Recommendation failed")
        raise HTTPException(500, "Catalog service unavailable.")


@app.get("/")
def homepage() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/styles.css")
def stylesheet() -> FileResponse:
    return FileResponse(ROOT / "styles.css", media_type="text/css")


@app.get("/src/{asset_path:path}")
def source_asset(asset_path: str) -> FileResponse:
    asset = (ROOT / "src" / asset_path).resolve()
    if ROOT / "src" not in asset.parents or not asset.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(asset)


@app.get("/data/{asset_path:path}")
def data_asset(asset_path: str) -> FileResponse:
    asset = (ROOT / "data" / asset_path).resolve()
    if ROOT / "data" not in asset.parents or not asset.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(asset)
