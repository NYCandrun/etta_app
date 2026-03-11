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

/// Get all snapshots, ordered by date then domain.
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
