"""Transparent scoring model shared by the FastAPI recommendation endpoint."""

from __future__ import annotations


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def includes(values: list[str] | None, value: str) -> bool:
    return value in (values or [])


def distance_score(shoe: dict, prefs: dict) -> float:
    if includes(shoe.get("distance"), prefs["distance"]):
        return 1.0
    order = ["5k", "10k", "hm", "fm", "ultra"]
    try:
        difference = abs(order.index(prefs["distance"]) - order.index((shoe.get("distance") or ["10k"])[0]))
    except ValueError:
        return 0.5
    return clamp(1 - min(4, difference) * 0.25)


def stability_match(shoe: dict, prefs: dict) -> float:
    levels = {"neutral": 0, "mild": 1, "stability": 2}
    requested = levels.get(prefs.get("stability"), 0)
    actual = levels.get(shoe.get("stability"), 0)
    if actual == requested:
        return 1.0
    return clamp(1 - (requested - actual) * 0.55) if requested > actual else clamp(1 - (actual - requested) * 0.25)


def cushion_match(shoe: dict, prefs: dict) -> float:
    levels = {"firm": 0, "balanced": 1, "soft": 2}
    difference = abs(levels.get(prefs.get("cushion"), 1) - levels.get(shoe.get("cushionFeel"), 1))
    return 1.0 if difference == 0 else 0.65 if difference == 1 else 0.3


def use_match(shoe: dict, prefs: dict) -> float:
    if prefs.get("use") == "mixed":
        roles = set(shoe.get("bestUse") or [])
        return clamp(0.3 + sum(role in roles for role in ["easy", "daily", "tempo", "race"]) * 0.2)
    return 1.0 if includes(shoe.get("bestUse"), prefs.get("use")) else 0.45


def budget_match(shoe: dict, prefs: dict) -> float:
    if shoe["msrp"] <= prefs["budget"]:
        return 1.0
    return clamp(1 - (shoe["msrp"] - prefs["budget"]) / max(1, prefs["budget"]) * 1.25)


def trail_score(shoe: dict, prefs: dict) -> float:
    if prefs.get("surface") != "trail":
        return 1.0
    trail = shoe.get("trail")
    if not trail:
        return 0.1
    score = 0.6 + (0.2 if prefs.get("terrain") in trail.get("terrain", []) else 0.08)
    priority = prefs.get("trailPriority")
    if priority == "grip":
        score += clamp((trail.get("grip") or 0) / 10) * 0.2
    elif priority == "protection":
        score += clamp((trail.get("protection") or 0) / 10) * 0.2
    else:
        score += 0.2 if (shoe.get("weightG") or 999) <= 285 else 0.08
    return clamp(score)


def hard_filter(shoe: dict, prefs: dict) -> bool:
    if shoe.get("category") != prefs.get("surface") or shoe["msrp"] > prefs["budget"] * 1.35:
        return False
    if prefs.get("gender") not in (None, "all") and shoe.get("gender") and shoe["gender"] != prefs["gender"]:
        return False
    return prefs.get("width") == "regular" or prefs.get("width") in (shoe.get("widthOptions") or [])


def explain(shoe: dict, prefs: dict) -> tuple[list[str], list[str]]:
    reasons, cautions = [], []
    (reasons if shoe["msrp"] <= prefs["budget"] else cautions).append(
        f"Within {prefs.get('currencyCode', 'local')} budget" if shoe["msrp"] <= prefs["budget"] else "Above budget"
    )
    if prefs.get("width") in (shoe.get("widthOptions") or []): reasons.append(f"Comes in {prefs['width']} width")
    if prefs.get("gender") not in (None, "all") and shoe.get("gender") == prefs["gender"]: reasons.append(f"{shoe['gender']}'s fit selected")
    if includes(shoe.get("bestUse"), prefs.get("use")): reasons.append(f"Good for {prefs['use']} running")
    elif prefs.get("use") != "mixed": cautions.append(f"Not primarily a {prefs['use']} shoe")
    if shoe.get("stability") == prefs.get("stability"): reasons.append(f"{prefs['stability']} stability match")
    if shoe.get("cushionFeel") == prefs.get("cushion"): reasons.append(f"{prefs['cushion']} cushioning feel")
    if includes(shoe.get("distance"), prefs.get("distance")): reasons.append(f"Suitable for {prefs['distance'].upper()}")
    return reasons, cautions


def recommend(prefs: dict, catalog: list[dict]) -> list[dict]:
    weights = {"distance": .18, "use": .22, "stability": .18, "cushion": .12, "width": .08, "budget": .07, "ride": .1, "trail": .12}
    rankings = []
    for shoe in filter(lambda item: hard_filter(item, prefs), catalog):
        ride = shoe["ride"]
        ride_score = clamp(ride["cushioning"] / 10) * .35 + clamp(ride["responsiveness"] / 10) * .35 + clamp(ride["durability"] / 10) * .2 + clamp(ride["value"] / 10) * .1
        score = distance_score(shoe, prefs) * weights["distance"] + use_match(shoe, prefs) * weights["use"] + stability_match(shoe, prefs) * weights["stability"] + cushion_match(shoe, prefs) * weights["cushion"] + (1 if prefs.get("width") in (shoe.get("widthOptions") or []) else .2) * weights["width"] + budget_match(shoe, prefs) * weights["budget"] + ride_score * weights["ride"] + (trail_score(shoe, prefs) * weights["trail"] if prefs.get("surface") == "trail" else 0)
        reasons, cautions = explain(shoe, prefs)
        rankings.append({"shoe": shoe, "score": clamp(score), "reasons": reasons, "cautions": cautions})
    return sorted(rankings, key=lambda item: item["score"], reverse=True)
