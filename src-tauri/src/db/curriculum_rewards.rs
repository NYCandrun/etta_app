use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumReward {
    pub id: i64,
    pub reward_type: String,
    pub entity_id: String,
    pub xp_awarded: i64,
    pub awarded_at: String,
}

/// Check if a specific milestone reward has already been awarded.
pub fn has_reward(conn: &Connection, reward_type: &str, entity_id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM curriculum_rewards WHERE reward_type = ?1 AND entity_id = ?2",
        params![reward_type, entity_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Record a curriculum milestone reward. Returns false if already awarded (idempotent).
pub fn award_reward(
    conn: &Connection,
    reward_type: &str,
    entity_id: &str,
    xp: i64,
) -> Result<bool> {
    let now = chrono::Utc::now().to_rfc3339();
    let inserted = conn.execute(
        "INSERT OR IGNORE INTO curriculum_rewards (reward_type, entity_id, xp_awarded, awarded_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![reward_type, entity_id, xp, now],
    )?;
    Ok(inserted > 0)
}

/// Get all awarded curriculum rewards.
pub fn get_all_rewards(conn: &Connection) -> Result<Vec<CurriculumReward>> {
    let mut stmt = conn.prepare(
        "SELECT id, reward_type, entity_id, xp_awarded, awarded_at
         FROM curriculum_rewards ORDER BY awarded_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CurriculumReward {
            id: row.get(0)?,
            reward_type: row.get(1)?,
            entity_id: row.get(2)?,
            xp_awarded: row.get(3)?,
            awarded_at: row.get(4)?,
        })
    })?;

    let mut rewards = Vec::new();
    for row in rows {
        rewards.push(row?);
    }
    Ok(rewards)
}
