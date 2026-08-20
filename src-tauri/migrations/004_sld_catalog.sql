-- SLD catalog symbols + initial single line content for demo panels

INSERT INTO equipment_categories (id, code, name) VALUES
  ('cat-motor', 'MOTOR', 'Motors');

INSERT INTO symbol_definitions (id, standard_id, symbol_type, name, svg_path, width_grid, height_grid) VALUES
  ('sym-sld-mccb',    'iec', 'sld_mccb',    'MCCB (SLD)',    NULL, 2, 3),
  ('sym-sld-mccb-ds', 'iec', 'sld_mccb_ds', 'MCCB+DS (SLD)', NULL, 2, 4),
  ('sym-sld-fuse',    'iec', 'sld_fuse',    'Fuse (SLD)',    NULL, 2, 3),
  ('sym-sld-k',       'iec', 'sld_contactor','Contactor (SLD)',NULL, 2, 3),
  ('sym-sld-motor',   'iec', 'sld_motor',   'Motor (SLD)',   NULL, 2, 3),
  ('sym-sld-tx',      'iec', 'sld_transformer','Transformer (SLD)',NULL, 3, 4),
  ('sym-sld-load',    'iec', 'sld_load',    'Load (SLD)',    NULL, 2, 3);

INSERT INTO catalog_items (id, category_id, manufacturer, part_number, description, default_symbol_id, rating_json) VALUES
  ('cat-nsx100f', 'cat-mccb', 'Schneider', 'NSX100F',  'MCCB 100A 3P',  'sym-sld-mccb', '{"current":"100A","poles":3}'),
  ('cat-nsx250s', 'cat-mccb', 'Schneider', 'NSX250S',  'MCCB 250A 3P',  'sym-sld-mccb', '{"current":"250A","poles":3}'),
  ('cat-lc1d12',  'cat-contactor', 'Schneider', 'LC1D12', 'Contactor 12A', 'sym-sld-k', '{"current":"12A"}'),
  ('cat-motor75', 'cat-motor', 'Generic', 'M-75KW', 'Motor 75kW', 'sym-sld-motor', '{"power":"75kW"}');

-- MDB1 SLD: incoming + F1 with Q1 breaker and M1 motor
UPDATE panel_sheets SET content_json = '{
  "version": 1,
  "incomingLabel": "400V 3Ph 50Hz",
  "incomingVoltage": "From Transformer T1",
  "feeders": [
    {
      "id": "feeder-f1",
      "busbarSectionId": "bbs-mdb-f1",
      "tag": "F1",
      "ratedCurrentA": 800,
      "sizeLabel": "50×10",
      "devices": [
        {"id": "dev-q1", "symbolType": "mccb", "tag": "Q1", "rating": "800A", "catalogItemId": "cat-nsx250s"},
        {"id": "dev-m1", "symbolType": "motor", "tag": "M1", "rating": "75kW", "catalogItemId": "cat-motor75"}
      ]
    }
  ]
}', schematic_status = 'in_progress'
WHERE id = 'sh-a01';

-- DB SLD: main bus + Q1 only
UPDATE panel_sheets SET content_json = '{
  "version": 1,
  "incomingLabel": "400V 3Ph",
  "incomingVoltage": "From MDB1",
  "feeders": [
    {
      "id": "feeder-db1",
      "busbarSectionId": "bbs-db-main",
      "tag": "F1",
      "ratedCurrentA": 630,
      "sizeLabel": "50×5",
      "devices": [
        {"id": "dev-q1", "symbolType": "mccb", "tag": "Q1", "rating": "100A", "catalogItemId": "cat-nsx100f"}
      ]
    }
  ]
}', schematic_status = 'in_progress'
WHERE id = 'sh-b01';
