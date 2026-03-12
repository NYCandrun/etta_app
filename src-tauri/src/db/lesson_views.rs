use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonView {
    pub id: i64,
    pub concept_id: String,
    pub lesson_id: String,
    pub viewed_at: String,
}

/// Maximum number of lesson view records to retain.
const MAX_LESSON_VIEWS: i64 = 5000;

/// Record that a lesson was viewed.
pub fn insert_lesson_view(
    conn: &Connection,
    concept_id: &str,
    lesson_id: &str,
) -> Result<i64> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO lesson_views (concept_id, lesson_id, viewed_at)
         VALUES (?1, ?2, ?3)",
        params![concept_id, lesson_id, now],
    )?;
    let id = conn.last_insert_rowid();

    // Prune oldest entries beyond retention cap
    conn.execute(
        "DELETE FROM lesson_views WHERE id NOT IN (
            SELECT id FROM lesson_views ORDER BY viewed_at DESC LIMIT ?1
        )",
        params![MAX_LESSON_VIEWS],
    )?;

    Ok(id)
}

/// Get all lesson views (for data export).
pub fn get_all_lesson_views(conn: &Connection) -> Result<Vec<LessonView>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, lesson_id, viewed_at
         FROM lesson_views ORDER BY viewed_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(LessonView {
            id: row.get(0)?,
            concept_id: row.get(1)?,
            lesson_id: row.get(2)?,
            viewed_at: row.get(3)?,
        })
    })?;

    let mut views = Vec::new();
    for row in rows {
        views.push(row?);
    }
    Ok(views)
}
