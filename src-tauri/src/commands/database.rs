use crate::db::{
  connect_pool, database_status, load_config, save_config, DatabaseConfig,
  DatabaseConfigDto, DatabaseStatusDto,
};
use crate::db::AppState;
use tauri::{AppHandle, State};

#[derive(serde::Deserialize)]
pub struct SaveDatabaseConfigInput {
  pub host: String,
  pub port: u16,
  pub database: String,
  pub username: String,
  pub password: Option<String>,
}

#[tauri::command]
pub async fn get_database_config(app: AppHandle) -> Result<DatabaseConfigDto, String> {
  Ok(load_config(&app).database.to_dto())
}

#[tauri::command]
pub async fn get_database_status(state: State<'_, AppState>) -> Result<DatabaseStatusDto, String> {
  Ok(database_status(&state.pool).await)
}

#[tauri::command]
pub async fn test_database_connection(
  input: SaveDatabaseConfigInput,
) -> Result<DatabaseStatusDto, String> {
  let cfg = DatabaseConfig {
    host: Some(input.host),
    port: Some(input.port),
    database: Some(input.database),
    username: Some(input.username),
    password: input.password,
    url: None,
  };
  let pool = connect_pool(&cfg.connection_url()?).await?;
  Ok(database_status(&pool).await)
}

#[tauri::command]
pub async fn save_database_config(
  app: AppHandle,
  input: SaveDatabaseConfigInput,
) -> Result<DatabaseStatusDto, String> {
  let mut current = load_config(&app);
  current.database.host = Some(input.host);
  current.database.port = Some(input.port);
  current.database.database = Some(input.database);
  current.database.username = Some(input.username);
  current.database.url = None;
  if let Some(password) = input.password {
    if !password.is_empty() {
      current.database.password = Some(password);
    }
  }
  save_config(&app, &current)?;

  let pool = connect_pool(&current.database.connection_url()?).await?;
  Ok(database_status(&pool).await)
}
