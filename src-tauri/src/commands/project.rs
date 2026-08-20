use crate::db::AppState;
use crate::models::{
  BomLineDto, BusbarSectionNode, DrawingNode, PanelDesignNode, PanelInstanceNode, ProjectSummary,
  ProjectTree, SheetNode,
};
use sqlx::PgPool;
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectSummary>, String> {
  let rows = sqlx::query(
    "SELECT id, name, code, customer, status, symbol_standard, busbar_rating_standard
     FROM projects ORDER BY modified_at DESC",
  )
  .fetch_all(&state.pool)
  .await
  .map_err(|e| e.to_string())?;

  rows.iter().map(map_project_summary).collect()
}

#[tauri::command]
pub async fn get_project_tree(
  state: State<'_, AppState>,
  project_id: String,
) -> Result<ProjectTree, String> {
  load_project_tree(&state.pool, &project_id).await
}

#[tauri::command]
pub async fn get_drawing_bom(
  state: State<'_, AppState>,
  drawing_id: String,
) -> Result<Vec<BomLineDto>, String> {
  load_drawing_bom(&state.pool, &drawing_id).await
}

#[tauri::command]
pub async fn reset_demo_data(state: State<'_, AppState>) -> Result<(), String> {
  crate::db::reset_demo_data(&state.pool).await
}

fn map_project_summary(row: &sqlx::postgres::PgRow) -> Result<ProjectSummary, String> {
  Ok(ProjectSummary {
    id: row.try_get("id").map_err(|e| e.to_string())?,
    name: row.try_get("name").map_err(|e| e.to_string())?,
    code: row.try_get("code").map_err(|e| e.to_string())?,
    customer: row.try_get("customer").map_err(|e| e.to_string())?,
    status: row.try_get("status").map_err(|e| e.to_string())?,
    symbol_standard: row.try_get("symbol_standard").map_err(|e| e.to_string())?,
    busbar_rating_standard: row
      .try_get("busbar_rating_standard")
      .map_err(|e| e.to_string())?,
  })
}

