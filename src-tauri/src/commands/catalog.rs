use crate::db::AppState;
use crate::models::CatalogItemDto;
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn list_catalog_items(
  state: State<'_, AppState>,
  manufacturer: Option<String>,
  symbol_type: Option<String>,
) -> Result<Vec<CatalogItemDto>, String> {
  let sym_pattern = symbol_type.map(|s| map_palette_to_symbol_pattern(&s));

  let rows = match (&manufacturer, &sym_pattern) {
    (Some(m), Some(p)) => sqlx::query(
      "SELECT c.id, c.manufacturer, c.part_number, c.description, c.rating_json, c.list_price,
              ec.code AS category_code, sd.symbol_type
       FROM catalog_items c
       JOIN equipment_categories ec ON ec.id = c.category_id
       LEFT JOIN symbol_definitions sd ON sd.id = c.default_symbol_id
       WHERE c.is_active = TRUE AND c.manufacturer = $1 AND sd.symbol_type LIKE $2
       ORDER BY c.manufacturer, c.part_number",
    )
    .bind(m)
    .bind(p)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?,
    (Some(m), None) => sqlx::query(
      "SELECT c.id, c.manufacturer, c.part_number, c.description, c.rating_json, c.list_price,
              ec.code AS category_code, sd.symbol_type
       FROM catalog_items c
       JOIN equipment_categories ec ON ec.id = c.category_id
       LEFT JOIN symbol_definitions sd ON sd.id = c.default_symbol_id
       WHERE c.is_active = TRUE AND c.manufacturer = $1
       ORDER BY c.manufacturer, c.part_number",
    )
    .bind(m)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?,
    (None, Some(p)) => sqlx::query(
      "SELECT c.id, c.manufacturer, c.part_number, c.description, c.rating_json, c.list_price,
              ec.code AS category_code, sd.symbol_type
       FROM catalog_items c
       JOIN equipment_categories ec ON ec.id = c.category_id
       LEFT JOIN symbol_definitions sd ON sd.id = c.default_symbol_id
       WHERE c.is_active = TRUE AND sd.symbol_type LIKE $1
       ORDER BY c.manufacturer, c.part_number",
    )
    .bind(p)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?,
    (None, None) => sqlx::query(
      "SELECT c.id, c.manufacturer, c.part_number, c.description, c.rating_json, c.list_price,
              ec.code AS category_code, sd.symbol_type
       FROM catalog_items c
       JOIN equipment_categories ec ON ec.id = c.category_id
       LEFT JOIN symbol_definitions sd ON sd.id = c.default_symbol_id
       WHERE c.is_active = TRUE
       ORDER BY c.manufacturer, c.part_number",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?,
  };

  rows.iter().map(map_catalog_row).collect()
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

fn map_catalog_row(row: &sqlx::postgres::PgRow) -> Result<CatalogItemDto, String> {
  Ok(CatalogItemDto {
    id: row.try_get("id").map_err(|e| e.to_string())?,
    manufacturer: row.try_get("manufacturer").map_err(|e| e.to_string())?,
    part_number: row.try_get("part_number").map_err(|e| e.to_string())?,
    description: row.try_get("description").map_err(|e| e.to_string())?,
    rating_json: row.try_get("rating_json").map_err(|e| e.to_string())?,
    list_price: row.try_get("list_price").map_err(|e| e.to_string())?,
    category_code: row.try_get("category_code").map_err(|e| e.to_string())?,
    symbol_type: row.try_get("symbol_type").map_err(|e| e.to_string())?,
  })
}
