use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Concept {
    pub id: String,
    pub domain: String,
    pub module: String,
    pub title: String,
    pub prerequisites: Vec<String>,
    pub mastery_score: f64,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub next_review: Option<String>,
    pub last_correct: Option<String>,
    pub last_latency_ms: Option<i64>,
    pub attempt_count: i64,
    pub streak_correct: i64,
}

/// Insert a new concept. Prerequisites are stored as a JSON array string.
pub fn insert_concept(conn: &Connection, concept: &Concept) -> Result<()> {
    let prereqs_json = serde_json::to_string(&concept.prerequisites).unwrap_or_default();
    conn.execute(
        "INSERT OR REPLACE INTO concepts
         (id, domain, module, title, prerequisites, mastery_score, ease_factor,
          interval_days, next_review, last_correct, last_latency_ms, attempt_count, streak_correct)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            concept.id,
            concept.domain,
            concept.module,
            concept.title,
            prereqs_json,
            concept.mastery_score,
            concept.ease_factor,
            concept.interval_days,
            concept.next_review,
            concept.last_correct,
            concept.last_latency_ms,
            concept.attempt_count,
            concept.streak_correct,
        ],
    )?;
    Ok(())
}

/// Retrieve a single concept by id.
pub fn get_concept(conn: &Connection, id: &str) -> Result<Option<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, module, title, prerequisites, mastery_score, ease_factor,
                interval_days, next_review, last_correct, last_latency_ms, attempt_count,
                streak_correct
         FROM concepts WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_concept(row)?)),
        None => Ok(None),
    }
}

/// Retrieve all concepts.
pub fn get_all_concepts(conn: &Connection) -> Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, module, title, prerequisites, mastery_score, ease_factor,
                interval_days, next_review, last_correct, last_latency_ms, attempt_count,
                streak_correct
         FROM concepts ORDER BY domain, module, title",
    )?;

    let rows = stmt.query_map([], |row| row_to_concept(row))?;
    let mut concepts = Vec::new();
    for row in rows {
        concepts.push(row?);
    }
    Ok(concepts)
}

/// Get concepts whose next_review is due (on or before the given date string).
pub fn get_due_concepts(conn: &Connection, today: &str) -> Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, module, title, prerequisites, mastery_score, ease_factor,
                interval_days, next_review, last_correct, last_latency_ms, attempt_count,
                streak_correct
         FROM concepts
         WHERE next_review IS NOT NULL AND next_review <= ?1
         ORDER BY next_review ASC",
    )?;

    let rows = stmt.query_map(params![today], |row| row_to_concept(row))?;
    let mut concepts = Vec::new();
    for row in rows {
        concepts.push(row?);
    }
    Ok(concepts)
}

/// Get concepts that have never been reviewed (next_review IS NULL) and whose
/// prerequisites are all met (mastery_score > 0 for each prerequisite).
pub fn get_unlocked_new_concepts(conn: &Connection) -> Result<Vec<Concept>> {
    let all = get_all_concepts(conn)?;
    let mut unlocked = Vec::new();

    for concept in &all {
        // Skip concepts that already have a review scheduled or have been attempted.
        if concept.next_review.is_some() || concept.attempt_count > 0 {
            continue;
        }

        // Check prerequisites.
        let prereqs_met = concept.prerequisites.iter().all(|prereq_id| {
            all.iter()
                .any(|c| c.id == *prereq_id && c.mastery_score > 0.0)
        });

        if prereqs_met {
            unlocked.push(concept.clone());
        }
    }

    Ok(unlocked)
}

/// Update mastery-related fields after an answer attempt.
pub fn update_mastery(
    conn: &Connection,
    id: &str,
    mastery_score: f64,
    ease_factor: f64,
    interval_days: i64,
    next_review: &str,
    last_correct: Option<&str>,
    last_latency_ms: Option<i64>,
    streak_correct: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE concepts SET
            mastery_score = ?1,
            ease_factor = ?2,
            interval_days = ?3,
            next_review = ?4,
            last_correct = ?5,
            last_latency_ms = ?6,
            attempt_count = attempt_count + 1,
            streak_correct = ?7
         WHERE id = ?8",
        params![
            mastery_score,
            ease_factor,
            interval_days,
            next_review,
            last_correct,
            last_latency_ms,
            streak_correct,
            id,
        ],
    )?;
    Ok(())
}

/// Get concepts by domain.
pub fn get_concepts_by_domain(conn: &Connection, domain: &str) -> Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, module, title, prerequisites, mastery_score, ease_factor,
                interval_days, next_review, last_correct, last_latency_ms, attempt_count,
                streak_correct
         FROM concepts WHERE domain = ?1 ORDER BY module, title",
    )?;

    let rows = stmt.query_map(params![domain], |row| row_to_concept(row))?;
    let mut concepts = Vec::new();
    for row in rows {
        concepts.push(row?);
    }
    Ok(concepts)
}

fn row_to_concept(row: &rusqlite::Row) -> Result<Concept> {
    let prereqs_str: String = row.get(4)?;
    let prerequisites: Vec<String> =
        serde_json::from_str(&prereqs_str).unwrap_or_default();

    Ok(Concept {
        id: row.get(0)?,
        domain: row.get(1)?,
        module: row.get(2)?,
        title: row.get(3)?,
        prerequisites,
        mastery_score: row.get(5)?,
        ease_factor: row.get(6)?,
        interval_days: row.get(7)?,
        next_review: row.get(8)?,
        last_correct: row.get(9)?,
        last_latency_ms: row.get(10)?,
        attempt_count: row.get(11)?,
        streak_correct: row.get(12)?,
    })
}
