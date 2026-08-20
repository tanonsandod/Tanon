mod config;
mod migrate;

pub use config::{
  load_config, save_config, DatabaseConfig, DatabaseConfigDto, DatabaseStatusDto,
};

use migrate::{run_migrations, seed_count};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tauri::AppHandle;

pub struct AppState {
  pub pool: PgPool,
}

pub async fn connect_pool(database_url: &str) -> Result<PgPool, String> {
  PgPoolOptions::new()
    .max_connections(8)
    .connect(database_url)
    .await
    .map_err(|e| format!("เชื่อมต่อ DB ไม่ได้: {e}"))
}

pub async fn init_database(app: &AppHandle) -> Result<PgPool, String> {
  let cfg = load_config(app);
  let url = cfg.database.connection_url()?;
  let pool = connect_pool(&url).await?;
  run_migrations(&pool).await?;
  Ok(pool)
}

pub async fn database_status(pool: &PgPool) -> DatabaseStatusDto {
  match sqlx::query_scalar::<_, String>("SELECT version()")
    .fetch_one(pool)
    .await
  {
    Ok(version) => {
      let project_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::bigint FROM projects")
        .fetch_one(pool)
        .await
        .ok();
      DatabaseStatusDto {
        connected: true,
        server_version: Some(version),
        project_count,
        error: None,
      }
    }
    Err(e) => DatabaseStatusDto {
      connected: false,
      server_version: None,
      project_count: None,
      error: Some(e.to_string()),
    },
  }
}

pub async fn reset_demo_data(pool: &PgPool) -> Result<(), String> {
  let sql = "DELETE FROM production_order_lines;
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
DELETE FROM projects;";
  sqlx::raw_sql(sql)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

  if seed_count(pool).await? > 0 {
    return Ok(());
  }

  sqlx::raw_sql(include_str!("../../migrations/postgres/002_seed_e22.sql"))
    .execute(pool)
    .await
    .map_err(|e| format!("seed failed: {e}"))?;
  sqlx::raw_sql(include_str!("../../migrations/postgres/003_sld_catalog.sql"))
    .execute(pool)
    .await
    .map_err(|e| format!("sld catalog seed failed: {e}"))?;
  sqlx::raw_sql(include_str!("../../migrations/postgres/004_abb_catalog.sql"))
    .execute(pool)
    .await
    .map_err(|e| format!("abb catalog seed failed: {e}"))?;
  Ok(())
}

#[cfg(test)]
mod tests;
