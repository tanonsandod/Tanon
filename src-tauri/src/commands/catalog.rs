use crate::db::AppState;
use crate::models::CatalogItemDto;
use tauri::State;

#[tauri::command]
pub fn list_catalog_items(
  state: State<AppState>,
  manufacturer: Option<String>,
  symbol_type: Option<String>,
) -> Result<Vec<CatalogItemDto>, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;

  let mut sql = String::from(
    "SELECT c.id, c.manufacturer, c.part_number, c.description, c.rating_json, c.list_price,
            ec.code AS category_code, sd.symbol_type
     FROM catalog_items c
     JOIN equipment_categories ec ON ec.id = c.category_id
     LEFT JOIN symbol_definitions sd ON sd.id = c.default_symbol_id
     WHERE c.is_active = 1",
  );

  if manufacturer.is_some() {
    sql.push_str(" AND c.manufacturer = ?1");
  }
  if symbol_type.is_some() {
    sql.push_str(if manufacturer.is_some() {
      " AND sd.symbol_type LIKE ?2"
    } else {
      " AND sd.symbol_type LIKE ?1"
    });
  }
  sql.push_str(" ORDER BY c.manufacturer, c.part_number");

  let sym_pattern = symbol_type.map(|s| map_palette_to_symbol_pattern(&s));

  let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

  let rows = match (&manufacturer, &sym_pattern) {
    (Some(m), Some(p)) => stmt.query_map(rusqlite::params![m, p], map_row),
    (Some(m), None) => stmt.query_map(rusqlite::params![m], map_row),
    (None, Some(p)) => stmt.query_map(rusqlite::params![p], map_row),
    (None, None) => stmt.query_map([], map_row),
  }
  .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn map_palette_to_symbol_pattern(symbol_type: &str) -> String {
  match symbol_type {
    "mccb" => "sld_mccb%".into(),
    "mccb_ds" => "sld_mccb_ds%".into(),
    "fuse" => "sld_fuse%".into(),
    "contactor" => "sld_contactor%".into(),
    "motor" => "sld_motor%".into(),
    "transformer" => "sld_transformer%".into(),
    "load" => "sld_load%".into(),
    _ => format!("sld_{symbol_type}%"),
  }
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CatalogItemDto> {
  Ok(CatalogItemDto {
    id: row.get(0)?,
    manufacturer: row.get(1)?,
    part_number: row.get(2)?,
    description: row.get(3)?,
    rating_json: row.get(4)?,
    list_price: row.get(5)?,
    category_code: row.get(6)?,
    symbol_type: row.get(7)?,
  })
}
