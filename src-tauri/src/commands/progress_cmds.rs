use crate::db;
use crate::engine::decay;
use crate::AppState;
use serde::Serialize;
use tauri::State;

/// Per-concept state for the curriculum view.
#[derive(Debug, Serialize)]
pub struct ConceptState {
    pub id: String,
    pub title: String,
    pub domain: String,
    pub module: String,
    pub mastery_score: f64,
    pub effective_mastery: f64,
    pub attempt_count: i64,
    pub streak_correct: i64,
    pub next_review: Option<String>,
    pub status: String, // "locked", "available", "in_progress", "mastered"
}

/// Overall mastery statistics.
#[derive(Debug, Serialize)]
pub struct MasteryStats {
    pub total_concepts: usize,
    pub mastered_count: usize,
    pub in_progress_count: usize,
    pub available_count: usize,
    pub locked_count: usize,
    pub average_mastery: f64,
    pub total_attempts: i64,
    pub domains: Vec<DomainStats>,
}

#[derive(Debug, Serialize)]
pub struct DomainStats {
    pub domain: String,
    pub total: usize,
    pub mastered: usize,
    pub average_mastery: f64,
}

#[tauri::command]
pub fn get_curriculum_state(state: State<'_, AppState>) -> Result<Vec<ConceptState>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let all_concepts =
        db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;

    let mut result = Vec::with_capacity(all_concepts.len());

    for concept in &all_concepts {
        let eff_mastery =
            decay::effective_mastery(concept.mastery_score, concept.last_correct.as_deref(), concept.ease_factor);

        let status = determine_status(concept, &all_concepts);

        result.push(ConceptState {
            id: concept.id.clone(),
            title: concept.title.clone(),
            domain: concept.domain.clone(),
            module: concept.module.clone(),
            mastery_score: concept.mastery_score,
            effective_mastery: eff_mastery,
            attempt_count: concept.attempt_count,
            streak_correct: concept.streak_correct,
            next_review: concept.next_review.clone(),
            status,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_mastery_stats(state: State<'_, AppState>) -> Result<MasteryStats, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let all_concepts =
        db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;

    let total = all_concepts.len();
    let mut mastered = 0usize;
    let mut in_progress = 0usize;
    let mut available = 0usize;
    let mut locked = 0usize;
    let mut total_mastery = 0.0f64;
    let mut total_attempts = 0i64;

    let mut domain_map: std::collections::HashMap<String, (usize, usize, f64)> =
        std::collections::HashMap::new();

    for concept in &all_concepts {
        let status = determine_status(concept, &all_concepts);
        match status.as_str() {
            "mastered" => mastered += 1,
            "in_progress" => in_progress += 1,
            "available" => available += 1,
            "locked" => locked += 1,
            _ => {}
        }

        total_mastery += concept.mastery_score;
        total_attempts += concept.attempt_count;

        let entry = domain_map
            .entry(concept.domain.clone())
            .or_insert((0, 0, 0.0));
        entry.0 += 1;
        if concept.mastery_score >= 0.8 {
            entry.1 += 1;
        }
        entry.2 += concept.mastery_score;
    }

    let average_mastery = if total > 0 {
        total_mastery / total as f64
    } else {
        0.0
    };

    let domains: Vec<DomainStats> = domain_map
        .into_iter()
        .map(|(domain, (count, mastered_count, sum))| DomainStats {
            domain,
            total: count,
            mastered: mastered_count,
            average_mastery: if count > 0 {
                sum / count as f64
            } else {
                0.0
            },
        })
        .collect();

    Ok(MasteryStats {
        total_concepts: total,
        mastered_count: mastered,
        in_progress_count: in_progress,
        available_count: available,
        locked_count: locked,
        average_mastery,
        total_attempts,
        domains,
    })
}

fn determine_status(
    concept: &db::concepts::Concept,
    all_concepts: &[db::concepts::Concept],
) -> String {
    if concept.mastery_score >= 0.8 {
        return "mastered".to_string();
    }

    if concept.attempt_count > 0 {
        return "in_progress".to_string();
    }

    // Check if prerequisites are met.
    let prereqs_met = concept.prerequisites.iter().all(|prereq_id| {
        all_concepts
            .iter()
            .any(|c| c.id == *prereq_id && c.mastery_score > 0.0)
    });

    if prereqs_met {
        "available".to_string()
    } else {
        "locked".to_string()
    }
}
