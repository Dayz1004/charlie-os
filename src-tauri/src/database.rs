use crate::domain::{AppError, Result};
use rusqlite::{Connection, TransactionBehavior};
use std::{path::Path, time::Duration};

pub const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../migrations/001_tasks.sql")),
    (2, include_str!("../migrations/002_dependencies.sql")),
];

pub fn open(path: &Path) -> Result<Connection> {
    let mut connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    migrate(&mut connection, MIGRATIONS)?;
    Ok(connection)
}

pub fn migrate(connection: &mut Connection, migrations: &[(i64, &str)]) -> Result<()> {
    // DDL and ledger updates commit together; no partial schema on failure.
    let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    tx.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, sql TEXT NOT NULL);")?;
    let applied = {
        let mut statement =
            tx.prepare("SELECT version, sql FROM schema_migrations ORDER BY version")?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    for (index, (version, sql)) in applied.iter().enumerate() {
        if migrations.get(index).is_none_or(|(v, source)| {
            v != version || source.replace("\r\n", "\n") != sql.replace("\r\n", "\n")
        }) {
            return Err(AppError::conflict("Database migration history is newer than this app or has changed. No data was modified."));
        }
    }
    for (index, (version, sql)) in migrations.iter().enumerate().skip(applied.len()) {
        if *version != index as i64 + 1 {
            return Err(AppError::validation(
                "Migrations must be consecutively numbered.",
            ));
        }
        tx.execute_batch(sql)?;
        tx.execute(
            "INSERT INTO schema_migrations(version, sql) VALUES (?1, ?2)",
            (version, sql),
        )?;
        eprintln!("Applied local database migration {version}");
    }
    tx.commit()?;
    Ok(())
}
