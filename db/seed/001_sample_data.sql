-- Seed sample shoes into the KB (mirrors the offline MVP catalog approximately)
-- This is intentionally small; production KB should be populated by ingestion pipelines.

BEGIN;

-- Helper: upsert family and return id
-- We'll do it with CTEs per shoe family.

-- ROAD: ASICS Gel-Nimbus 26
WITH fam AS (
  INSERT INTO shoe_family (brand, model, category)
  VALUES ('ASICS', 'Gel-Nimbus', 'road')
  ON CONFLICT (brand, model, category) DO UPDATE SET brand = EXCLUDED.brand
  RETURNING id
),
ver AS (
  INSERT INTO shoe_version (family_id, version_label, msrp_cents, currency_code)
  SELECT id, '26', 16000, 'USD' FROM fam
  ON CONFLICT (family_id, version_label) DO UPDATE SET msrp_cents = EXCLUDED.msrp_cents
  RETURNING id
)
INSERT INTO shoe_attributes (shoe_version_id, stability, cushion, width_options, best_use, distance_focus, notes)
SELECT
  ver.id,
  'neutral',
  'soft',
  ARRAY['regular','wide']::text[],
  ARRAY['easy','daily']::text[],
  ARRAY['10k','hm','fm']::text[],
  ARRAY['Plush high-stack cruiser','Comfort-focused upper','Not the snappiest for speed work']::text[]
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  stability = EXCLUDED.stability,
  cushion = EXCLUDED.cushion,
  width_options = EXCLUDED.width_options,
  best_use = EXCLUDED.best_use,
  distance_focus = EXCLUDED.distance_focus,
  notes = EXCLUDED.notes;

WITH fam AS (
  SELECT id FROM shoe_family WHERE brand='ASICS' AND model='Gel-Nimbus' AND category='road'
),
ver AS (
  SELECT id FROM shoe_version WHERE family_id = (SELECT id FROM fam) AND version_label='26'
)
INSERT INTO shoe_specs (shoe_version_id, weight_g_men, drop_mm, stack_mm_heel)
SELECT ver.id, 295, 8, 41
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  weight_g_men = EXCLUDED.weight_g_men,
  drop_mm = EXCLUDED.drop_mm,
  stack_mm_heel = EXCLUDED.stack_mm_heel;

WITH fam AS (
  SELECT id FROM shoe_family WHERE brand='ASICS' AND model='Gel-Nimbus' AND category='road'
),
ver AS (
  SELECT id FROM shoe_version WHERE family_id = (SELECT id FROM fam) AND version_label='26'
)
INSERT INTO shoe_scores (shoe_version_id, cushioning_score, responsiveness_score, stability_score, durability_score, value_score, method, confidence)
SELECT ver.id, 9, 5, 5, 8, 7, 'manual', 0.7
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  cushioning_score = EXCLUDED.cushioning_score,
  responsiveness_score = EXCLUDED.responsiveness_score,
  stability_score = EXCLUDED.stability_score,
  durability_score = EXCLUDED.durability_score,
  value_score = EXCLUDED.value_score,
  method = EXCLUDED.method,
  confidence = EXCLUDED.confidence;

-- TRAIL: HOKA Speedgoat 5
WITH fam AS (
  INSERT INTO shoe_family (brand, model, category)
  VALUES ('HOKA', 'Speedgoat', 'trail')
  ON CONFLICT (brand, model, category) DO UPDATE SET brand = EXCLUDED.brand
  RETURNING id
),
ver AS (
  INSERT INTO shoe_version (family_id, version_label, msrp_cents, currency_code)
  SELECT id, '5', 15500, 'USD' FROM fam
  ON CONFLICT (family_id, version_label) DO UPDATE SET msrp_cents = EXCLUDED.msrp_cents
  RETURNING id
)
INSERT INTO shoe_attributes (shoe_version_id, stability, cushion, width_options, best_use, distance_focus, notes)
SELECT
  ver.id,
  'neutral',
  'soft',
  ARRAY['regular','wide']::text[],
  ARRAY['easy','daily','mixed']::text[],
  ARRAY['10k','hm','fm','ultra']::text[],
  ARRAY['Protective, popular ultra shoe','Great cushioning-to-grip balance']::text[]
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  stability = EXCLUDED.stability,
  cushion = EXCLUDED.cushion,
  width_options = EXCLUDED.width_options,
  best_use = EXCLUDED.best_use,
  distance_focus = EXCLUDED.distance_focus,
  notes = EXCLUDED.notes;

WITH fam AS (
  SELECT id FROM shoe_family WHERE brand='HOKA' AND model='Speedgoat' AND category='trail'
),
ver AS (
  SELECT id FROM shoe_version WHERE family_id = (SELECT id FROM fam) AND version_label='5'
)
INSERT INTO shoe_specs (shoe_version_id, weight_g_men, drop_mm, stack_mm_heel, lug_depth_mm, rock_plate)
SELECT ver.id, 291, 4, 33, 5, false
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  weight_g_men = EXCLUDED.weight_g_men,
  drop_mm = EXCLUDED.drop_mm,
  stack_mm_heel = EXCLUDED.stack_mm_heel,
  lug_depth_mm = EXCLUDED.lug_depth_mm,
  rock_plate = EXCLUDED.rock_plate;

WITH fam AS (
  SELECT id FROM shoe_family WHERE brand='HOKA' AND model='Speedgoat' AND category='trail'
),
ver AS (
  SELECT id FROM shoe_version WHERE family_id = (SELECT id FROM fam) AND version_label='5'
)
INSERT INTO shoe_scores (shoe_version_id, cushioning_score, responsiveness_score, stability_score, durability_score, value_score, grip_score, protection_score, method, confidence)
SELECT ver.id, 8, 6, 6, 7, 7, 8, 8, 'manual', 0.7
FROM ver
ON CONFLICT (shoe_version_id) DO UPDATE SET
  cushioning_score = EXCLUDED.cushioning_score,
  responsiveness_score = EXCLUDED.responsiveness_score,
  stability_score = EXCLUDED.stability_score,
  durability_score = EXCLUDED.durability_score,
  value_score = EXCLUDED.value_score,
  grip_score = EXCLUDED.grip_score,
  protection_score = EXCLUDED.protection_score,
  method = EXCLUDED.method,
  confidence = EXCLUDED.confidence;

COMMIT;