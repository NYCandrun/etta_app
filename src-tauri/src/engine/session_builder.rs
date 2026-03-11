use crate::db::concepts::{self, Concept};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

/// A daily learning session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySession {
    /// Concepts due for review today.
    pub reviews: Vec<Concept>,
    /// Next unlocked concept to learn (if any).
    pub new_concept: Option<Concept>,
    /// Total number of items in this session.
    pub total_items: usize,
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

    let total_items = reviews.len() + if new_concept.is_some() { 1 } else { 0 };

    Ok(DailySession {
        reviews,
        new_concept,
        total_items,
    })
}
