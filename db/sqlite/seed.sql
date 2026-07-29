-- Seed sample shoes into SQLite KB
PRAGMA foreign_keys = ON;

-- ROAD: ASICS Gel-Nimbus 26
INSERT OR IGNORE INTO shoe_family (id, brand, model, category)
VALUES ('fam-asics-gel-nimbus-road', 'ASICS', 'Gel-Nimbus', 'road');

INSERT OR REPLACE INTO shoe_version (id, family_id, version_label, msrp_cents, currency_code)
VALUES ('ver-asics-gel-nimbus-road-26', 'fam-asics-gel-nimbus-road', '26', 16000, 'USD');

INSERT OR REPLACE INTO shoe_specs (shoe_version_id, weight_g_men, drop_mm, stack_mm_heel)
VALUES ('ver-asics-gel-nimbus-road-26', 295, 8, 41);

INSERT OR REPLACE INTO shoe_attributes (
  shoe_version_id,
  stability,
  cushion,
  width_options_json,
  best_use_json,
  distance_focus_json,
  notes_json
)
VALUES (
  'ver-asics-gel-nimbus-road-26',
  'neutral',
  'soft',
  '["regular","wide"]',
  '["easy","daily"]',
  '["10k","hm","fm"]',
  '["Plush high-stack cruiser","Comfort-focused upper","Not the snappiest for speed work"]'
);

INSERT OR REPLACE INTO shoe_scores (
  shoe_version_id,
  cushioning_score,
  responsiveness_score,
  stability_score,
  durability_score,
  value_score,
  method,
  confidence
)
VALUES ('ver-asics-gel-nimbus-road-26', 9, 5, 5, 8, 7, 'manual', 0.7);

-- TRAIL: HOKA Speedgoat 5
INSERT OR IGNORE INTO shoe_family (id, brand, model, category)
VALUES ('fam-hoka-speedgoat-trail', 'HOKA', 'Speedgoat', 'trail');

INSERT OR REPLACE INTO shoe_version (id, family_id, version_label, msrp_cents, currency_code)
VALUES ('ver-hoka-speedgoat-trail-5', 'fam-hoka-speedgoat-trail', '5', 15500, 'USD');

INSERT OR REPLACE INTO shoe_specs (shoe_version_id, weight_g_men, drop_mm, stack_mm_heel, lug_depth_mm, rock_plate)
VALUES ('ver-hoka-speedgoat-trail-5', 291, 4, 33, 5, 0);

INSERT OR REPLACE INTO shoe_attributes (
  shoe_version_id,
  stability,
  cushion,
  width_options_json,
  best_use_json,
  distance_focus_json,
  notes_json
)
VALUES (
  'ver-hoka-speedgoat-trail-5',
  'neutral',
  'soft',
  '["regular","wide"]',
  '["easy","daily","mixed"]',
  '["10k","hm","fm","ultra"]',
  '["Protective, popular ultra shoe","Great cushioning-to-grip balance"]'
);

INSERT OR REPLACE INTO shoe_scores (
  shoe_version_id,
  cushioning_score,
  responsiveness_score,
  stability_score,
  durability_score,
  value_score,
  grip_score,
  protection_score,
  method,
  confidence
)
VALUES ('ver-hoka-speedgoat-trail-5', 8, 6, 6, 7, 7, 8, 8, 'manual', 0.7);