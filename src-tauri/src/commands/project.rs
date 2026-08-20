use crate::db::AppState;
use crate::models::{
  BomLineDto, BusbarSectionNode, DrawingNode, PanelDesignNode, PanelInstanceNode, ProjectSummary,
  ProjectTree, SheetNode,
};
use rusqlite::Connection;
use tauri::State;

#[tauri::command]
pub fn list_projects(state: State<AppState>) -> Result<Vec<ProjectSummary>, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  let mut stmt = conn
    .prepare(
      "SELECT id, name, code, customer, status, symbol_standard, busbar_rating_standard
       FROM projects ORDER BY modified_at DESC",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([], |row| {
      Ok(ProjectSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        code: row.get(2)?,
        customer: row.get(3)?,
        status: row.get(4)?,
        symbol_standard: row.get(5)?,
        busbar_rating_standard: row.get(6)?,
      })
    })
    .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_tree(state: State<AppState>, project_id: String) -> Result<ProjectTree, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  load_project_tree(&conn, &project_id)
}

#[tauri::command]
pub fn get_drawing_bom(state: State<AppState>, drawing_id: String) -> Result<Vec<BomLineDto>, String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  load_drawing_bom(&conn, &drawing_id)
}

#[tauri::command]
pub fn reset_demo_data(state: State<AppState>) -> Result<(), String> {
  let conn = state.db.lock().map_err(|e| e.to_string())?;
  conn
    .execute_batch(
      "DELETE FROM production_order_lines;
       DELETE FROM production_orders;
       DELETE FROM bom_lines;
       DELETE FROM busbar_placements;
       DELETE FROM panel_busbar_sections;
       DELETE FROM panel_busbar_configs;
       DELETE FROM wire_segments;
       DELETE FROM nets;
       DELETE FROM cross_references;
       DELETE FROM symbol_placements;
       DELETE FROM contact_instances;
       DELETE FROM device_instances;
       DELETE FROM panel_sheets;
       DELETE FROM panel_instances;
       DELETE FROM panel_designs;
       DELETE FROM drawing_revisions;
       DELETE FROM drawings;
       DELETE FROM project_activity;
       DELETE FROM project_catalog_overrides;
       DELETE FROM projects;",
    )
    .map_err(|e| e.to_string())?;
  crate::db::seed_demo(&conn)
}

fn load_project_tree(conn: &Connection, project_id: &str) -> Result<ProjectTree, String> {
  let project = conn
    .query_row(
      "SELECT id, name, code, customer, status, symbol_standard, busbar_rating_standard
       FROM projects WHERE id = ?1",
      [project_id],
      |row| {
        Ok(ProjectSummary {
          id: row.get(0)?,
          name: row.get(1)?,
          code: row.get(2)?,
          customer: row.get(3)?,
          status: row.get(4)?,
          symbol_standard: row.get(5)?,
          busbar_rating_standard: row.get(6)?,
        })
      },
    )
    .map_err(|e| e.to_string())?;

  let mut drawing_stmt = conn
    .prepare(
      "SELECT id, drawing_no, title, revision, status
       FROM drawings WHERE project_id = ?1 ORDER BY sort_order, drawing_no",
    )
    .map_err(|e| e.to_string())?;

  let drawing_rows = drawing_stmt
    .query_map([project_id], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, Option<String>>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
      ))
    })
    .map_err(|e| e.to_string())?;

  let mut drawings = Vec::new();
  for row in drawing_rows {
    let (id, drawing_no, title, revision, status) = row.map_err(|e| e.to_string())?;
    let panels = load_panels(conn, &id)?;
    drawings.push(DrawingNode {
      id,
      drawing_no,
      title,
      revision,
      status,
      panels,
    });
  }

  Ok(ProjectTree { project, drawings })
}

