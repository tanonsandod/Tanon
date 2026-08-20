mod db;
mod models;
mod commands;
mod sld;

use db::{init_database, AppState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      let handle = app.handle().clone();
      tauri::async_runtime::block_on(async move {
        let pool = init_database(&handle).await?;
        handle.manage(AppState { pool });
        Ok::<(), String>(())
      })
      .map_err(|e| e.to_string())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::list_projects,
      commands::get_project_tree,
      commands::get_drawing_bom,
      commands::reset_demo_data,
      commands::get_schematic_sheet,
      commands::get_panel_entry_sheet,
      commands::save_sld_content,
      commands::complete_sld,
      commands::list_sld_palette,
      commands::list_catalog_items,
      commands::get_database_config,
      commands::get_database_status,
      commands::test_database_connection,
      commands::save_database_config,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