async fn load_project_tree(pool: &PgPool, project_id: &str) -> Result<ProjectTree, String> {
  let project_row = sqlx::query(
    "SELECT id, name, code, customer, status, symbol_standard, busbar_rating_standard
     FROM projects WHERE id = $1",
  )
  .bind(project_id)
  .fetch_optional(pool)
  .await
  .map_err(|e| e.to_string())?
  .ok_or_else(|| format!("project not found: {project_id}"))?;

  let project = map_project_summary(&project_row)?;

  let drawing_rows = sqlx::query(
    "SELECT id, drawing_no, title, revision, status
     FROM drawings WHERE project_id = $1 ORDER BY sort_order, drawing_no",
  )
  .bind(project_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  let mut drawings = Vec::new();
  for row in drawing_rows {
    let id: String = row.try_get("id").map_err(|e| e.to_string())?;
    let panels = load_panels(pool, &id).await?;
    drawings.push(DrawingNode {
      id,
      drawing_no: row.try_get("drawing_no").map_err(|e| e.to_string())?,
      title: row.try_get("title").map_err(|e| e.to_string())?,
      revision: row.try_get("revision").map_err(|e| e.to_string())?,
      status: row.try_get("status").map_err(|e| e.to_string())?,
      panels,
    });
  }

  Ok(ProjectTree { project, drawings })
}

async fn load_panels(pool: &PgPool, drawing_id: &str) -> Result<Vec<PanelDesignNode>, String> {
  let panel_rows = sqlx::query(
    "SELECT id, panel_code, name, production_qty::bigint AS production_qty, sheet_prefix
     FROM panel_designs WHERE drawing_id = $1 ORDER BY sort_order, panel_code",
  )
  .bind(drawing_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  let mut panels = Vec::new();
  for row in panel_rows {
    let id: String = row.try_get("id").map_err(|e| e.to_string())?;
    panels.push(PanelDesignNode {
      id: id.clone(),
      panel_code: row.try_get("panel_code").map_err(|e| e.to_string())?,
      name: row.try_get("name").map_err(|e| e.to_string())?,
      production_qty: row.try_get("production_qty").map_err(|e| e.to_string())?,
      sheet_prefix: row.try_get("sheet_prefix").map_err(|e| e.to_string())?,
      sheets: load_sheets(pool, &id).await?,
      instances: load_instances(pool, &id).await?,
      busbar_sections: load_busbar_sections(pool, &id).await?,
    });
  }
  Ok(panels)
}

async fn load_sheets(pool: &PgPool, panel_design_id: &str) -> Result<Vec<SheetNode>, String> {
  let rows = sqlx::query(
    "SELECT id, sheet_no, display_name, title,
            COALESCE(sheet_type, 'detail') AS sheet_type, sort_order::bigint AS sort_order,
            COALESCE(schematic_status, 'empty') AS schematic_status
     FROM panel_sheets WHERE panel_design_id = $1 ORDER BY sort_order, sheet_no",
  )
  .bind(panel_design_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  rows
    .iter()
    .map(|row| {
      Ok(SheetNode {
        id: row.try_get("id").map_err(|e| e.to_string())?,
        sheet_no: row.try_get("sheet_no").map_err(|e| e.to_string())?,
        display_name: row.try_get("display_name").map_err(|e| e.to_string())?,
        title: row.try_get("title").map_err(|e| e.to_string())?,
        sheet_type: row.try_get("sheet_type").map_err(|e| e.to_string())?,
        sort_order: row.try_get("sort_order").map_err(|e| e.to_string())?,
        schematic_status: row.try_get("schematic_status").map_err(|e| e.to_string())?,
      })
    })
    .collect()
}

async fn load_instances(
  pool: &PgPool,
  panel_design_id: &str,
) -> Result<Vec<PanelInstanceNode>, String> {
  let rows = sqlx::query(
    "SELECT id, instance_no::bigint AS instance_no, asset_tag, serial_no, status
     FROM panel_instances WHERE panel_design_id = $1 ORDER BY instance_no",
  )
  .bind(panel_design_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  rows
    .iter()
    .map(|row| {
      Ok(PanelInstanceNode {
        id: row.try_get("id").map_err(|e| e.to_string())?,
        instance_no: row.try_get("instance_no").map_err(|e| e.to_string())?,
        asset_tag: row.try_get("asset_tag").map_err(|e| e.to_string())?,
        serial_no: row.try_get("serial_no").map_err(|e| e.to_string())?,
        status: row.try_get("status").map_err(|e| e.to_string())?,
      })
    })
    .collect()
}

pub async fn load_busbar_sections(
  pool: &PgPool,
  panel_design_id: &str,
) -> Result<Vec<BusbarSectionNode>, String> {
  let rows = sqlx::query(
    "SELECT s.id, s.section_role, s.feeder_tag, sz.label, r.rated_current_a::bigint AS rated_current_a, r.icw_ka,
            s.bars_per_phase::bigint AS bars_per_phase, s.length_mm
     FROM panel_busbar_sections s
     JOIN panel_busbar_configs c ON c.id = s.config_id
     JOIN busbar_ratings r ON r.id = s.rating_id
     JOIN busbar_sizes sz ON sz.id = r.size_id
     WHERE c.panel_design_id = $1
     ORDER BY s.sort_order",
  )
  .bind(panel_design_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  rows
    .iter()
    .map(|row| {
      Ok(BusbarSectionNode {
        id: row.try_get("id").map_err(|e| e.to_string())?,
        section_role: row.try_get("section_role").map_err(|e| e.to_string())?,
        feeder_tag: row.try_get("feeder_tag").map_err(|e| e.to_string())?,
        size_label: row.try_get("label").map_err(|e| e.to_string())?,
        rated_current_a: row.try_get("rated_current_a").map_err(|e| e.to_string())?,
        icw_ka: row.try_get("icw_ka").map_err(|e| e.to_string())?,
        bars_per_phase: row.try_get("bars_per_phase").map_err(|e| e.to_string())?,
        length_mm: row.try_get("length_mm").map_err(|e| e.to_string())?,
      })
    })
    .collect()
}

async fn load_drawing_bom(pool: &PgPool, drawing_id: &str) -> Result<Vec<BomLineDto>, String> {
  let rows = sqlx::query(
    "SELECT pd.panel_code, sz.label, r.rated_current_a::bigint AS rated_current_a,
            s.bars_per_phase::bigint AS bars_per_phase, s.length_mm,
            pd.production_qty::bigint AS production_qty,
            (s.bars_per_phase * 4 * pd.production_qty)::float8 AS total_bars
     FROM panel_busbar_sections s
     JOIN panel_busbar_configs c ON c.id = s.config_id
     JOIN panel_designs pd ON pd.id = c.panel_design_id
     JOIN busbar_ratings r ON r.id = s.rating_id
     JOIN busbar_sizes sz ON sz.id = r.size_id
     WHERE pd.drawing_id = $1
     ORDER BY pd.sort_order, s.sort_order",
  )
  .bind(drawing_id)
  .fetch_all(pool)
  .await
  .map_err(|e| e.to_string())?;

  rows
    .iter()
    .map(|row| {
      let panel_code: String = row.try_get("panel_code").map_err(|e| e.to_string())?;
      let size_label: String = row.try_get("label").map_err(|e| e.to_string())?;
      let rated_current_a: i64 = row.try_get("rated_current_a").map_err(|e| e.to_string())?;
      let bars_per_phase: i64 = row.try_get("bars_per_phase").map_err(|e| e.to_string())?;
      let length_mm: f64 = row.try_get("length_mm").map_err(|e| e.to_string())?;
      let panel_qty: i64 = row.try_get("production_qty").map_err(|e| e.to_string())?;
      let total_bars: f64 = row.try_get("total_bars").map_err(|e| e.to_string())?;
      let qty_per_panel = bars_per_phase as f64 * 4.0;
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
    .collect()
}
