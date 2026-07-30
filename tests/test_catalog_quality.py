import unittest

from backend.catalog_quality import quality_report


def valid_shoe(**changes):
    shoe = {
        "id": "test-daily-men-road", "brand": "Test", "model": "Daily", "gender": "men", "category": "road",
        "msrp_inr": 10000, "weight_g": 250, "drop_mm": 8, "stability": "neutral", "cushion": "balanced",
        "width_options": ["regular"], "best_use": ["daily"], "distance_focus": ["10k"],
        "scores": {"cushioning": 7, "responsiveness": 7, "stability": 6, "durability": 7, "value": 7, "grip": 6, "protection": 5},
        "source_url": "https://example.com/test-daily",
    }
    return shoe | changes


class CatalogQualityTests(unittest.TestCase):
    def test_complete_catalog_is_publish_ready(self):
        report = quality_report({"shoes": [valid_shoe()]})
        self.assertEqual(report["summary"]["errors"], 0)
        self.assertEqual(report["summary"]["warnings"], 0)
        self.assertEqual(report["summary"]["ready_to_publish"], 1)

    def test_duplicate_id_blocks_import_and_missing_source_is_review_item(self):
        report = quality_report({"shoes": [valid_shoe(), valid_shoe(source_url=None)]})
        self.assertGreater(report["summary"]["errors"], 0)
        self.assertGreater(report["summary"]["warnings"], 0)


if __name__ == "__main__":
    unittest.main()
