use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SldDevice {
  pub id: String,
  pub symbol_type: String,
  pub tag: String,
  pub rating: Option<String>,
  pub catalog_item_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SldFeeder {
  pub id: String,
  pub busbar_section_id: Option<String>,
  pub tag: String,
  pub rated_current_a: Option<i64>,
  pub size_label: Option<String>,
  pub devices: Vec<SldDevice>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SldContent {
  pub version: i32,
  pub incoming_label: Option<String>,
  pub incoming_voltage: Option<String>,
  pub feeders: Vec<SldFeeder>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SldPaletteItemDto {
  pub symbol_type: String,
  pub label: String,
  pub label_th: String,
  pub default_tag_prefix: String,
  pub iec_ref: Option<String>,
}
