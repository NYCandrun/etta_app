use rusqlite::{params, Connection, Result};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizAnswer {
    pub id: i64,
    pub session_id: String,
    pub question_id: String,
    pub concept_id: String,
    pub question_type: String,
    pub selected_option: Option<String>,
    pub free_text: Option<String>,
    pub filled_blanks: Option<String>,
    pub is_correct: bool,
    pub score: f64,
    pub time_spent_ms: Option<i64>,
    pub created_at: String,
}

/// Maximum number of quiz answers to retain.
const MAX_QUIZ_ANSWERS: i64 = 5000;

/// Insert a quiz answer record.
pub fn insert_quiz_answer(
    conn: &Connection,
    session_id: &str,
    question_id: &str,
    concept_id: &str,
    question_type: &str,
    selected_option: Option<&str>,
    free_text: Option<&str>,
    filled_blanks: Option<&str>,
    is_correct: bool,
    score: f64,
    time_spent_ms: Option<i64>,
) -> Result<i64> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO quiz_answers
         (session_id, question_id, concept_id, question_type,
          selected_option, free_text, filled_blanks,
          is_correct, score, time_spent_ms, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            session_id,
            question_id,
            concept_id,
            question_type,
            selected_option,
            free_text,
            filled_blanks,
            is_correct as i32,
            score,
            time_spent_ms,
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();

    // Prune oldest answers beyond retention cap
    conn.execute(
        "DELETE FROM quiz_answers WHERE id NOT IN (
            SELECT id FROM quiz_answers ORDER BY created_at DESC LIMIT ?1
        )",
        params![MAX_QUIZ_ANSWERS],
    )?;

    Ok(id)
}

/// Get all quiz answers (for data export).
pub fn get_all_quiz_answers(conn: &Connection) -> Result<Vec<QuizAnswer>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, question_id, concept_id, question_type,
                selected_option, free_text, filled_blanks,
                is_correct, score, time_spent_ms, created_at
         FROM quiz_answers ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(QuizAnswer {
            id: row.get(0)?,
            session_id: row.get(1)?,
            question_id: row.get(2)?,
            concept_id: row.get(3)?,
            question_type: row.get(4)?,
            selected_option: row.get(5)?,
            free_text: row.get(6)?,
            filled_blanks: row.get(7)?,
            is_correct: row.get::<_, i32>(8)? != 0,
            score: row.get(9)?,
            time_spent_ms: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;

    let mut answers = Vec::new();
    for row in rows {
        answers.push(row?);
    }
    Ok(answers)
}
