use rusqlite::{params, Connection, Result};

/// Get a setting value by key. Returns None if not found.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    match rows.next()? {
        Some(row) => {
            let value: String = row.get(0)?;
            Ok(Some(value))
        }
        None => Ok(None),
    }
}

/// Set a setting value, inserting or replacing as needed.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

/// Get all settings as key-value pairs.
pub fn get_all_settings(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut settings = Vec::new();
    for row in rows {
        settings.push(row?);
    }
    Ok(settings)
}
