use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedContent {
    pub id: Option<i64>,
    pub concept_id: String,
    pub content_type: String,
    pub payload_json: String,
    pub model_version: Option<String>,
    pub created_at: String,
}

/// Insert a new cache entry. Returns the new row id.
/// Also prunes old entries for the same concept+type to prevent bloat (keeps most recent 3).
pub fn insert_cache_entry(conn: &Connection, entry: &CachedContent) -> Result<i64> {
    conn.execute(
        "INSERT INTO content_cache
         (concept_id, content_type, payload_json, model_version, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            entry.concept_id,
            entry.content_type,
            entry.payload_json,
            entry.model_version,
            entry.created_at,
        ],
    )?;
    let id = conn.last_insert_rowid();

    // Keep only the 3 most recent entries per concept+type
    conn.execute(
        "DELETE FROM content_cache
         WHERE concept_id = ?1 AND content_type = ?2
           AND id NOT IN (
               SELECT id FROM content_cache
               WHERE concept_id = ?1 AND content_type = ?2
               ORDER BY created_at DESC LIMIT 3
           )",
        params![entry.concept_id, entry.content_type],
    )?;

    Ok(id)
}

/// Look up a cached entry by concept_id and content_type.
/// Returns the most recent entry if multiple exist.
/// Skips entries older than 7 days so learners get content calibrated to
/// their current mastery level rather than stale cached material.
pub fn get_cached_content(
    conn: &Connection,
    concept_id: &str,
    content_type: &str,
) -> Result<Option<CachedContent>> {
    let stale_cutoff = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(7))
        .map(|d| d.to_rfc3339())
        .unwrap_or_default();

    let mut stmt = conn.prepare(
        "SELECT id, concept_id, content_type, payload_json, model_version, created_at
         FROM content_cache
         WHERE concept_id = ?1 AND content_type = ?2 AND created_at >= ?3
         ORDER BY created_at DESC
         LIMIT 1",
    )?;

    let mut rows = stmt.query(params![concept_id, content_type, stale_cutoff])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_cached(row)?)),
        None => Ok(None),
    }
}

/// Get all cache entries for a concept.
pub fn get_cache_for_concept(conn: &Connection, concept_id: &str) -> Result<Vec<CachedContent>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, content_type, payload_json, model_version, created_at
         FROM content_cache
         WHERE concept_id = ?1
         ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map(params![concept_id], |row| row_to_cached(row))?;
    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }
    Ok(entries)
}

/// Delete cache entries older than the given date string.
pub fn purge_cache_before(conn: &Connection, before_date: &str) -> Result<usize> {
    let count = conn.execute(
        "DELETE FROM content_cache WHERE created_at < ?1",
        params![before_date],
    )?;
    Ok(count)
}

/// Delete all cache entries for a concept and content type.
pub fn invalidate_cache(conn: &Connection, concept_id: &str, content_type: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM content_cache WHERE concept_id = ?1 AND content_type = ?2",
        params![concept_id, content_type],
    )?;
    Ok(())
}

fn row_to_cached(row: &rusqlite::Row) -> Result<CachedContent> {
    Ok(CachedContent {
        id: row.get(0)?,
        concept_id: row.get(1)?,
        content_type: row.get(2)?,
        payload_json: row.get(3)?,
        model_version: row.get(4)?,
        created_at: row.get(5)?,
    })
}
