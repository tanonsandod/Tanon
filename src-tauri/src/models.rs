use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
  pub id: String,
  pub name: String,
  pub code: Option<String>,
  pub customer: Option<String>,
  pub status: String,
  pub symbol_standard: String,
  pub busbar_rating_standard: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PanelInstanceNode {
  pub id: String,
  pub instance_no: i64,
  pub asset_tag: Option<String>,
  pub serial_no: Option<String>,
  pub status: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SheetNode {
  pub id: String,
  pub sheet_no: String,
  pub display_name: String,
  pub title: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BusbarSectionNode {
  pub id: String,
  pub section_role: String,
  pub feeder_tag: Option<String>,
  pub size_label: String,
  pub rated_current_a: i64,
  pub icw_ka: Option<f64>,
  pub bars_per_phase: i64,
  pub length_mm: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PanelDesignNode {
  pub id: String,
  pub panel_code: String,
  pub name: Option<String>,
  pub production_qty: i64,
  pub sheet_prefix: Option<String>,
  pub sheets: Vec<SheetNode>,
  pub instances: Vec<PanelInstanceNode>,
  pub busbar_sections: Vec<BusbarSectionNode>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DrawingNode {
  pub id: String,
  pub drawing_no: String,
  pub title: Option<String>,
  pub revision: String,
  pub status: String,
  pub panels: Vec<PanelDesignNode>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTree {
  pub project: ProjectSummary,
  pub drawings: Vec<DrawingNode>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BomLineDto {
  pub part_number: String,
  pub description: Option<String>,
  pub panel_code: String,
  pub qty_per_panel: f64,
  pub panel_qty: i64,
  pub total_qty: f64,
  pub unit: String,
}
