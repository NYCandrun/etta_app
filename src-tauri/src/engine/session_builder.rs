use crate::db::concepts::{self, Concept};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

/// A daily learning session — shaped to match the frontend's DailySessionResponse.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailySession {
    /// Synthetic session id (date-based).
    pub id: String,
    /// All concepts in this session (reviews + new concept).
    pub concepts: Vec<Concept>,
    /// Estimated total minutes.
    pub estimated_minutes: u32,
}

/// Build a daily session for the learner.
///
/// 1. Gather all concepts whose next_review date is today or earlier.
/// 2. Pick the next unlocked new concept (prerequisites met, never attempted).
pub fn build_daily_session(conn: &Connection) -> Result<DailySession, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let reviews =
        concepts::get_due_concepts(conn, &today).map_err(|e| format!("DB error: {e}"))?;

    let unlocked =
        concepts::get_unlocked_new_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    let new_concept = unlocked.into_iter().next();

    let mut session_concepts: Vec<Concept> = reviews;
    if let Some(nc) = new_concept {
        session_concepts.push(nc);
    }

    // Estimate ~10 min per concept
    let estimated_minutes = (session_concepts.len() as u32) * 10;

    let id = format!("session_{}", today);

    Ok(DailySession {
        id,
        concepts: session_concepts,
        estimated_minutes,
    })
}
