"""Validation and release-readiness reporting for the curated shoe catalog."""

from __future__ import annotations

from collections import Counter
from typing import Any
from urllib.parse import urlparse


VALID_CATEGORIES = {"road", "trail", "track"}
VALID_GENDERS = {"men", "women", "unisex"}
VALID_STABILITY = {"neutral", "mild", "stability"}
VALID_CUSHION = {"firm", "balanced", "soft"}
SCORE_FIELDS = {"cushioning", "responsiveness", "stability", "durability", "value", "grip", "protection"}


def _issue(severity: str, shoe_id: str, field: str, message: str) -> dict[str, str]:
    return {"severity": severity, "shoe_id": shoe_id, "field": field, "message": message}


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def quality_report(catalog: dict[str, Any]) -> dict[str, Any]:
    """Return deterministic catalog errors, warnings, and release-ready counts.

    Errors block import. Warnings keep an item importable but put it in the
    review queue, so incomplete specs never silently look fully verified.
    """
    issues: list[dict[str, str]] = []
    shoes = catalog.get("shoes", [])
    if not isinstance(shoes, list):
        return {"summary": {"variants": 0, "models": 0, "brands": 0, "source_coverage_percent": 0, "ready_to_publish": 0, "warnings": 0, "errors": 1}, "issues": [_issue("error", "catalog", "shoes", "Catalog must contain a shoes array.")]}

    ids = Counter(str(shoe.get("id", "")) for shoe in shoes if isinstance(shoe, dict))
    variants: list[dict[str, Any]] = [shoe for shoe in shoes if isinstance(shoe, dict)]
    source_count = 0
    ready_count = 0
    for index, shoe in enumerate(shoes):
        if not isinstance(shoe, dict):
            issues.append(_issue("error", f"row-{index + 1}", "record", "Each shoe must be an object."))
            continue
        shoe_id = str(shoe.get("id") or f"row-{index + 1}")
        if not shoe.get("id"):
            issues.append(_issue("error", shoe_id, "id", "A stable catalog id is required."))
        elif ids[shoe_id] > 1:
            issues.append(_issue("error", shoe_id, "id", "Catalog id is duplicated."))
        for field in ("brand", "model"):
            if not isinstance(shoe.get(field), str) or not shoe[field].strip():
                issues.append(_issue("error", shoe_id, field, f"{field.title()} is required."))
        if shoe.get("category") not in VALID_CATEGORIES:
            issues.append(_issue("error", shoe_id, "category", "Category must be road, trail, or track."))
        if shoe.get("gender") not in VALID_GENDERS:
            issues.append(_issue("error", shoe_id, "gender", "Gender must be men, women, or unisex."))
        if not _is_number(shoe.get("msrp_inr")) or shoe.get("msrp_inr", 0) <= 0:
            issues.append(_issue("error", shoe_id, "msrp_inr", "A positive INR MSRP is required."))
        if shoe.get("stability") not in VALID_STABILITY:
            issues.append(_issue("error", shoe_id, "stability", "Stability must be neutral, mild, or stability."))
        if shoe.get("cushion") not in VALID_CUSHION:
            issues.append(_issue("error", shoe_id, "cushion", "Cushion must be firm, balanced, or soft."))
        for field in ("width_options", "best_use", "distance_focus"):
            if not isinstance(shoe.get(field), list) or not shoe[field]:
                issues.append(_issue("error", shoe_id, field, "A non-empty list is required."))
        scores = shoe.get("scores")
        if not isinstance(scores, dict):
            issues.append(_issue("error", shoe_id, "scores", "Scores are required."))
        else:
            for score in SCORE_FIELDS:
                value = scores.get(score)
                if not _is_number(value) or not 0 <= value <= 10:
                    issues.append(_issue("error", shoe_id, f"scores.{score}", "Score must be a number from 0 to 10."))

        source_url = shoe.get("source_url")
        has_source = isinstance(source_url, str) and urlparse(source_url).scheme == "https" and bool(urlparse(source_url).netloc)
        if has_source:
            source_count += 1
        else:
            issues.append(_issue("warning", shoe_id, "source_url", "Add an HTTPS official product or approved retailer URL."))
        for field in ("weight_g", "drop_mm"):
            if not _is_number(shoe.get(field)) or shoe[field] <= 0:
                issues.append(_issue("warning", shoe_id, field, "Confirm this product specification from a source."))

        required = ("id", "brand", "model", "category", "gender", "msrp_inr", "stability", "cushion", "width_options", "best_use", "distance_focus", "scores")
        item_issues = [item for item in issues if item["shoe_id"] == shoe_id]
        if has_source and all(shoe.get(field) for field in required) and not item_issues:
            ready_count += 1

    errors = sum(issue["severity"] == "error" for issue in issues)
    warnings = sum(issue["severity"] == "warning" for issue in issues)
    return {
        "summary": {
            "variants": len(variants),
            "models": len({(shoe.get("brand"), shoe.get("model"), shoe.get("category")) for shoe in variants}),
            "brands": len({shoe.get("brand") for shoe in variants if shoe.get("brand")}),
            "source_coverage_percent": round((source_count / len(variants) * 100) if variants else 0, 1),
            "ready_to_publish": ready_count,
            "warnings": warnings,
            "errors": errors,
        },
        "issues": issues,
    }
