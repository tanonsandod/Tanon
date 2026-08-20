use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DatabaseConfig {
  #[serde(default)]
  pub url: Option<String>,
  #[serde(default)]
  pub host: Option<String>,
  #[serde(default)]
  pub port: Option<u16>,
  #[serde(default)]
  pub database: Option<String>,
  #[serde(default)]
  pub username: Option<String>,
  #[serde(default)]
  pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
  pub database: DatabaseConfig,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      database: DatabaseConfig {
        host: Some("localhost".into()),
        port: Some(5432),
        database: Some("tanon".into()),
        username: Some("tanon".into()),
        password: Some("tanon_secret".into()),
        url: None,
      },
    }
  }
}

#[derive(Debug, Clone, Serialize)]
pub struct DatabaseConfigDto {
  pub host: String,
  pub port: u16,
  pub database: String,
  pub username: String,
  /// Empty when password is stored but hidden from UI.
  pub password_set: bool,
  pub url_override: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DatabaseStatusDto {
  pub connected: bool,
  pub server_version: Option<String>,
  pub project_count: Option<i64>,
  pub error: Option<String>,
}

impl DatabaseConfig {
  pub fn connection_url(&self) -> Result<String, String> {
    if let Some(url) = &self.url {
      if !url.trim().is_empty() {
        return Ok(url.trim().to_string());
      }
    }
    let host = self.host.as_deref().unwrap_or("localhost");
    let port = self.port.unwrap_or(5432);
    let database = self.database.as_deref().unwrap_or("tanon");
    let username = self.username.as_deref().unwrap_or("tanon");
    let password = self.password.as_deref().unwrap_or("");
    Ok(format!(
      "postgresql://{username}:{password}@{host}:{port}/{database}"
    ))
  }

  pub fn to_dto(&self) -> DatabaseConfigDto {
    DatabaseConfigDto {
      host: self.host.clone().unwrap_or_else(|| "localhost".into()),
      port: self.port.unwrap_or(5432),
      database: self.database.clone().unwrap_or_else(|| "tanon".into()),
      username: self
        .username
        .clone()
        .unwrap_or_else(|| "tanon".into()),
      password_set: self
        .password
        .as_ref()
        .is_some_and(|p| !p.is_empty())
        || self.url.is_some(),
      url_override: self.url.is_some(),
    }
  }
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("config.toml"))
}

pub fn load_config(app: &AppHandle) -> AppConfig {
  if let Ok(url) = std::env::var("TANON_DATABASE_URL") {
    if !url.trim().is_empty() {
      return AppConfig {
        database: DatabaseConfig {
          url: Some(url),
          ..Default::default()
        },
      };
    }
  }

  let path = match config_path(app) {
    Ok(p) => p,
    Err(_) => return AppConfig::default(),
  };

  if !path.exists() {
    return AppConfig::default();
  }

  match fs::read_to_string(&path) {
    Ok(raw) => toml::from_str(&raw).unwrap_or_default(),
    Err(_) => AppConfig::default(),
  }
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
  let path = config_path(app)?;
  let raw = toml::to_string_pretty(config).map_err(|e| e.to_string())?;
  fs::write(path, raw).map_err(|e| e.to_string())
}
