#!/usr/bin/env python3
"""Review data/shoes.json before importing it into the recommendation catalog."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.catalog_quality import quality_report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print the complete report as JSON.")
    args = parser.parse_args()
    report = quality_report(json.loads((ROOT / "data/shoes.json").read_text()))
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        summary = report["summary"]
        print(f"Catalog quality: {summary['variants']} variants, {summary['models']} models, {summary['brands']} brands")
        print(f"Publish-ready: {summary['ready_to_publish']} | Source coverage: {summary['source_coverage_percent']}% | Errors: {summary['errors']} | Warnings: {summary['warnings']}")
        for issue in report["issues"]:
            print(f"{issue['severity'].upper()}: {issue['shoe_id']} · {issue['field']} — {issue['message']}")
    if report["summary"]["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
