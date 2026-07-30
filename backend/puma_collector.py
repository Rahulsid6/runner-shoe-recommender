"""Polite, official-source-only product enrichment for PUMA India."""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit


PUMA_HOST = "in.puma.com"
PRODUCT_PATH = "/in/en/pd/"


class JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_json_ld = False
        self._chunks: list[str] = []
        self.items: list[Any] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self._chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "script" or not self._in_json_ld:
            return
        self._in_json_ld = False
        try:
            self.items.append(json.loads("".join(self._chunks)))
        except json.JSONDecodeError:
            pass


def canonical_url(url: str, base_url: str | None = None) -> str | None:
    absolute = urljoin(base_url or f"https://{PUMA_HOST}", html.unescape(url))
    parts = urlsplit(absolute)
    if parts.scheme != "https" or parts.netloc.lower() != PUMA_HOST or PRODUCT_PATH not in parts.path:
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))


def discover_product_urls(collection_html: str, collection_url: str) -> list[str]:
    urls = {
        canonical_url(match, collection_url)
        for match in re.findall(r'''(?:href|url)=["']([^"']*/in/en/pd/[^"'#?]+(?:\?[^"']*)?)["']''', collection_html, flags=re.I)
    }
    return sorted(url for url in urls if url)


def _walk(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        found = [value]
        for child in value.values():
            found.extend(_walk(child))
        return found
    if isinstance(value, list):
        return [item for child in value for item in _walk(child)]
    return []


def _first_product(json_ld: list[Any]) -> dict[str, Any] | None:
    for item in _walk(json_ld):
        item_type = item.get("@type")
        types = item_type if isinstance(item_type, list) else [item_type]
        if "Product" in types:
            return item
    return None


def _text(html_content: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(html_content))).strip()


def _prices(text: str) -> tuple[int | None, int | None]:
    prices = [int(value.replace(",", "")) for value in re.findall(r"₹\s*([0-9][0-9,]*)", text)]
    unique = list(dict.fromkeys(prices))
    if not unique:
        return None, None
    return unique[0], unique[1] if len(unique) > 1 else unique[0]


def _spec_number(text: str, label: str, unit: str) -> float | None:
    match = re.search(rf"{label}[^0-9]{{0,35}}(\d{{1,3}}(?:\.\d+)?)\s*{unit}\b", text, flags=re.I)
    return float(match.group(1)) if match else None


def _model_name(name: str) -> str:
    return re.sub(r"\b(Men's|Women's|Men|Women|Road Running|Running|Shoes|Shoe)\b", "", name, flags=re.I).strip(" -–")


def _gender(name: str) -> str:
    if re.search(r"women'?s|\bwomen\b", name, flags=re.I):
        return "women"
    if re.search(r"men'?s|\bmen\b", name, flags=re.I):
        return "men"
    return "unisex"


def parse_product_page(product_html: str, source_url: str, retrieved_on: str) -> dict[str, Any]:
    parser = JsonLdParser()
    parser.feed(product_html)
    product = _first_product(parser.items) or {}
    body = _text(product_html)
    name = str(product.get("name") or "").strip()
    if not name:
        title = re.search(r"<title[^>]*>(.*?)</title>", product_html, flags=re.I | re.S)
        name = _text(title.group(1)) if title else "Unknown PUMA product"
    offers = product.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    listed_price, listed_mrp = _prices(body)
    offer_price = offers.get("price") if isinstance(offers, dict) else None
    try:
        offer_price = int(float(offer_price)) if offer_price is not None else None
    except (TypeError, ValueError):
        offer_price = None
    sale_price = offer_price or listed_price
    if listed_mrp is None:
        listed_mrp = sale_price
    stack = re.search(r"(?:stack|heel).{0,45}?(\d{1,2}(?:\.\d+)?)\s*mm\s*(?:/|and)\s*(\d{1,2}(?:\.\d+)?)\s*mm", body, flags=re.I)
    return {
        "brand": "PUMA",
        "name": name,
        "model": _model_name(name),
        "gender": _gender(name),
        "category": "trail" if "trail" in name.lower() else "road",
        "sale_price_inr": sale_price,
        "mrp_inr": listed_mrp,
        "weight_g": _spec_number(body, r"(?:shoe )?weight", "g"),
        "drop_mm": _spec_number(body, r"(?:heel.toe )?drop", "mm"),
        "stack_mm_heel": float(stack.group(1)) if stack else None,
        "stack_mm_forefoot": float(stack.group(2)) if stack else None,
        "description": str(product.get("description") or "").strip() or None,
        "source_url": canonical_url(str(product.get("url") or source_url), source_url) or source_url,
        "product_sku": product.get("sku") or None,
        "availability": offers.get("availability") if isinstance(offers, dict) else None,
        "retrieved_on": retrieved_on,
        "source_confidence": "structured_product_page" if product else "product_page_fallback",
    }


def candidate_key(model: str, gender: str) -> tuple[str, str]:
    normalized = re.sub(r"[^a-z0-9]", "", model.lower())
    return normalized.replace("pumaxhyrox", "hyrox"), gender


def is_discovery_match(record: dict[str, Any], candidates: list[dict[str, Any]]) -> bool:
    record_key = candidate_key(record["model"], record["gender"])
    for candidate in candidates:
        candidate_model, candidate_gender = candidate_key(candidate["model"], candidate["gender"])
        if record_key[1] == candidate_gender and (record_key[0] in candidate_model or candidate_model in record_key[0]):
            return True
    return False


def review_status(record: dict[str, Any]) -> str:
    required = ("source_url", "sale_price_inr", "mrp_inr", "weight_g", "drop_mm")
    return "ready_for_catalog_review" if all(record.get(field) is not None for field in required) else "needs_product_specs"
