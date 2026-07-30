import unittest

from backend.recommender import recommend


PREFS = {"surface": "road", "budget": 200, "distance": "hm", "use": "daily", "gender": "men", "stability": "neutral", "width": "regular", "cushion": "balanced", "weightKg": 72, "terrain": "mixed", "trailPriority": "grip", "currencyCode": "USD"}


def shoe(**changes):
    base = {"id": "daily", "brand": "Test", "model": "Daily", "gender": "men", "category": "road", "msrp": 150, "weightG": 260, "stability": "neutral", "cushionFeel": "balanced", "widthOptions": ["regular"], "bestUse": ["daily"], "distance": ["hm"], "ride": {"cushioning": 7, "responsiveness": 7, "stability": 6, "durability": 8, "value": 7}}
    return base | changes


class RecommenderTests(unittest.TestCase):
    def test_exact_match_outranks_mismatch(self):
        exact, mismatch = shoe(), shoe(id="race", model="Race", bestUse=["race"], cushionFeel="firm", distance=["5k"])
        results = recommend(PREFS, [mismatch, exact])
        self.assertEqual(results[0]["shoe"]["id"], "daily")

    def test_score_is_normalized_and_explained(self):
        result = recommend(PREFS, [shoe()])[0]
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 1)
        self.assertAlmostEqual(sum(result["score_breakdown"].values()), result["score"], places=4)

    def test_far_over_budget_is_not_recommended(self):
        self.assertEqual(recommend(PREFS, [shoe(msrp=280)]), [])


if __name__ == "__main__":
    unittest.main()
