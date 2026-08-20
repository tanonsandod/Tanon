use crate::db::AppState;
use crate::models::{BusbarSectionNode, SchematicSheetDto, SheetNode};
use crate::sld::{SldContent, SldDevice, SldFeeder, SldPaletteItemDto};
use rusqlite::Connection;
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
pub fn get_schematic_sheet(
  state: State<AppState>,
  sheet_id: String,
) -> Result<SchematicSheetDto, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  load_schematic_sheet(&conn, &sheet_id)
}

#[tauri::command]
pub fn get_panel_entry_sheet(
  state: State<AppState>,
  panel_design_id: String,
) -> Result<SchematicSheetDto, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  let sheet_id: String = conn
    .query_row(
      "SELECT id FROM panel_sheets
       WHERE panel_design_id = ?1 AND sheet_type = 'single_line'
       ORDER BY sort_order LIMIT 1",
      [&panel_design_id],
      |row| row.get(0),
    )
    .or_else(|_| {
      conn.query_row(
        "SELECT id FROM panel_sheets
         WHERE panel_design_id = ?1
         ORDER BY sort_order LIMIT 1",
        [&panel_design_id],
        |row| row.get(0),
      )
    })
    .map_err(|e| e.to_string())?;

  load_schematic_sheet(&conn, &sheet_id)
}

#[tauri::command]
pub fn save_sld_content(
  state: State<AppState>,
  sheet_id: String,
  content: SldContent,
) -> Result<SchematicSheetDto, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  validate_sld_content(&content)?;

  let json = serde_json::to_string(&content).map_err(|e| e.to_string())?;
  let updated = conn
    .execute(
      "UPDATE panel_sheets
       SET content_json = ?1,
           schematic_status = CASE
             WHEN schematic_status = 'complete' THEN 'complete'
             ELSE 'in_progress'
           END,
           modified_at = datetime('now')
       WHERE id = ?2",
      [&json, &sheet_id],
    )
    .map_err(|e| e.to_string())?;

  if updated == 0 {
    return Err(format!("sheet not found: {sheet_id}"));
  }

  load_schematic_sheet(&conn, &sheet_id)
}

#[tauri::command]
pub fn complete_sld(
  state: State<AppState>,
  sheet_id: String,
) -> Result<SchematicSheetDto, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  let dto = load_schematic_sheet(&conn, &sheet_id)?;

  if dto.sheet.sheet_type != "single_line" {
    return Err("only single line sheets can be completed".into());
  }

  let content = dto.sld_content.clone();
  validate_sld_for_complete(&content)?;

  conn
    .execute(
      "UPDATE panel_sheets
       SET schematic_status = 'complete', modified_at = datetime('now')
       WHERE id = ?1",
      [&sheet_id],
    )
    .map_err(|e| e.to_string())?;

  load_schematic_sheet(&conn, &sheet_id)
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

fn load_schematic_sheet(conn: &Connection, sheet_id: &str) -> Result<SchematicSheetDto, String> {
  let (
    sheet,
    panel_design_id,
    panel_code,
    panel_name,
    production_qty,
    drawing_no,
    grid_unit_mm,
    content_raw,
  ) = conn
    .query_row(
      "SELECT s.id, s.sheet_no, s.display_name, s.title,
              COALESCE(s.sheet_type, 'detail'), s.sort_order,
              COALESCE(s.schematic_status, 'empty'),
              pd.id, pd.panel_code, pd.name, pd.production_qty,
              d.drawing_no, p.grid_unit_mm, s.content_json
       FROM panel_sheets s
       JOIN panel_designs pd ON pd.id = s.panel_design_id
       JOIN drawings d ON d.id = pd.drawing_id
       JOIN projects p ON p.id = d.project_id
       WHERE s.id = ?1",
      [sheet_id],
      |row| {
        Ok((
          SheetNode {
            id: row.get(0)?,
            sheet_no: row.get(1)?,
            display_name: row.get(2)?,
            title: row.get(3)?,
            sheet_type: row.get(4)?,
            sort_order: row.get(5)?,
            schematic_status: row.get(6)?,
          },
          row.get::<_, String>(7)?,
          row.get::<_, String>(8)?,
          row.get::<_, Option<String>>(9)?,
          row.get::<_, i64>(10)?,
          row.get::<_, String>(11)?,
          row.get::<_, f64>(12)?,
          row.get::<_, Option<String>>(13)?,
        ))
      },
    )
    .map_err(|e| e.to_string())?;

  let busbar_sections = super::project::load_busbar_sections(conn, &panel_design_id)?;
  let sld_content = parse_or_build_sld_content(content_raw.as_deref(), &busbar_sections);

  Ok(SchematicSheetDto {
    sheet,
    panel_code,
    panel_name,
    production_qty,
    drawing_no,
    busbar_sections,
    grid_unit_mm,
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
