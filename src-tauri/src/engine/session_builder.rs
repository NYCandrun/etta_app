use crate::db::concepts::{self, Concept};
use crate::engine::{interleave, spaced_rep};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

/// Maximum reviews per session — kept moderate so reviews don't crowd out new material.
const MAX_REVIEWS_PER_SESSION: usize = 10;
/// Maximum new concepts per session so adult learners aren't artificially throttled.
const MAX_NEW_PER_SESSION: usize = 3;

/// Build a daily session for the learner.
///
/// 1. Determine the learner's current and previous domains.
/// 2. Gather due review concepts scoped to those two domains (capped at 10).
/// 3. Auto-reschedule expert-level concepts (mastery >= 0.95) without adding to session.
/// 4. Pick up to MAX_NEW_PER_SESSION unlocked new concepts.
pub fn build_daily_session(conn: &Connection) -> Result<DailySession, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let all_concepts = concepts::get_all_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    // Determine which domains are active: the current domain (has in-progress or unlocked
    // concepts) and the most recent fully-completed domain before it.
    let (current_domain, previous_domain) = determine_active_domains(&all_concepts);

    let mut due = concepts::get_due_concepts(conn, &today).map_err(|e| format!("DB error: {e}"))?;

    // Auto-reschedule expert-level concepts (mastery >= 0.95) — they skip the review queue.
    let mut reviews = Vec::new();
    for concept in due.drain(..) {
        if concept.mastery_score >= spaced_rep::EXPERT_MASTERY_THRESHOLD {
            // Silently push the next review far out without requiring a quiz
            let schedule =
                spaced_rep::expert_reschedule(concept.ease_factor, concept.interval_days);
            let _ = concepts::update_mastery(
                conn,
                &concept.id,
                concept.mastery_score,
                schedule.ease_factor,
                schedule.interval_days,
                &schedule.next_review,
                concept.last_correct.as_deref(),
                concept.last_latency_ms,
                concept.streak_correct,
            );
        } else {
            reviews.push(concept);
        }
    }

    // Build a set of modules the user has actually started working on.
    // Within the current domain, only review concepts from modules where the user has
    // attempted at least one concept — never pull in reviews from modules further ahead.
    let started_modules: std::collections::HashSet<(String, String)> = all_concepts
        .iter()
        .filter(|c| c.attempt_count > 0)
        .map(|c| (c.domain.clone(), c.module.clone()))
        .collect();

    // Scope reviews to:
    // - Current domain: only modules the user has started
    // - Previous domain: all modules (it's fully completed)
    // This prevents a learner deep into calculus from being buried by old algebra reviews,
    // and within the current domain, never shows reviews from modules not yet reached.
    reviews.retain(|c| {
        if let Some(ref curr) = current_domain {
            if c.domain == *curr {
                // Within current domain, only review from modules already started
                return started_modules.contains(&(c.domain.clone(), c.module.clone()));
            }
        }
        if let Some(ref prev) = previous_domain {
            if c.domain == *prev {
                return true;
            }
        }
        // If we can't determine active domains (e.g., fresh start), include all
        current_domain.is_none()
    });

    // Cap reviews so a long break doesn't produce an overwhelming session.
    // Most overdue items come first (ordered by next_review ASC).
    reviews.truncate(MAX_REVIEWS_PER_SESSION);

    let unlocked =
        concepts::get_unlocked_new_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    let new_concepts: Vec<Concept> = unlocked.into_iter().take(MAX_NEW_PER_SESSION).collect();

    // Split reviews into "recent" (attempted within 7 days) vs "older review"
    // for proper interleaving, rather than flat-appending.
    let seven_days_ago = (chrono::Local::now() - chrono::Duration::days(7))
        .format("%Y-%m-%d")
        .to_string();
    let (recent_reviews, older_reviews): (Vec<Concept>, Vec<Concept>) =
        reviews.into_iter().partition(|c| {
            c.last_correct
                .as_deref()
                .map_or(false, |d| d >= seven_days_ago.as_str())
        });

    let target_size = MAX_REVIEWS_PER_SESSION + MAX_NEW_PER_SESSION;
    let interleaved = interleave::generate_interleaved_set(
        &new_concepts,
        &recent_reviews,
        &older_reviews,
        target_size,
    );

    let session_concepts: Vec<Concept> = interleaved.into_iter().map(|item| item.concept).collect();

    // Estimate ~10 min per concept
    let estimated_minutes = (session_concepts.len() as u32) * 10;

    let id = format!("session_{}", today);

    Ok(DailySession {
        id,
        concepts: session_concepts,
        estimated_minutes,
    })
}

