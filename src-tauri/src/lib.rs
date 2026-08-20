mod db;
mod models;
mod commands;

use db::{init_database, AppState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      let conn = init_database(&app.handle())?;
      app.manage(AppState {
        db: Mutex::new(conn),
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::list_projects,
      commands::get_project_tree,
      commands::get_drawing_bom,
      commands::reset_demo_data,
      commands::get_schematic_sheet,
      commands::get_panel_entry_sheet,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