fn load_panels(conn: &Connection, drawing_id: &str) -> Result<Vec<PanelDesignNode>, String> {
  let mut panel_stmt = conn
    .prepare(
      "SELECT id, panel_code, name, production_qty, sheet_prefix
       FROM panel_designs WHERE drawing_id = ?1 ORDER BY sort_order, panel_code",
    )
    .map_err(|e| e.to_string())?;

  let panel_rows = panel_stmt
    .query_map([drawing_id], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, Option<String>>(2)?,
        row.get::<_, i64>(3)?,
        row.get::<_, Option<String>>(4)?,
      ))
    })
    .map_err(|e| e.to_string())?;

  let mut panels = Vec::new();
  for row in panel_rows {
    let (id, panel_code, name, production_qty, sheet_prefix) = row.map_err(|e| e.to_string())?;
    let sheets = load_sheets(conn, &id)?;
    let instances = load_instances(conn, &id)?;
    let busbar_sections = load_busbar_sections(conn, &id)?;
    panels.push(PanelDesignNode {
      id,
      panel_code,
      name,
      production_qty,
      sheet_prefix,
      sheets,
      instances,
      busbar_sections,
    });
  }
  Ok(panels)
}

fn load_sheets(conn: &Connection, panel_design_id: &str) -> Result<Vec<SheetNode>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, sheet_no, display_name, title
       FROM panel_sheets WHERE panel_design_id = ?1 ORDER BY sort_order, sheet_no",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([panel_design_id], |row| {
      Ok(SheetNode {
        id: row.get(0)?,
        sheet_no: row.get(1)?,
        display_name: row.get(2)?,
        title: row.get(3)?,
      })
    })
    .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_instances(conn: &Connection, panel_design_id: &str) -> Result<Vec<PanelInstanceNode>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, instance_no, asset_tag, serial_no, status
       FROM panel_instances WHERE panel_design_id = ?1 ORDER BY instance_no",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([panel_design_id], |row| {
      Ok(PanelInstanceNode {
        id: row.get(0)?,
        instance_no: row.get(1)?,
        asset_tag: row.get(2)?,
        serial_no: row.get(3)?,
        status: row.get(4)?,
      })
    })
    .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_busbar_sections(conn: &Connection, panel_design_id: &str) -> Result<Vec<BusbarSectionNode>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT s.id, s.section_role, s.feeder_tag, sz.label, r.rated_current_a, r.icw_ka,
              s.bars_per_phase, s.length_mm
       FROM panel_busbar_sections s
       JOIN panel_busbar_configs c ON c.id = s.config_id
       JOIN busbar_ratings r ON r.id = s.rating_id
       JOIN busbar_sizes sz ON sz.id = r.size_id
       WHERE c.panel_design_id = ?1
       ORDER BY s.sort_order",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([panel_design_id], |row| {
      Ok(BusbarSectionNode {
        id: row.get(0)?,
        section_role: row.get(1)?,
        feeder_tag: row.get(2)?,
        size_label: row.get(3)?,
        rated_current_a: row.get(4)?,
        icw_ka: row.get(5)?,
        bars_per_phase: row.get(6)?,
        length_mm: row.get(7)?,
      })
    })
    .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn load_drawing_bom(conn: &Connection, drawing_id: &str) -> Result<Vec<BomLineDto>, String> {
  // busbar BOM derived from panel busbar sections × production_qty
  let mut stmt = conn
    .prepare(
      "SELECT pd.panel_code, sz.label, r.rated_current_a, s.bars_per_phase, s.length_mm,
              pd.production_qty,
              (s.bars_per_phase * 4 * pd.production_qty) AS total_bars
       FROM panel_busbar_sections s
       JOIN panel_busbar_configs c ON c.id = s.config_id
       JOIN panel_designs pd ON pd.id = c.panel_design_id
       JOIN busbar_ratings r ON r.id = s.rating_id
       JOIN busbar_sizes sz ON sz.id = r.size_id
       WHERE pd.drawing_id = ?1
       ORDER BY pd.sort_order, s.sort_order",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([drawing_id], |row| {
      let panel_code: String = row.get(0)?;
      let size_label: String = row.get(1)?;
      let rated_current_a: i64 = row.get(2)?;
      let bars_per_phase: i64 = row.get(3)?;
      let length_mm: f64 = row.get(4)?;
      let panel_qty: i64 = row.get(5)?;
      let total_bars: f64 = row.get(6)?;
      let qty_per_panel = (bars_per_phase * 4) as f64;
      Ok(BomLineDto {
        part_number: format!("BB-{size_label}-Cu"),
        description: Some(format!(
          "Busbar {size_label} {rated_current_a}A L={length_mm:.0}mm ({bars_per_phase} bar/phase)"
        )),
        panel_code,
        qty_per_panel,
        panel_qty,
        total_qty: total_bars,
        unit: "bar".into(),
      })
    })
    .map_err(|e| e.to_string())?;

  rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
