use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterySnapshot {
    pub date: String,
    pub domain: String,
    pub score: f64,
}

/// Record (or update) today's mastery snapshot for a domain.
/// Uses INSERT OR REPLACE so only one row per (date, domain).
pub fn upsert_snapshot(conn: &Connection, date: &str, domain: &str, score: f64) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO mastery_snapshots (date, domain, score) VALUES (?1, ?2, ?3)",
        params![date, domain, score],
    )?;
    Ok(())
}

/// Get snapshots within a date window, ordered by date then domain.
/// If `since_date` is None, returns the last 90 days by default to avoid
/// sending unbounded data to the frontend after years of use.
pub fn get_snapshots_since(conn: &Connection, since_date: Option<&str>) -> Result<Vec<MasterySnapshot>> {
    let default_since = chrono::Local::now()
        .checked_sub_signed(chrono::Duration::days(90))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();
    let since = since_date.unwrap_or(&default_since);

    let mut stmt = conn.prepare(
        "SELECT date, domain, score FROM mastery_snapshots
         WHERE date >= ?1
         ORDER BY date ASC, domain ASC",
    )?;
    let rows = stmt.query_map(params![since], |row| {
        Ok(MasterySnapshot {
            date: row.get(0)?,
            domain: row.get(1)?,
            score: row.get(2)?,
        })
    })?;
    let mut snapshots = Vec::new();
    for row in rows {
        snapshots.push(row?);
    }
    Ok(snapshots)
}

/// Get all snapshots (for data export only — not for routine display).
pub fn get_all_snapshots(conn: &Connection) -> Result<Vec<MasterySnapshot>> {
    let mut stmt = conn.prepare(
        "SELECT date, domain, score FROM mastery_snapshots ORDER BY date ASC, domain ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(MasterySnapshot {
            date: row.get(0)?,
            domain: row.get(1)?,
            score: row.get(2)?,
        })
    })?;
    let mut snapshots = Vec::new();
    for row in rows {
        snapshots.push(row?);
    }
    Ok(snapshots)
}
