use sqlx::PgPool;

const MIGRATIONS: [(&str, &str); 4] = [
  ("001_schema", include_str!("../../migrations/postgres/001_schema.sql")),
  (
    "002_seed_e22",
    include_str!("../../migrations/postgres/002_seed_e22.sql"),
  ),
  (
    "003_sld_catalog",
    include_str!("../../migrations/postgres/003_sld_catalog.sql"),
  ),
  (
    "004_abb_catalog",
    include_str!("../../migrations/postgres/004_abb_catalog.sql"),
  ),
];

pub async fn run_migrations(pool: &PgPool) -> Result<(), String> {
  sqlx::query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
     )",
  )
  .execute(pool)
  .await
  .map_err(|e| e.to_string())?;

  for (version, sql) in MIGRATIONS {
    let applied: bool = sqlx::query_scalar(
      "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)",
    )
    .bind(version)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    if applied {
      continue;
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::raw_sql(sql)
      .execute(&mut *tx)
      .await
      .map_err(|e| format!("migration {version} failed: {e}"))?;
    sqlx::query("INSERT INTO schema_migrations (version) VALUES ($1)")
      .bind(version)
      .execute(&mut *tx)
      .await
      .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
  }

  Ok(())
}

pub async fn seed_count(pool: &PgPool) -> Result<i64, String> {
  sqlx::query_scalar("SELECT COUNT(*)::bigint FROM projects")
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
