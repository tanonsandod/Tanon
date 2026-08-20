#[cfg(test)]
mod tests {
  use crate::db::run_migrations;
  use rusqlite::Connection;

  fn mem_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    run_migrations(&conn).unwrap();
    conn
  }

  #[test]
  fn entry_sheet_is_single_line() {
    let conn = mem_db();
    let sheet_type: String = conn
      .query_row(
        "SELECT sheet_type FROM panel_sheets WHERE id = 'sh-a01'",
        [],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(sheet_type, "single_line");
  }

  #[test]
  fn mdb1_sld_has_q1_breaker() {
    let conn = mem_db();
    let json: String = conn
      .query_row(
        "SELECT content_json FROM panel_sheets WHERE id = 'sh-a01'",
        [],
        |r| r.get(0),
      )
      .unwrap();
    assert!(json.contains("Q1"));
    assert!(json.contains("mccb"));
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
