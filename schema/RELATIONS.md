# TANON — Data Structure & Relations

## Entity Hierarchy

```
Project (proj-e22)
└── Drawing (E22-111)
    ├── Panel Design: MDB1  [qty=1]
    │   ├── Sheets: ELE A01 … A20
    │   ├── Devices: K1, Q1 … (tag unique per panel)
    │   ├── Contacts: K1/13-14, K1/A1-A2 … (interlock)
    │   ├── Placements: symbol on each sheet
    │   ├── Nets & Wires
    │   └── Busbar Config → Sections → Placements
    │
    └── Panel Design: DB  [qty=10]
        ├── Sheets: ELE B01 … B03  (shared design)
        ├── Instances: DB-01 … DB-10
        ├── Devices / Contacts / Wires
        └── Busbar Config
```

## ER Diagram (Full)

```mermaid
erDiagram
    projects ||--o{ drawings : has
    projects ||--o{ project_activity : logs
    projects ||--o{ project_catalog_overrides : overrides
    projects ||--o{ production_orders : orders

    drawings ||--o{ panel_designs : contains
    drawings ||--o{ drawing_revisions : versions

    panel_designs ||--o{ panel_instances : produces
    panel_designs ||--o{ panel_sheets : has
    panel_designs ||--o{ device_instances : has
    panel_designs ||--o{ nets : has
    panel_designs ||--o| panel_busbar_configs : configures

    panel_busbar_configs ||--o{ panel_busbar_sections : has
    panel_busbar_sections ||--o{ busbar_placements : drawn_on
    panel_busbar_sections }o--|| busbar_ratings : uses

    busbar_ratings }o--|| busbar_standards : per
    busbar_ratings }o--|| busbar_materials : material
    busbar_ratings }o--|| busbar_sizes : size

    panel_sheets ||--o{ symbol_placements : contains
    panel_sheets ||--o{ wire_segments : contains
    panel_sheets ||--o{ busbar_placements : contains

    equipment_categories ||--o{ catalog_items : groups
    catalog_items ||--o{ catalog_symbol_map : maps
    catalog_items ||--o{ device_instances : instantiates
    symbol_definitions ||--o{ catalog_symbol_map : used_by
    symbol_definitions ||--o{ symbol_pins : has
    symbol_definitions ||--o{ symbol_placements : renders

    device_instances ||--o{ contact_instances : owns
    device_instances ||--o{ symbol_placements : placed_as
    device_instances ||--o{ cross_references : xref

    contact_instances ||--o| symbol_placements : placed_as
    contact_instances ||--o{ wire_segments : connected

    nets ||--o{ wire_segments : carries

    production_orders ||--o{ production_order_lines : lines
    production_order_lines }o--|| panel_designs : for

    projects {
        text id PK
        text name
        text symbol_standard
        text busbar_rating_standard
        text busbar_dimension_standard
    }

    drawings {
        text id PK
        text project_id FK
        text drawing_no
        text revision
    }

    panel_designs {
        text id PK
        text drawing_id FK
        text panel_code
        int production_qty
    }

    panel_instances {
        text id PK
        text panel_design_id FK
        int instance_no
        text asset_tag
    }

    panel_sheets {
        text id PK
        text panel_design_id FK
        text sheet_no
        text display_name
    }

    device_instances {
        text id PK
        text panel_design_id FK
        text catalog_item_id FK
        text tag
    }

    contact_instances {
        text id PK
        text device_id FK
        text contact_code
        text contact_type
    }

    symbol_placements {
        text id PK
        text sheet_id FK
        text device_id FK
        text contact_instance_id FK
    }

    catalog_items {
        text id PK
        text category_id FK
        text part_number
        text default_symbol_id FK
    }

    busbar_ratings {
        text id PK
        text standard_id FK
        text size_id FK
        int rated_current_a
        real icw_ka
    }

    panel_busbar_sections {
        text id PK
        text config_id FK
        text section_role
        text rating_id FK
    }

    bom_lines {
        text id PK
        text scope_type
        text scope_id
        real total_qty
    }
```

## Key Relations Explained

| From | To | Cardinality | Rule |
|------|----|-------------|------|
| `projects` | `drawings` | 1:N | โปรเจกต์มีหลาย drawing |
| `drawings` | `panel_designs` | 1:N | E22-111 มี MDB1 + DB |
| `panel_designs` | `panel_instances` | 1:N | DB qty=10 → 10 instances |
| `panel_designs` | `panel_sheets` | 1:N | MDB1 → A01-A20 |
| `panel_designs` | `device_instances` | 1:N | tag unique ต่อ panel |
| `device_instances` | `contact_instances` | 1:N | interlock identity |
| `contact_instances` | `symbol_placements` | 1:0..1 | contact วางได้ 1 ที่ |
| `symbol_placements` | `panel_sheets` | N:1 | อยู่บน sheet |
| `catalog_items` | `device_instances` | 1:N | อุปกรณ์จาก catalog |
| `catalog_symbol_map` | — | M:N bridge | catalog ↔ symbols |
| `panel_busbar_configs` | `panel_busbar_sections` | 1:N | main + feeders |
| `busbar_ratings` | `busbar_sizes` | N:1 | DIN 43671 size |
| `bom_lines.scope_id` | polymorphic | — | panel / drawing / project |

## Scope & Uniqueness Rules

```
UNIQUE (project_id, drawing_no, revision)     → E22-111 Rev A
UNIQUE (drawing_id, panel_code)               → MDB1, DB
UNIQUE (panel_design_id, sheet_no)            → A01, B02
UNIQUE (panel_design_id, tag)                 → K1 per panel only
UNIQUE (device_id, contact_code)              → K1/13-14
UNIQUE (panel_design_id, instance_no)         → DB #01-#10
```

## BOM Aggregation Chain

```
device_instances (per panel design)
    ↓ qty_per_unit
panel_designs.production_qty
    ↓ × panel_qty
drawing (sum all panels in drawing)
    ↓
project (sum all drawings)
```

## Example Query Paths

**All sheets in drawing E22-111:**
```
drawings → panel_designs → panel_sheets
WHERE drawing_no = 'E22-111'
ORDER BY panel_designs.sort_order, panel_sheets.sort_order
```

**Interlock: all placements of device K1 in MDB1:**
```
device_instances (tag='K1', panel=MDB1)
  → contact_instances
  → symbol_placements
  → panel_sheets (cross-sheet)
```

**Mass BOM for DB × 10:**
```
device_instances WHERE panel_design_id = 'panel-db'
  → GROUP BY catalog_item_id
  → total_qty = SUM(qty) × production_qty(10)

panel_busbar_sections WHERE config.panel_design_id = 'panel-db'
  → total busbar × 10
```
