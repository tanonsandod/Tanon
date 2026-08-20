use crate::db::AppState;
use crate::models::{SchematicSheetDto, SheetNode};
use rusqlite::Connection;
use tauri::State;

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

fn load_schematic_sheet(conn: &Connection, sheet_id: &str) -> Result<SchematicSheetDto, String> {
  let (
    sheet,
    panel_design_id,
    panel_code,
    panel_name,
    production_qty,
    drawing_no,
    grid_unit_mm,
  ) = conn
    .query_row(
      "SELECT s.id, s.sheet_no, s.display_name, s.title,
              COALESCE(s.sheet_type, 'detail'), s.sort_order,
              COALESCE(s.schematic_status, 'empty'),
              pd.id, pd.panel_code, pd.name, pd.production_qty,
              d.drawing_no, p.grid_unit_mm
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
        ))
      },
    )
    .map_err(|e| e.to_string())?;

  let busbar_sections = super::project::load_busbar_sections(conn, &panel_design_id)?;

  Ok(SchematicSheetDto {
    sheet,
    panel_code,
    panel_name,
    drawing_no,
    production_qty,
    busbar_sections,
    grid_unit_mm,
  })
}
