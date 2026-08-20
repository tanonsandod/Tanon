use crate::db::AppState;
use crate::models::{BusbarSectionNode, SchematicSheetDto, SheetNode};
use crate::sld::{SldContent, SldFeeder, SldPaletteItemDto};
use sqlx::PgPool;
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub fn list_sld_palette() -> Vec<SldPaletteItemDto> {
  vec![
    SldPaletteItemDto {
      symbol_type: "mccb".into(),
      label: "MCCB".into(),
      label_th: "เมนเบรกเกอร์".into(),
      default_tag_prefix: "Q".into(),
      iec_ref: Some("IEC 60617".into()),
    },
    SldPaletteItemDto {
      symbol_type: "mccb_ds".into(),
      label: "MCCB + DS".into(),
      label_th: "MCCB + Isolator".into(),
      default_tag_prefix: "Q".into(),
      iec_ref: None,
    },
    SldPaletteItemDto {
      symbol_type: "fuse".into(),
      label: "Fuse".into(),
      label_th: "ฟิวส์".into(),
      default_tag_prefix: "F".into(),
      iec_ref: None,
    },
    SldPaletteItemDto {
      symbol_type: "contactor".into(),
      label: "Contactor".into(),
      label_th: "คอนแทคเตอร์".into(),
      default_tag_prefix: "K".into(),
      iec_ref: None,
    },
    SldPaletteItemDto {
      symbol_type: "motor".into(),
      label: "Motor".into(),
      label_th: "มอเตอร์".into(),
      default_tag_prefix: "M".into(),
      iec_ref: None,
    },
    SldPaletteItemDto {
      symbol_type: "transformer".into(),
      label: "Transformer".into(),
      label_th: "หม้อแปลง".into(),
      default_tag_prefix: "T".into(),
      iec_ref: None,
    },
    SldPaletteItemDto {
      symbol_type: "load".into(),
      label: "Load".into(),
      label_th: "โหลดทั่วไป".into(),
      default_tag_prefix: "L".into(),
      iec_ref: None,
    },
  ]
}

#[tauri::command]
pub async fn get_schematic_sheet(
  state: State<'_, AppState>,
  sheet_id: String,
) -> Result<SchematicSheetDto, String> {
  load_schematic_sheet(&state.pool, &sheet_id).await
}

#[tauri::command]
pub async fn get_panel_entry_sheet(
  state: State<'_, AppState>,
  panel_design_id: String,
) -> Result<SchematicSheetDto, String> {
  let sheet_id: Option<String> = sqlx::query_scalar(
    "SELECT id FROM panel_sheets
     WHERE panel_design_id = $1 AND sheet_type = 'single_line'
     ORDER BY sort_order LIMIT 1",
  )
  .bind(&panel_design_id)
  .fetch_optional(&state.pool)
  .await
  .map_err(|e| e.to_string())?;

  let sheet_id = if let Some(id) = sheet_id {
    id
  } else {
    sqlx::query_scalar(
      "SELECT id FROM panel_sheets
       WHERE panel_design_id = $1
       ORDER BY sort_order LIMIT 1",
    )
    .bind(&panel_design_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("no sheets for panel {panel_design_id}"))?
  };

  load_schematic_sheet(&state.pool, &sheet_id).await
}

#[tauri::command]
pub async fn save_sld_content(
  state: State<'_, AppState>,
  sheet_id: String,
  content: SldContent,
) -> Result<SchematicSheetDto, String> {
  validate_sld_content(&content)?;
  let json = serde_json::to_string(&content).map_err(|e| e.to_string())?;

  let updated = sqlx::query(
    "UPDATE panel_sheets
     SET content_json = $1,
         schematic_status = CASE
           WHEN schematic_status = 'complete' THEN 'complete'
           ELSE 'in_progress'
         END,
         modified_at = CURRENT_TIMESTAMP
     WHERE id = $2",
  )
  .bind(&json)
  .bind(&sheet_id)
  .execute(&state.pool)
  .await
  .map_err(|e| e.to_string())?
  .rows_affected();

  if updated == 0 {
    return Err(format!("sheet not found: {sheet_id}"));
  }

  load_schematic_sheet(&state.pool, &sheet_id).await
}

#[tauri::command]
pub async fn complete_sld(
  state: State<'_, AppState>,
  sheet_id: String,
) -> Result<SchematicSheetDto, String> {
  let dto = load_schematic_sheet(&state.pool, &sheet_id).await?;

  if dto.sheet.sheet_type != "single_line" {
    return Err("only single line sheets can be completed".into());
  }

  validate_sld_for_complete(&dto.sld_content)?;

  sqlx::query(
    "UPDATE panel_sheets
     SET schematic_status = 'complete', modified_at = CURRENT_TIMESTAMP
     WHERE id = $1",
  )
  .bind(&sheet_id)
  .execute(&state.pool)
  .await
  .map_err(|e| e.to_string())?;

  load_schematic_sheet(&state.pool, &sheet_id).await
}

fn validate_sld_content(content: &SldContent) -> Result<(), String> {
  if content.version != 1 {
    return Err("unsupported SLD content version".into());
  }
  for feeder in &content.feeders {
    if feeder.tag.trim().is_empty() {
      return Err("feeder tag cannot be empty".into());
    }
    for dev in &feeder.devices {
      if dev.tag.trim().is_empty() {
        return Err(format!("device tag cannot be empty on feeder {}", feeder.tag));
      }
    }
  }
  Ok(())
}

