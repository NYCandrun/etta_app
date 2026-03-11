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

/// Maximum reviews per session to avoid overwhelming the learner after a break.
const MAX_REVIEWS_PER_SESSION: usize = 20;
/// Maximum new concepts per session so adult learners aren't artificially throttled.
const MAX_NEW_PER_SESSION: usize = 3;

/// Build a daily session for the learner.
///
/// 1. Gather concepts whose next_review date is today or earlier (capped).
/// 2. Pick up to MAX_NEW_PER_SESSION unlocked new concepts.
pub fn build_daily_session(conn: &Connection) -> Result<DailySession, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut reviews =
        concepts::get_due_concepts(conn, &today).map_err(|e| format!("DB error: {e}"))?;

    // Cap reviews so a long break doesn't produce an overwhelming session.
    // Most overdue items come first (ordered by next_review ASC).
    reviews.truncate(MAX_REVIEWS_PER_SESSION);

    let unlocked =
        concepts::get_unlocked_new_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    let new_concepts: Vec<Concept> = unlocked.into_iter().take(MAX_NEW_PER_SESSION).collect();

    let mut session_concepts: Vec<Concept> = reviews;
    session_concepts.extend(new_concepts);

    // Estimate ~10 min per concept
    let estimated_minutes = (session_concepts.len() as u32) * 10;

    let id = format!("session_{}", today);

    Ok(DailySession {
        id,
        concepts: session_concepts,
        estimated_minutes,
    })
}
