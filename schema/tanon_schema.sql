-- =============================================================================
-- TANON — Electrical Panel Schematic & Production Data Model
-- Version: 1.0.0
-- Hierarchy: Project → Drawing → Panel Design → Sheets / Devices / Busbar
-- =============================================================================

PRAGMA foreign_keys = ON;

-- =============================================================================
-- 1. PROJECT LAYER
-- =============================================================================

CREATE TABLE projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    code            TEXT,
    description     TEXT,
    customer        TEXT,
    location        TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    -- global electrical settings
    symbol_standard TEXT NOT NULL DEFAULT 'iec'
                    CHECK (symbol_standard IN ('ansi', 'iec')),
    busbar_rating_standard   TEXT NOT NULL DEFAULT 'din_en_61439',
    busbar_dimension_standard TEXT NOT NULL DEFAULT 'din_43671',
    ambient_temp_c  INTEGER NOT NULL DEFAULT 35,
    temp_rise_k     INTEGER NOT NULL DEFAULT 65,
    frequency_hz    INTEGER NOT NULL DEFAULT 50,
    grid_unit_mm    REAL NOT NULL DEFAULT 2.5,
    folder_path     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at     TEXT NOT NULL DEFAULT (datetime('now')),
    created_by      TEXT
);

CREATE TABLE project_activity (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    detail_json     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    user_name       TEXT
);

-- =============================================================================
-- 2. DRAWING LAYER  (e.g. E22-111)
-- =============================================================================

CREATE TABLE drawings (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    drawing_no      TEXT NOT NULL,              -- 'E22-111'
    title           TEXT,
    revision        TEXT NOT NULL DEFAULT 'A',
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'released', 'obsolete')),
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, drawing_no, revision)
);

CREATE TABLE drawing_revisions (
    id              TEXT PRIMARY KEY,
    drawing_id      TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
    revision        TEXT NOT NULL,
    description     TEXT,
    snapshot_path   TEXT,
    is_current      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_by      TEXT
);

-- =============================================================================
-- 3. PANEL DESIGN LAYER  (e.g. MDB1, DB)
-- =============================================================================

CREATE TABLE panel_designs (
    id              TEXT PRIMARY KEY,
    drawing_id      TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
    panel_code      TEXT NOT NULL,              -- 'MDB1', 'DB'
    name            TEXT,
    description     TEXT,
    production_qty  INTEGER NOT NULL DEFAULT 1, -- mass production count
    sheet_prefix    TEXT,                       -- 'A', 'B'
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (drawing_id, panel_code)
);

-- physical units produced from a panel design (DB-01 … DB-10)
CREATE TABLE panel_instances (
    id              TEXT PRIMARY KEY,
    panel_design_id TEXT NOT NULL REFERENCES panel_designs(id) ON DELETE CASCADE,
    instance_no     INTEGER NOT NULL,
    serial_no       TEXT,
    asset_tag       TEXT,                       -- 'DB-01', 'MDB1'
    status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_production', 'tested', 'shipped', 'cancelled')),
    production_order_id TEXT,
    notes           TEXT,
    UNIQUE (panel_design_id, instance_no)
);

-- =============================================================================
-- 4. SHEET LAYER  (e.g. ELE A01–A20, ELE B01–B03)
-- =============================================================================