fn validate_sld_for_complete(content: &SldContent) -> Result<(), String> {
  validate_sld_content(content)?;
  if content.feeders.is_empty() {
    return Err("ต้องมีอย่างน้อย 1 feeder บน Single Line".into());
  }
  let has_breaker = content.feeders.iter().any(|f| {
    f.devices.iter().any(|d| {
      d.symbol_type == "mccb" || d.symbol_type == "mccb_ds" || d.symbol_type == "fuse"
    })
  });
  if !has_breaker {
    return Err("ต้องมี MCCB หรือ Fuse อย่างน้อย 1 ตัวบน Single Line".into());
  }
  Ok(())
}

async fn load_schematic_sheet(pool: &PgPool, sheet_id: &str) -> Result<SchematicSheetDto, String> {
  let row = sqlx::query(
    "SELECT s.id, s.sheet_no, s.display_name, s.title,
            COALESCE(s.sheet_type, 'detail') AS sheet_type, s.sort_order::bigint AS sort_order,
            COALESCE(s.schematic_status, 'empty') AS schematic_status,
            pd.id AS panel_design_id, pd.panel_code, pd.name AS panel_name,
            pd.production_qty::bigint AS production_qty,
            d.drawing_no, p.grid_unit_mm, s.content_json
     FROM panel_sheets s
     JOIN panel_designs pd ON pd.id = s.panel_design_id
     JOIN drawings d ON d.id = pd.drawing_id
     JOIN projects p ON p.id = d.project_id
     WHERE s.id = $1",
  )
  .bind(sheet_id)
  .fetch_optional(pool)
  .await
  .map_err(|e| e.to_string())?
  .ok_or_else(|| format!("sheet not found: {sheet_id}"))?;

  let sheet = SheetNode {
    id: row.try_get("id").map_err(|e| e.to_string())?,
    sheet_no: row.try_get("sheet_no").map_err(|e| e.to_string())?,
    display_name: row.try_get("display_name").map_err(|e| e.to_string())?,
    title: row.try_get("title").map_err(|e| e.to_string())?,
    sheet_type: row.try_get("sheet_type").map_err(|e| e.to_string())?,
    sort_order: row.try_get("sort_order").map_err(|e| e.to_string())?,
    schematic_status: row.try_get("schematic_status").map_err(|e| e.to_string())?,
  };
  let panel_design_id: String = row.try_get("panel_design_id").map_err(|e| e.to_string())?;
  let content_raw: Option<String> = row.try_get("content_json").map_err(|e| e.to_string())?;

  let busbar_sections =
    super::project::load_busbar_sections(pool, &panel_design_id).await?;
  let sld_content = parse_or_build_sld_content(content_raw.as_deref(), &busbar_sections);

  Ok(SchematicSheetDto {
    sheet,
    panel_code: row.try_get("panel_code").map_err(|e| e.to_string())?,
    panel_name: row.try_get("panel_name").map_err(|e| e.to_string())?,
    production_qty: row.try_get("production_qty").map_err(|e| e.to_string())?,
    drawing_no: row.try_get("drawing_no").map_err(|e| e.to_string())?,
    busbar_sections,
    grid_unit_mm: row.try_get("grid_unit_mm").map_err(|e| e.to_string())?,
    sld_content,
  })
}

fn parse_or_build_sld_content(
  raw: Option<&str>,
  busbar_sections: &[BusbarSectionNode],
) -> SldContent {
  if let Some(json) = raw {
    if let Ok(content) = serde_json::from_str::<SldContent>(json) {
      if !content.feeders.is_empty() {
        return content;
      }
    }
  }
  build_sld_from_busbar(busbar_sections)
}

fn build_sld_from_busbar(sections: &[BusbarSectionNode]) -> SldContent {
  let feeders: Vec<SldFeeder> = sections
    .iter()
    .filter(|s| s.section_role == "feeder")
    .enumerate()
    .map(|(i, s)| SldFeeder {
      id: format!("feeder-{}", s.id),
      busbar_section_id: Some(s.id.clone()),
      tag: s.feeder_tag.clone().unwrap_or_else(|| format!("F{}", i + 1)),
      rated_current_a: Some(s.rated_current_a),
      size_label: Some(s.size_label.clone()),
      devices: Vec::new(),
    })
    .collect();

  SldContent {
    version: 1,
    incoming_label: Some("400V 3Ph 50Hz".into()),
    incoming_voltage: None,
    feeders,
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::sld::SldDevice;

  #[test]
  fn validate_complete_requires_breaker() {
    let content = SldContent {
      version: 1,
      incoming_label: None,
      incoming_voltage: None,
      feeders: vec![SldFeeder {
        id: "f1".into(),
        busbar_section_id: None,
        tag: "F1".into(),
        rated_current_a: Some(100),
        size_label: None,
        devices: vec![SldDevice {
          id: "d1".into(),
          symbol_type: "motor".into(),
          tag: "M1".into(),
          rating: None,
          catalog_item_id: None,
          manufacturer: None,
          part_number: None,
          description: None,
        }],
      }],
    };
    assert!(validate_sld_for_complete(&content).is_err());
  }
}
