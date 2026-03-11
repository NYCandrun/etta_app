use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    pub id: Option<i64>,
    pub concept_id: String,
    pub project_id: Option<String>,
    pub file_path: Option<String>,
    pub mime_type: Option<String>,
    pub feedback_json: Option<String>,
    pub status: String,
    pub submitted_at: String,
}

/// Insert a new submission. Returns the new row id.
pub fn insert_submission(conn: &Connection, sub: &Submission) -> Result<i64> {
    conn.execute(
        "INSERT INTO submissions
         (concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            sub.concept_id,
            sub.project_id,
            sub.file_path,
            sub.mime_type,
            sub.feedback_json,
            sub.status,
            sub.submitted_at,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Get a submission by id.
pub fn get_submission(conn: &Connection, id: i64) -> Result<Option<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at
         FROM submissions WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_submission(row)?)),
        None => Ok(None),
    }
}

/// Get recent submissions for a concept (capped at 100 to prevent unbounded queries).
pub fn get_submissions_for_concept(conn: &Connection, concept_id: &str) -> Result<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at
         FROM submissions WHERE concept_id = ?1 ORDER BY submitted_at DESC LIMIT 100",
    )?;

    let rows = stmt.query_map(params![concept_id], |row| row_to_submission(row))?;
    let mut subs = Vec::new();
    for row in rows {
        subs.push(row?);
    }
    Ok(subs)
}

/// Get recent submissions for a project (capped at 100 to prevent unbounded queries).
pub fn get_submissions_for_project(conn: &Connection, project_id: &str) -> Result<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at
         FROM submissions WHERE project_id = ?1 ORDER BY submitted_at DESC LIMIT 100",
    )?;

    let rows = stmt.query_map(params![project_id], |row| row_to_submission(row))?;
    let mut subs = Vec::new();
    for row in rows {
        subs.push(row?);
    }
    Ok(subs)
}

/// Update submission status and feedback.
pub fn update_submission(
    conn: &Connection,
    id: i64,
    status: &str,
    feedback_json: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE submissions SET status = ?1, feedback_json = ?2 WHERE id = ?3",
        params![status, feedback_json, id],
    )?;
    Ok(())
}

/// Get recent submissions (last N).
pub fn get_recent_submissions(conn: &Connection, limit: i64) -> Result<Vec<Submission>> {
    let mut stmt = conn.prepare(
        "SELECT id, concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at
         FROM submissions ORDER BY submitted_at DESC LIMIT ?1",
    )?;

    let rows = stmt.query_map(params![limit], |row| row_to_submission(row))?;
    let mut subs = Vec::new();
    for row in rows {
        subs.push(row?);
    }
    Ok(subs)
}

fn row_to_submission(row: &rusqlite::Row) -> Result<Submission> {
    Ok(Submission {
        id: row.get(0)?,
        concept_id: row.get(1)?,
        project_id: row.get(2)?,
        file_path: row.get(3)?,
        mime_type: row.get(4)?,
        feedback_json: row.get(5)?,
        status: row.get(6)?,
        submitted_at: row.get(7)?,
    })
}