CREATE TABLE panel_sheets (
    id              TEXT PRIMARY KEY,
    panel_design_id TEXT NOT NULL REFERENCES panel_designs(id) ON DELETE CASCADE,
    sheet_no        TEXT NOT NULL,              -- 'A01', 'B02'
    display_name    TEXT NOT NULL,              -- 'ELE A01'
    title           TEXT,
    sheet_type      TEXT NOT NULL DEFAULT 'detail'
                    CHECK (sheet_type IN ('single_line','power','control','terminal','index','detail')),
    schematic_status TEXT NOT NULL DEFAULT 'empty'
                    CHECK (schematic_status IN ('empty','in_progress','complete')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    grid_offset_x   INTEGER NOT NULL DEFAULT 0,
    grid_offset_y   INTEGER NOT NULL DEFAULT 0,
    content_json    TEXT,                       -- schematic geometry snapshot
    modified_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (panel_design_id, sheet_no)
);

-- =============================================================================
-- 5. SYMBOL & CATALOG LAYER
-- =============================================================================

CREATE TABLE standards (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    region          TEXT                        -- 'IEC', 'ANSI', 'DIN'
);

CREATE TABLE equipment_categories (
    id              TEXT PRIMARY KEY,
    parent_id       TEXT REFERENCES equipment_categories(id),
    code            TEXT NOT NULL UNIQUE,       -- 'CONTACTOR', 'RELAY'
    name            TEXT NOT NULL,
    name_th         TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE symbol_definitions (
    id              TEXT PRIMARY KEY,
    standard_id     TEXT NOT NULL REFERENCES standards(id),
    symbol_type     TEXT NOT NULL,              -- 'coil', 'no_contact', 'motor'
    name            TEXT NOT NULL,
    svg_path        TEXT,
    width_grid      REAL NOT NULL DEFAULT 4,
    height_grid     REAL NOT NULL DEFAULT 4
);

CREATE TABLE symbol_pins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id       TEXT NOT NULL REFERENCES symbol_definitions(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,              -- 'A1', '13', '14'
    pin_type        TEXT,                       -- 'power', 'signal', 'coil'
    direction       TEXT,                       -- 'in', 'out', 'bidirectional'
    grid_x          REAL NOT NULL,
    grid_y          REAL NOT NULL,
    wire_style      TEXT DEFAULT 'ac'
);

CREATE TABLE catalog_items (
    id              TEXT PRIMARY KEY,
    category_id     TEXT NOT NULL REFERENCES equipment_categories(id),
    manufacturer    TEXT,
    part_number     TEXT NOT NULL,
    description     TEXT,
    description_th  TEXT,
    default_symbol_id TEXT REFERENCES symbol_definitions(id),
    rating_json     TEXT,                       -- {"voltage":"400V","current":"9A"}
    bom_unit        TEXT NOT NULL DEFAULT 'EA',
    list_price      REAL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    UNIQUE (manufacturer, part_number)
);

-- which symbols a catalog item uses (main body + aux contacts etc.)
CREATE TABLE catalog_symbol_map (
    catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    symbol_id       TEXT NOT NULL REFERENCES symbol_definitions(id),
    role            TEXT NOT NULL,              -- 'main', 'aux_no', 'aux_nc'
    quantity        INTEGER NOT NULL DEFAULT 1,
    contact_code    TEXT,                       -- '13-14', '1-2'
  PRIMARY KEY (catalog_item_id, symbol_id, role)
);

-- project-level catalog overrides (price, part number)
CREATE TABLE project_catalog_overrides (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id),
    override_pn     TEXT,
    override_price  REAL,
    notes           TEXT,
  PRIMARY KEY (project_id, catalog_item_id)
);

-- =============================================================================
-- 6. DEVICE & INTERLOCK LAYER  (scoped to panel_design)
-- =============================================================================

CREATE TABLE device_instances (
    id              TEXT PRIMARY KEY,
    panel_design_id TEXT NOT NULL REFERENCES panel_designs(id) ON DELETE CASCADE,
    catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id),
    tag             TEXT NOT NULL,              -- 'K1', 'Q1' — unique per panel_design
    tag_prefix      TEXT,
    sequence_num    INTEGER,
    location        TEXT,
    properties_json TEXT,
    UNIQUE (panel_design_id, tag)
);

-- permanent contact identity for interlock across sheets
CREATE TABLE contact_instances (
    id              TEXT PRIMARY KEY,
    device_id       TEXT NOT NULL REFERENCES device_instances(id) ON DELETE CASCADE,
    contact_code    TEXT NOT NULL,              -- '13-14', 'A1-A2'
    contact_type    TEXT NOT NULL,              -- 'coil', 'no', 'nc', 'power'
    pin_a           TEXT,
    pin_b           TEXT,
    symbol_role     TEXT,
    UNIQUE (device_id, contact_code)
);

