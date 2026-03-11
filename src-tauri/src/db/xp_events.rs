use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XpEvent {
    pub id: i64,
    pub amount: i64,
    pub source: String,
    pub description: String,
    pub created_at: String,
}

/// Maximum number of XP events to retain. Older events are pruned after each insert
/// to prevent unbounded table growth over years of use.
const MAX_XP_EVENTS: i64 = 2000;

/// Insert a new XP event. Returns the new row id.
/// Prunes oldest events beyond MAX_XP_EVENTS to prevent long-term DB bloat.
pub fn insert_xp_event(
    conn: &Connection,
    amount: i64,
    source: &str,
    description: &str,
) -> Result<i64> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO xp_events (amount, source, description, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![amount, source, description, now],
    )?;
    let id = conn.last_insert_rowid();

    // Prune oldest events beyond the retention cap
    conn.execute(
        "DELETE FROM xp_events WHERE id NOT IN (
            SELECT id FROM xp_events ORDER BY created_at DESC LIMIT ?1
        )",
        params![MAX_XP_EVENTS],
    )?;

    Ok(id)
}

/// Get the most recent XP events (up to `limit`).
pub fn get_recent_xp_events(conn: &Connection, limit: i64) -> Result<Vec<XpEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, amount, source, description, created_at
         FROM xp_events ORDER BY created_at DESC LIMIT ?1",
    )?;

    let rows = stmt.query_map(params![limit], |row| {
        Ok(XpEvent {
            id: row.get(0)?,
            amount: row.get(1)?,
            source: row.get(2)?,
            description: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

/// Get all XP events (for data export).
pub fn get_all_xp_events(conn: &Connection) -> Result<Vec<XpEvent>> {
    get_recent_xp_events(conn, i64::MAX)
}