/// Determine the learner's current and previous active domains.
///
/// - **Current domain**: The domain that has at least one in-progress concept (attempt_count > 0,
///   mastery < 0.8) or at least one unlocked new concept. If multiple, pick the one with the
///   most recent activity.
/// - **Previous domain**: The most recently completed domain (all concepts mastered >= 0.8)
///   that is NOT the current domain.
fn determine_active_domains(all_concepts: &[Concept]) -> (Option<String>, Option<String>) {
    // Group concepts by domain
    let mut domain_groups: HashMap<String, Vec<&Concept>> = HashMap::new();
    for c in all_concepts {
        domain_groups.entry(c.domain.clone()).or_default().push(c);
    }

    let mut current_domain: Option<String> = None;
    let mut current_domain_activity: Option<String> = None; // last_correct date for sorting

    let mut completed_domains: Vec<(String, String)> = Vec::new(); // (domain, max_last_correct)

    for (domain, concepts) in &domain_groups {
        let has_in_progress = concepts
            .iter()
            .any(|c| c.attempt_count > 0 && c.mastery_score < 0.8);
        let has_unlocked_new = concepts.iter().any(|c| {
            c.attempt_count == 0 && {
                // Check if prerequisites are met
                c.prerequisites.iter().all(|prereq_id| {
                    all_concepts
                        .iter()
                        .any(|pc| pc.id == *prereq_id && pc.mastery_score >= 0.8)
                })
            }
        });

        let all_mastered = !concepts.is_empty()
            && concepts.iter().any(|c| c.attempt_count > 0) // at least one attempted
            && concepts.iter().all(|c| c.mastery_score >= 0.8);

        let max_activity = concepts
            .iter()
            .filter_map(|c| c.last_correct.as_ref())
            .max()
            .cloned()
            .unwrap_or_default();

        if has_in_progress || has_unlocked_new {
            // Candidate for current domain — pick the most recently active one
            if current_domain.is_none()
                || max_activity > current_domain_activity.clone().unwrap_or_default()
            {
                current_domain = Some(domain.clone());
                current_domain_activity = Some(max_activity.clone());
            }
        }

        if all_mastered {
            completed_domains.push((domain.clone(), max_activity));
        }
    }

    // Sort completed domains by most recent activity (descending)
    completed_domains.sort_by(|a, b| b.1.cmp(&a.1));

    // Previous domain = most recently completed domain that isn't the current one
    let previous_domain = completed_domains
        .iter()
        .find(|(d, _)| Some(d) != current_domain.as_ref())
        .map(|(d, _)| d.clone());

    (current_domain, previous_domain)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_concept(id: &str, domain: &str, mastery: f64, attempts: i64) -> Concept {
        Concept {
            id: id.to_string(),
            domain: domain.to_string(),
            module: "test".to_string(),
            title: format!("Concept {id}"),
            prerequisites: vec![],
            learning_objectives: vec![],
            difficulty_tier: None,
            error_patterns: vec![],
            mastery_score: mastery,
            ease_factor: 2.5,
            interval_days: 1,
            next_review: None,
            last_correct: if attempts > 0 {
                Some("2026-03-01".to_string())
            } else {
                None
            },
            last_latency_ms: None,
            attempt_count: attempts,
            streak_correct: 0,
        }
    }

    #[test]
    fn test_determine_active_domains_basic() {
        let concepts = vec![
            make_concept("a1", "algebra", 0.9, 5),
            make_concept("a2", "algebra", 0.85, 4),
            make_concept("p1", "precalculus", 0.5, 3),
            make_concept("p2", "precalculus", 0.0, 0),
        ];

        let (current, previous) = determine_active_domains(&concepts);
        assert_eq!(current, Some("precalculus".to_string()));
        assert_eq!(previous, Some("algebra".to_string()));
    }

    #[test]
    fn test_started_modules_filter() {
        // User has started "Numbers and Operations" but not "Linear Equations"
        let mut c1 = make_concept("a1", "algebra", 0.6, 3);
        c1.module = "Numbers and Operations".to_string();
        let mut c2 = make_concept("a2", "algebra", 0.0, 0);
        c2.module = "Linear Equations".to_string();

        let all = vec![c1.clone(), c2.clone()];
        let started: std::collections::HashSet<(String, String)> = all
            .iter()
            .filter(|c| c.attempt_count > 0)
            .map(|c| (c.domain.clone(), c.module.clone()))
            .collect();

        // c1 is from a started module — should be included
        assert!(started.contains(&("algebra".to_string(), "Numbers and Operations".to_string())));
        // c2 is from an unstarted module — should be excluded
        assert!(!started.contains(&("algebra".to_string(), "Linear Equations".to_string())));
    }

    #[test]
    fn test_determine_active_domains_fresh_start() {
        let concepts = vec![
            make_concept("a1", "algebra", 0.0, 0),
            make_concept("a2", "algebra", 0.0, 0),
        ];

        let (current, previous) = determine_active_domains(&concepts);
        // algebra has unlocked new concepts (no prereqs)
        assert_eq!(current, Some("algebra".to_string()));
        assert_eq!(previous, None);
    }
}
