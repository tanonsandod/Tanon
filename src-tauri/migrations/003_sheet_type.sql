-- Add sheet type: schematic always starts from single_line
ALTER TABLE panel_sheets ADD COLUMN sheet_type TEXT NOT NULL DEFAULT 'detail';
ALTER TABLE panel_sheets ADD COLUMN schematic_status TEXT NOT NULL DEFAULT 'empty';

UPDATE panel_sheets
SET sheet_type = 'single_line',
    schematic_status = 'in_progress'
WHERE sort_order = 1
   OR title LIKE '%Single Line%'
   OR sheet_no LIKE '%01';

UPDATE panel_sheets
SET sheet_type = 'power'
WHERE title LIKE '%Power%';

UPDATE panel_sheets
SET sheet_type = 'control'
WHERE title LIKE '%Control%';

CREATE INDEX IF NOT EXISTS idx_sheets_type ON panel_sheets(panel_design_id, sheet_type);
