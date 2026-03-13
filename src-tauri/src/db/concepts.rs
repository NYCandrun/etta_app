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
    pub learning_objectives: Vec<String>,
    pub difficulty_tier: Option<i64>,
    pub error_patterns: Vec<String>,
    pub mastery_score: f64,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub next_review: Option<String>,
    pub last_correct: Option<String>,
    pub last_latency_ms: Option<i64>,
    pub attempt_count: i64,
    pub streak_correct: i64,
}

/// Insert a new concept. Prerequisites, learning_objectives, and error_patterns
/// are stored as JSON array strings.
pub fn insert_concept(conn: &Connection, concept: &Concept) -> Result<()> {
    let prereqs_json = serde_json::to_string(&concept.prerequisites).unwrap_or_default();
    let objectives_json = serde_json::to_string(&concept.learning_objectives).unwrap_or_default();
    let errors_json = serde_json::to_string(&concept.error_patterns).unwrap_or_default();
    conn.execute(
        "INSERT OR REPLACE INTO concepts
         (id, domain, module, title, prerequisites, learning_objectives, difficulty_tier,
          error_patterns, mastery_score, ease_factor,
          interval_days, next_review, last_correct, last_latency_ms, attempt_count, streak_correct)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            concept.id,
            concept.domain,
            concept.module,
            concept.title,
            prereqs_json,
            objectives_json,
            concept.difficulty_tier,
            errors_json,
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
        "SELECT id, domain, module, title, prerequisites, learning_objectives,
                difficulty_tier, error_patterns, mastery_score, ease_factor,
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
        "SELECT id, domain, module, title, prerequisites, learning_objectives,
                difficulty_tier, error_patterns, mastery_score, ease_factor,
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
        "SELECT id, domain, module, title, prerequisites, learning_objectives,
                difficulty_tier, error_patterns, mastery_score, ease_factor,
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
/// prerequisites are all mastered (mastery_score >= 0.8 for each prerequisite).
///
/// Domain entry concepts (those with no intra-domain prerequisites) are always
/// unlocked, allowing users to start any section of the curriculum freely.
pub fn get_unlocked_new_concepts(conn: &Connection) -> Result<Vec<Concept>> {
    let all = get_all_concepts(conn)?;

    // Build a set of concept IDs per domain for intra-domain prerequisite checks
    let domain_concepts: std::collections::HashMap<String, std::collections::HashSet<String>> = {
        let mut map: std::collections::HashMap<String, std::collections::HashSet<String>> =
            std::collections::HashMap::new();
        for c in &all {
            map.entry(c.domain.clone())
                .or_default()
                .insert(c.id.clone());
        }
        map
    };

    let mut unlocked = Vec::new();

    for concept in &all {
        // Skip concepts that already have a review scheduled or have been attempted.
        if concept.next_review.is_some() || concept.attempt_count > 0 {
            continue;
        }

        // A domain entry concept has no prerequisites within its own domain.
        // These are always unlocked so users can start any curriculum section.
        let domain_ids = domain_concepts.get(&concept.domain);
        let is_domain_entry = concept
            .prerequisites
            .iter()
            .all(|prereq_id| domain_ids.map_or(true, |ids| !ids.contains(prereq_id)));

        if is_domain_entry {
            unlocked.push(concept.clone());
            continue;
        }

        // For non-entry concepts, require intra-domain prerequisites to be mastered.
        // Cross-domain prerequisites are not enforced (the user chose to start this domain).
        let intra_domain_prereqs_met = concept.prerequisites.iter().all(|prereq_id| {
            let is_intra_domain = domain_ids.map_or(false, |ids| ids.contains(prereq_id));
            if !is_intra_domain {
                return true; // Cross-domain prerequisite — don't block
            }
            all.iter()
                .any(|c| c.id == *prereq_id && c.mastery_score >= 0.8)
        });

        if intra_domain_prereqs_met {
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
#[allow(dead_code)]
pub fn get_concepts_by_domain(conn: &Connection, domain: &str) -> Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain, module, title, prerequisites, learning_objectives,
                difficulty_tier, error_patterns, mastery_score, ease_factor,
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
    let prerequisites: Vec<String> = serde_json::from_str(&prereqs_str).unwrap_or_default();

    let objectives_str: String = row
        .get::<_, Option<String>>(5)?
        .unwrap_or_else(|| "[]".to_string());
    let learning_objectives: Vec<String> =
        serde_json::from_str(&objectives_str).unwrap_or_default();

    let errors_str: String = row
        .get::<_, Option<String>>(7)?
        .unwrap_or_else(|| "[]".to_string());
    let error_patterns: Vec<String> = serde_json::from_str(&errors_str).unwrap_or_default();

    Ok(Concept {
        id: row.get(0)?,
        domain: row.get(1)?,
        module: row.get(2)?,
        title: row.get(3)?,
        prerequisites,
        learning_objectives,
        difficulty_tier: row.get(6)?,
        error_patterns,
        mastery_score: row.get(8)?,
        ease_factor: row.get(9)?,
        interval_days: row.get(10)?,
        next_review: row.get(11)?,
        last_correct: row.get(12)?,
        last_latency_ms: row.get(13)?,
        attempt_count: row.get(14)?,
        streak_correct: row.get(15)?,
    })
}