CREATE TABLE symbol_placements (
    id                  TEXT PRIMARY KEY,
    sheet_id            TEXT NOT NULL REFERENCES panel_sheets(id) ON DELETE CASCADE,
    device_id           TEXT NOT NULL REFERENCES device_instances(id) ON DELETE CASCADE,
    contact_instance_id TEXT REFERENCES contact_instances(id),
    symbol_id           TEXT NOT NULL REFERENCES symbol_definitions(id),
    grid_x              INTEGER NOT NULL,
    grid_y              INTEGER NOT NULL,
    rotation            INTEGER NOT NULL DEFAULT 0,
    scale               REAL NOT NULL DEFAULT 1.0,
    show_cross_ref      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE cross_references (
    id                  TEXT PRIMARY KEY,
    device_id           TEXT NOT NULL REFERENCES device_instances(id) ON DELETE CASCADE,
    source_placement_id TEXT NOT NULL REFERENCES symbol_placements(id) ON DELETE CASCADE,
    target_placement_id TEXT NOT NULL REFERENCES symbol_placements(id) ON DELETE CASCADE,
    ref_label           TEXT                  -- '/A03', '/B02'
);

-- =============================================================================
-- 7. WIRING / NET LAYER
-- =============================================================================

CREATE TABLE nets (
    id              TEXT PRIMARY KEY,
    panel_design_id TEXT NOT NULL REFERENCES panel_designs(id) ON DELETE CASCADE,
    name            TEXT,                       -- 'L1', '24V+', '0V'
    wire_number     TEXT,
    gauge           TEXT,
    color           TEXT,
    net_type        TEXT DEFAULT 'power'        -- 'power', 'control', 'earth'
);

CREATE TABLE wire_segments (
    id              TEXT PRIMARY KEY,
    sheet_id        TEXT NOT NULL REFERENCES panel_sheets(id) ON DELETE CASCADE,
    net_id          TEXT NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
    from_contact_id TEXT REFERENCES contact_instances(id),
    to_contact_id   TEXT REFERENCES contact_instances(id),
    points_json     TEXT NOT NULL               -- [{gx,gy}, ...] orthogonal polyline
);

-- =============================================================================
-- 8. BUSBAR LAYER  (IEC / ANSI / DIN)
-- =============================================================================

CREATE TABLE busbar_standards (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    edition         TEXT,
    region          TEXT NOT NULL,              -- 'IEC', 'ANSI', 'DIN'
    standard_type   TEXT NOT NULL               -- 'dimension', 'rating'
                    CHECK (standard_type IN ('dimension', 'rating'))
);

CREATE TABLE busbar_materials (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,              -- 'Copper', 'Aluminum'
    density_kg_m3   REAL,
    resistivity     REAL,
    temp_coeff      REAL
);

CREATE TABLE busbar_sizes (
    id              TEXT PRIMARY KEY,
    width_mm        REAL NOT NULL,
    thickness_mm    REAL NOT NULL,
    cross_section_mm2 REAL NOT NULL,
    label           TEXT NOT NULL,              -- '100×10'
    din_43671_code  TEXT,                       -- '100x10'
    is_din_standard INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE busbar_ratings (
    id              TEXT PRIMARY KEY,
    standard_id     TEXT NOT NULL REFERENCES busbar_standards(id),
    material_id     TEXT NOT NULL REFERENCES busbar_materials(id),
    size_id         TEXT NOT NULL REFERENCES busbar_sizes(id),
    bars_per_phase  INTEGER NOT NULL DEFAULT 1,
    rated_current_a INTEGER NOT NULL,
    temp_rise_k     INTEGER NOT NULL DEFAULT 65,
    ambient_temp_c  INTEGER NOT NULL DEFAULT 35,
    frequency_hz    INTEGER NOT NULL DEFAULT 50,
    icw_ka          REAL,
    icw_duration_s  REAL DEFAULT 1.0,
    mounting        TEXT,
    spacing_mm      REAL,
    coating         TEXT,
    source_table    TEXT,
    notes           TEXT,
    UNIQUE (standard_id, material_id, size_id, bars_per_phase, temp_rise_k, ambient_temp_c)
);

CREATE TABLE busbar_derating_factors (
    id              TEXT PRIMARY KEY,
    standard_id     TEXT NOT NULL REFERENCES busbar_standards(id),
    factor_type     TEXT NOT NULL,              -- 'ambient_temp', 'altitude', 'enclosure'
    condition_key   TEXT NOT NULL,              -- '40C', 'IP54'
    multiplier      REAL NOT NULL
);

-- busbar configuration per panel design
CREATE TABLE panel_busbar_configs (
    id              TEXT PRIMARY KEY,
    panel_design_id TEXT NOT NULL UNIQUE REFERENCES panel_designs(id) ON DELETE CASCADE,
    rating_standard_id    TEXT NOT NULL REFERENCES busbar_standards(id),
    dimension_standard_id TEXT NOT NULL REFERENCES busbar_standards(id),
    material_id     TEXT NOT NULL REFERENCES busbar_materials(id),
    notes           TEXT
);

CREATE TABLE panel_busbar_sections (
    id              TEXT PRIMARY KEY,
    config_id       TEXT NOT NULL REFERENCES panel_busbar_configs(id) ON DELETE CASCADE,
    section_role    TEXT NOT NULL,              -- 'main', 'feeder', 'distribution'
    feeder_tag      TEXT,                       -- 'F1' when role=feeder
    rating_id       TEXT NOT NULL REFERENCES busbar_ratings(id),
    bars_per_phase  INTEGER NOT NULL DEFAULT 1,
    length_mm       REAL NOT NULL,
    phases_json     TEXT DEFAULT '["L1","L2","L3","N"]',
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE busbar_placements (
    id              TEXT PRIMARY KEY,
    section_id      TEXT NOT NULL REFERENCES panel_busbar_sections(id) ON DELETE CASCADE,
    sheet_id        TEXT NOT NULL REFERENCES panel_sheets(id) ON DELETE CASCADE,
    phase           TEXT NOT NULL,
    grid_path_json  TEXT NOT NULL,
    show_label      INTEGER NOT NULL DEFAULT 1
);

-- =============================================================================
-- 9. BOM & PRODUCTION LAYER
-- =============================================================================

CREATE TABLE bom_lines (
    id              TEXT PRIMARY KEY,
    scope_type      TEXT NOT NULL               -- 'panel', 'drawing', 'project', 'order'
                    CHECK (scope_type IN ('panel', 'drawing', 'project', 'order')),
    scope_id        TEXT NOT NULL,
    catalog_item_id TEXT REFERENCES catalog_items(id),
    part_number     TEXT NOT NULL,
    description     TEXT,
    manufacturer    TEXT,
    category_code   TEXT,
    qty_per_unit    REAL NOT NULL DEFAULT 1,
    panel_qty       INTEGER NOT NULL DEFAULT 1,
    total_qty       REAL NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'EA',
    unit_price      REAL,
    line_total      REAL,
    tags_ref_json   TEXT,                       -- ["K1","K2"]
    panel_codes_json TEXT,                      -- ["MDB1","DB"]
    bom_group       TEXT,
    source_type     TEXT DEFAULT 'device'       -- 'device', 'busbar', 'accessory'
);

CREATE TABLE production_orders (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    drawing_id      TEXT REFERENCES drawings(id),
    order_no        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    ordered_at      TEXT NOT NULL DEFAULT (datetime('now')),
    due_date        TEXT,
    notes           TEXT
);

CREATE TABLE production_order_lines (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    panel_design_id TEXT NOT NULL REFERENCES panel_designs(id),
    quantity        INTEGER NOT NULL,
    completed_qty   INTEGER NOT NULL DEFAULT 0
);

-- =============================================================================
-- 10. INDEXES
-- =============================================================================

CREATE INDEX idx_drawings_project        ON drawings(project_id);
CREATE INDEX idx_panel_designs_drawing     ON panel_designs(drawing_id);
CREATE INDEX idx_panel_instances_design    ON panel_instances(panel_design_id);
CREATE INDEX idx_sheets_panel              ON panel_sheets(panel_design_id);
CREATE INDEX idx_devices_panel             ON device_instances(panel_design_id);
CREATE INDEX idx_devices_tag               ON device_instances(panel_design_id, tag);
CREATE INDEX idx_contacts_device           ON contact_instances(device_id);
CREATE INDEX idx_placements_sheet          ON symbol_placements(sheet_id);
CREATE INDEX idx_placements_device         ON symbol_placements(device_id);
CREATE INDEX idx_wires_sheet               ON wire_segments(sheet_id);
CREATE INDEX idx_wires_net                 ON wire_segments(net_id);
CREATE INDEX idx_bom_scope                 ON bom_lines(scope_type, scope_id);
CREATE INDEX idx_busbar_ratings_lookup     ON busbar_ratings(standard_id, material_id, size_id);
CREATE INDEX idx_catalog_category          ON catalog_items(category_id);
