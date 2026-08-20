-- ABB catalog for SLD fluent device picker

INSERT INTO catalog_items (id, category_id, manufacturer, part_number, description, default_symbol_id, rating_json, list_price) VALUES
  ('cat-abb-xt4-250', 'cat-mccb', 'ABB', '1SDA068337R1', 'Tmax XT4N 250 TMD R250 3p', 'sym-sld-mccb',
   '{"current":"250A","poles":3,"icu":"36kA","series":"Tmax XT4"}', 28500),
  ('cat-abb-xt4-160', 'cat-mccb', 'ABB', '1SDA068326R1', 'Tmax XT4N 160 TMD R160 3p', 'sym-sld-mccb',
   '{"current":"160A","poles":3,"icu":"36kA","series":"Tmax XT4"}', 19800),
  ('cat-abb-xt4-100', 'cat-mccb', 'ABB', '1SDA068318R1', 'Tmax XT4N 100 TMD R100 3p', 'sym-sld-mccb',
   '{"current":"100A","poles":3,"icu":"36kA","series":"Tmax XT4"}', 12400),
  ('cat-abb-t4-250',  'cat-mccb', 'ABB', '1SDA060113R1', 'Tmax T4N 250 PR221DS-LSI 3p', 'sym-sld-mccb',
   '{"current":"250A","poles":3,"icu":"50kA","series":"Tmax T4"}', 35200),
  ('cat-abb-af09', 'cat-contactor', 'ABB', '1SBL137001R1300', 'AF09-30-10-13 Contactor 9A', 'sym-sld-k',
   '{"current":"9A","coil":"24V DC","series":"AF"}', 1850),
  ('cat-abb-af16', 'cat-contactor', 'ABB', '1SBL237001R1300', 'AF16-30-10-13 Contactor 16A', 'sym-sld-k',
   '{"current":"16A","coil":"24V DC","series":"AF"}', 2100),
  ('cat-abb-af26', 'cat-contactor', 'ABB', '1SBL347001R1300', 'AF26-30-10-13 Contactor 26A', 'sym-sld-k',
   '{"current":"26A","coil":"24V DC","series":"AF"}', 2650),
  ('cat-abb-ot63', 'cat-mccb', 'ABB', 'OT63FT3', 'OT63F3 Disconnect switch 63A 3p', 'sym-sld-mccb-ds',
   '{"current":"63A","poles":3,"series":"OT"}', 3200),
  ('cat-abb-motor75', 'cat-motor', 'ABB', 'M2BA132S-4', 'Motor 75kW 400V IE3', 'sym-sld-motor',
   '{"power":"75kW","voltage":"400V","series":"M2BA"}', 89500);

-- Switch demo SLD to ABB parts
UPDATE panel_sheets SET content_json = '{
  "version": 1,
  "incomingLabel": "400V 3Ph 50Hz",
  "incomingVoltage": "From Transformer T1",
  "manufacturerDefault": "ABB",
  "feeders": [
    {
      "id": "feeder-f1",
      "busbarSectionId": "bbs-mdb-f1",
      "tag": "F1",
      "ratedCurrentA": 800,
      "sizeLabel": "50×10",
      "devices": [
        {
          "id": "dev-q1",
          "symbolType": "mccb",
          "tag": "Q1",
          "rating": "250A",
          "catalogItemId": "cat-abb-xt4-250",
          "manufacturer": "ABB",
          "partNumber": "1SDA068337R1",
          "description": "Tmax XT4N 250 TMD R250 3p"
        },
        {
          "id": "dev-m1",
          "symbolType": "motor",
          "tag": "M1",
          "rating": "75kW",
          "catalogItemId": "cat-abb-motor75",
          "manufacturer": "ABB",
          "partNumber": "M2BA132S-4",
          "description": "Motor 75kW 400V IE3"
        }
      ]
    }
  ]
}', schematic_status = 'in_progress'
WHERE id = 'sh-a01';

UPDATE panel_sheets SET content_json = '{
  "version": 1,
  "incomingLabel": "400V 3Ph",
  "incomingVoltage": "From MDB1",
  "manufacturerDefault": "ABB",
  "feeders": [
    {
      "id": "feeder-db1",
      "busbarSectionId": "bbs-db-main",
      "tag": "F1",
      "ratedCurrentA": 630,
      "sizeLabel": "50×5",
      "devices": [
        {
          "id": "dev-q1",
          "symbolType": "mccb",
          "tag": "Q1",
          "rating": "100A",
          "catalogItemId": "cat-abb-xt4-100",
          "manufacturer": "ABB",
          "partNumber": "1SDA068318R1",
          "description": "Tmax XT4N 100 TMD R100 3p"
        }
      ]
    }
  ]
}', schematic_status = 'in_progress'
WHERE id = 'sh-b01';
