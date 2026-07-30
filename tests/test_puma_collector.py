import unittest

from backend.puma_collector import discover_product_urls, parse_product_page, review_status


COLLECTION = '''<a href="/in/en/pd/deviate-nitro-4-mens-road-running-shoes/312123?swatch=01">Product</a>'''
PRODUCT = '''
<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Deviate NITRO 4 Men's Road Running Shoes","sku":"312123","url":"https://in.puma.com/in/en/pd/deviate-nitro-4-mens-road-running-shoes/312123","description":"Fast road running shoe","offers":{"@type":"Offer","price":"16999","priceCurrency":"INR","availability":"https://schema.org/InStock"}}</script></head>
<body>Weight: 250 g. Heel-to-toe drop: 8 mm. Stack height 38 mm / 30 mm. ₹16,999</body></html>
'''


class PumaCollectorTests(unittest.TestCase):
    def test_discovers_canonical_product_url(self):
        urls = discover_product_urls(COLLECTION, "https://in.puma.com/in/en/sports/sports-running/nitro-collection")
        self.assertEqual(urls, ["https://in.puma.com/in/en/pd/deviate-nitro-4-mens-road-running-shoes/312123"])

    def test_extracts_structured_product_and_specs(self):
        record = parse_product_page(PRODUCT, "https://in.puma.com/in/en/pd/deviate-nitro-4-mens-road-running-shoes/312123", "2026-07-30")
        self.assertEqual(record["gender"], "men")
        self.assertEqual(record["sale_price_inr"], 16999)
        self.assertEqual(record["drop_mm"], 8.0)
        self.assertEqual(record["stack_mm_heel"], 38.0)
        self.assertEqual(review_status(record), "ready_for_catalog_review")


if __name__ == "__main__":
    unittest.main()
