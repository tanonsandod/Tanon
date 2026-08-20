#[cfg(test)]
mod tests {
  use crate::db::run_migrations;
  use rusqlite::Connection;

  fn mem_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    conn
      .execute_batch(include_str!("../../migrations/001_initial.sql"))
      .unwrap();
    conn
      .execute_batch(include_str!("../../migrations/002_seed_e22.sql"))
      .unwrap();
    conn
  }

  #[test]
  fn migrations_are_idempotent() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&conn).unwrap();
    run_migrations(&conn).unwrap();
    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
      .unwrap();
    assert_eq!(count, 1);
  }

  #[test]
  fn seed_creates_e22_project() {
    let conn = mem_db();
    let name: String = conn
      .query_row("SELECT name FROM projects WHERE id = 'proj-e22'", [], |r| r.get(0))
      .unwrap();
    assert_eq!(name, "E22 Factory");
  }

  #[test]
  fn drawing_has_two_panels() {
    let conn = mem_db();
    let count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM panel_designs WHERE drawing_id = 'drw-e22-111'",
        [],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(count, 2);
  }

  #[test]
  fn db_panel_has_production_qty_10() {
    let conn = mem_db();
    let qty: i64 = conn
      .query_row(
        "SELECT production_qty FROM panel_designs WHERE id = 'panel-db'",
        [],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(qty, 10);
  }
}
