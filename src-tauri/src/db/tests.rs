#[cfg(test)]
mod tests {
  use crate::db::migrate::run_migrations;
  use sqlx::postgres::PgPoolOptions;
  use std::env;

  #[tokio::test]
  async fn postgres_integration_smoke() {
    let url = env::var("TANON_DATABASE_URL").unwrap_or_else(|_| {
      "postgresql://tanon:tanon_secret@localhost:5432/tanon".into()
    });
    let pool = PgPoolOptions::new()
      .max_connections(5)
      .connect(&url)
      .await
      .expect("connect postgres — start DB server first");

    run_migrations(&pool).await.expect("migrations");
    run_migrations(&pool).await.expect("idempotent migrations");

    let sheet_type: String = sqlx::query_scalar(
      "SELECT sheet_type FROM panel_sheets WHERE id = 'sh-a01'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(sheet_type, "single_line");

    let json: String = sqlx::query_scalar(
      "SELECT content_json::text FROM panel_sheets WHERE id = 'sh-a01'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(json.contains("1SDA068337R1") || json.contains("ABB"));

    let abb_count: i64 = sqlx::query_scalar(
      "SELECT COUNT(*)::bigint FROM catalog_items WHERE manufacturer = 'ABB'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(abb_count >= 5);

    let name: String = sqlx::query_scalar("SELECT name FROM projects WHERE id = 'proj-e22'")
      .fetch_one(&pool)
      .await
      .unwrap();
    assert_eq!(name, "E22 Factory");

    let panel_count: i64 = sqlx::query_scalar(
      "SELECT COUNT(*)::bigint FROM panel_designs WHERE drawing_id = 'drw-e22-111'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(panel_count, 2);

    let qty: i32 = sqlx::query_scalar(
      "SELECT production_qty FROM panel_designs WHERE id = 'panel-db'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(qty, 10);

    let project_count: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM projects")
      .fetch_one(&pool)
      .await
      .unwrap();
    assert_eq!(project_count, 1);
  }
}
