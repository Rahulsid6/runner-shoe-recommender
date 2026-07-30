#!/usr/bin/env python3
"""Discover and enrich PUMA India running products without changing the live catalog."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path
from urllib.error import URLError
from urllib import robotparser
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.puma_collector import PUMA_HOST, discover_product_urls, is_discovery_match, parse_product_page, review_status

SOURCE_PATH = ROOT / "data/sources/puma-india.json"
DISCOVERY_PATH = ROOT / "data/incoming/puma-india-nitro-discovery-2026-07-30.json"
USER_AGENT = "RunwiseCatalogBot/1.0 (+https://github.com/Rahulsid6/runner-shoe-recommender)"


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP {response.status} for {url}")
        return response.read().decode("utf-8", errors="replace")


def robots_allow(url: str) -> bool:
    rules = robotparser.RobotFileParser()
    rules.parse(fetch(f"https://{PUMA_HOST}/robots.txt").splitlines())
    return rules.can_fetch(USER_AGENT, url)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=20, help="Maximum product pages to fetch (default: 20).")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds between product-page requests (default: 1).")
    parser.add_argument("--include-all", action="store_true", help="Keep all discovered products instead of only the existing PUMA discovery queue.")
    parser.add_argument("--output", type=Path, help="Where to write the review batch.")
    args = parser.parse_args()
    if args.limit < 1 or args.delay < 0:
        raise SystemExit("--limit must be positive and --delay cannot be negative.")

    source = json.loads(SOURCE_PATH.read_text())
    discovery = json.loads(DISCOVERY_PATH.read_text())
    collection_url = source["collection_url"]
    try:
        allowed = robots_allow(collection_url)
    except URLError as error:
        raise SystemExit(f"Could not verify PUMA robots.txt securely ({error.reason}); no data was collected.")
    if not allowed:
        raise SystemExit("PUMA robots.txt does not allow this collection fetch; no data was collected.")
    try:
        urls = discover_product_urls(fetch(collection_url), collection_url)
    except URLError as error:
        raise SystemExit(f"Could not securely fetch the PUMA collection ({error.reason}); no data was collected.")
    if not urls:
        raise SystemExit("No product URLs were discovered. The collection page markup may have changed.")
    today = date.today().isoformat()
    records = []
    for url in urls:
        if len(records) >= args.limit:
            break
        try:
            allowed = robots_allow(url)
        except URLError as error:
            raise SystemExit(f"Could not verify PUMA robots.txt securely ({error.reason}); no data was collected.")
        if not allowed:
            continue
        try:
            record = parse_product_page(fetch(url), url, today)
        except URLError as error:
            raise SystemExit(f"Could not securely fetch {url} ({error.reason}); no data was collected.")
        if args.include_all or is_discovery_match(record, discovery["candidates"]):
            record["review_status"] = review_status(record)
            records.append(record)
        time.sleep(args.delay)
    output = args.output or ROOT / "data/incoming" / f"puma-india-enriched-{today}.json"
    payload = {"source": {"brand": "PUMA", "market": "IN", "collection_url": collection_url, "retrieved_on": today, "mode": "official product-page enrichment"}, "records": records}
    output.write_text(json.dumps(payload, indent=2) + "\n")
    ready = sum(record["review_status"] == "ready_for_catalog_review" for record in records)
    print(f"Wrote {len(records)} PUMA review records to {output} ({ready} ready for catalog review).")


if __name__ == "__main__":
    main()
