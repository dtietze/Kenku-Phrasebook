use rusqlite::{Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::db::schema;

struct Migration {
    version: i64,
    sql: String,  // was &'static str, but we need to concatenate multiple statements for the initial migration using format!()
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            sql: format!( //Removed & because sql is not static anymore due to format!() concatenation
                "{} {} {} {} {}",
                schema::CREATE_SCHEMA_VERSION,
                schema::CREATE_PHRASES,
                schema::CREATE_TAGS,
                schema::CREATE_PHRASE_TAGS,
                schema::CREATE_PHRASE_EMBEDDINGS,
            ),
        },
    ]
}

fn current_version(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

pub fn run(conn: &Connection) -> Result<()> {
    // Bootstrap: schema_version may not exist yet on first run
    conn.execute_batch(schema::CREATE_SCHEMA_VERSION)?;

    let version = current_version(conn);

    for migration in migrations() {
        if migration.version > version {
            conn.execute_batch(&migration.sql)?;
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![migration.version, now_ms()],
            )?;
        }
    }

    Ok(())
}
