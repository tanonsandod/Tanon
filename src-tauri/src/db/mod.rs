use rusqlite::{Connection, OpenFlags};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("tanon.db"))
}

pub fn open_connection(path: &PathBuf) -> Result<Connection, String> {
  let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
  let conn = Connection::open_with_flags(path, flags).map_err(|e| e.to_string())?;
  conn.execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|e| e.to_string())?;
  Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(
      "CREATE TABLE IF NOT EXISTS schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL DEFAULT (datetime('now'))
       );",
    )
    .map_err(|e| e.to_string())?;

  let migrations: [(&str, &str); 5] = [
    ("001_initial", include_str!("../../migrations/001_initial.sql")),
    ("002_seed_e22", include_str!("../../migrations/002_seed_e22.sql")),
    ("003_sheet_type", include_str!("../../migrations/003_sheet_type.sql")),
    ("004_sld_catalog", include_str!("../../migrations/004_sld_catalog.sql")),
    ("005_abb_catalog", include_str!("../../migrations/005_abb_catalog.sql")),
  ];

  for (version, sql) in migrations {
    let applied: bool = conn
      .query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
        [version],
        |row| row.get::<_, i64>(0),
      )
      .map(|c| c > 0)
      .map_err(|e| e.to_string())?;

    if applied {
      continue;
    }

    conn
      .execute_batch(sql)
      .map_err(|e| format!("migration {version} failed: {e}"))?;

    conn
      .execute(
        "INSERT INTO schema_migrations (version) VALUES (?1)",
        [version],
      )
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

pub fn seed_count(conn: &Connection) -> Result<i64, String> {
  conn
    .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
    .map_err(|e| e.to_string())
}

pub fn seed_demo(conn: &Connection) -> Result<(), String> {
  if seed_count(conn)? > 0 {
    return Ok(());
  }
  conn
    .execute_batch(include_str!("../../migrations/002_seed_e22.sql"))
    .map_err(|e| format!("seed failed: {e}"))?;
  Ok(())
}

pub fn init_database(app: &AppHandle) -> Result<Connection, String> {
  let path = db_path(app)?;
  let conn = open_connection(&path)?;
  run_migrations(&conn)?;
  seed_demo(&conn)?;
  Ok(conn)
}

#[cfg(test)]
mod tests;
