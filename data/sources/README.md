# Source registry

Keep one JSON file per brand and market (for example, `puma-india.json`). Each
record documents an approved discovery source; it is not a substitute for the
product-level `source_url` in `data/shoes.json`.

Before importing a batch, run `python3 scripts/catalog_quality.py`. Errors stop
the import. Warnings identify records that need review, such as missing source
links or product specs. Add only official brand pages or retailer feeds you are
authorised to use, retain the URL, and record the date the listing was checked.
