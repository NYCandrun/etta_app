use crate::db;
use crate::engine::{decay, snapshots};
use crate::AppState;
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

/// Manually trigger a mastery snapshot to persist current learning progress.
#[tauri::command]
pub fn save_progress(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    snapshots::record_mastery_snapshots(&conn)?;
    Ok(())
}

/// A frontend-compatible concept with all fields the UI needs.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendConcept {
    pub id: String,
    pub name: String,
    pub description: String,
    pub domain: FrontendDomain,
    pub module_id: String,
    pub state: String,
    pub mastery_score: f64,
    pub prerequisites: Vec<String>,
    pub estimated_minutes: u32,
    pub last_reviewed_at: Option<String>,
    pub next_review_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDomain {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub icon_name: String,
    pub module_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendModule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub domain_id: String,
    pub concept_ids: Vec<String>,
    pub order: usize,
}

/// Full curriculum state matching the frontend CurriculumState type.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumState {
    pub domains: Vec<FrontendDomain>,
    pub modules: Vec<FrontendModule>,
    pub concepts: Vec<FrontendConcept>,
    pub total_mastery: f64,
    pub concepts_completed: usize,
    pub concepts_total: usize,
}

/// Domain metadata (color/icon) for known domains.
fn domain_meta(domain: &str) -> (&str, &str, &str) {
    match domain {
        "algebra" => ("Algebra", "#6366f1", "calculator"),
        "precalculus" => ("Precalculus", "#8b5cf6", "function"),
        "trigonometry" => ("Trigonometry", "#ec4899", "triangle"),
        "single_variable_calculus" => ("Single Variable Calculus", "#f59e0b", "integral"),
        "multivariable_calculus" => ("Multivariable Calculus", "#f97316", "cube"),
        "linear_algebra" => ("Linear Algebra", "#10b981", "grid"),
        "differential_equations" => ("Differential Equations", "#14b8a6", "wave"),
        "classical_mechanics" => ("Classical Mechanics", "#3b82f6", "atom"),
        "electromagnetism" => ("Electromagnetism", "#a855f7", "bolt"),
        "thermodynamics" => ("Thermodynamics", "#ef4444", "flame"),
        "quantum_mechanics" => ("Quantum Mechanics", "#06b6d4", "quantum"),
        "astrophysics" => ("Astrophysics", "#1e40af", "star"),
        _ => (domain, "#6b7280", "book"),
    }
}

#[tauri::command]
pub fn get_curriculum_state(state: State<'_, AppState>) -> Result<CurriculumState, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let all_concepts =
        db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;

    // Group by domain and module
    let mut domain_modules: HashMap<String, HashMap<String, Vec<String>>> = HashMap::new();
    for concept in &all_concepts {
        domain_modules
            .entry(concept.domain.clone())
            .or_default()
            .entry(concept.module.clone())
            .or_default()
            .push(concept.id.clone());
    }

    // Build domain objects
    let mut domains: Vec<FrontendDomain> = Vec::new();
    let mut modules: Vec<FrontendModule> = Vec::new();
    let mut module_order = 0usize;

    for (domain_id, mods) in &domain_modules {
        let (display_name, color, icon) = domain_meta(domain_id);
        let mut module_ids = Vec::new();

        for (mod_name, concept_ids) in mods {
            let mod_id = format!("{}_{}", domain_id, mod_name.to_lowercase().replace(' ', "_"));
            module_ids.push(mod_id.clone());
            modules.push(FrontendModule {
                id: mod_id,
                name: mod_name.clone(),
                description: format!("{} module", mod_name),
                domain_id: domain_id.clone(),
                concept_ids: concept_ids.clone(),
                order: module_order,
            });
            module_order += 1;
        }

        domains.push(FrontendDomain {
            id: domain_id.clone(),
            name: display_name.to_string(),
            description: format!("{} learning path", display_name),
            color: color.to_string(),
            icon_name: icon.to_string(),
            module_ids,
        });
    }

    // Build frontend concepts
    let mut frontend_concepts = Vec::with_capacity(all_concepts.len());
    let mut completed = 0usize;
    let mut total_mastery = 0.0f64;

    // Build a domain lookup map
    let domain_map: HashMap<String, FrontendDomain> =
        domains.iter().map(|d| (d.id.clone(), d.clone())).collect();

    for concept in &all_concepts {
        let eff_mastery = decay::effective_mastery(
            concept.mastery_score,
            concept.last_correct.as_deref(),
            concept.ease_factor,
        );
        let status = determine_status(concept, &all_concepts);

        if status == "mastered" {
            completed += 1;
        }
        total_mastery += eff_mastery;

        let domain_obj = domain_map
            .get(&concept.domain)
            .cloned()
            .unwrap_or_else(|| {
                let (name, color, icon) = domain_meta(&concept.domain);
                FrontendDomain {
                    id: concept.domain.clone(),
                    name: name.to_string(),
                    description: format!("{} learning path", name),
                    color: color.to_string(),
                    icon_name: icon.to_string(),
                    module_ids: vec![],
                }
            });

        let mod_id = format!(
            "{}_{}",
            concept.domain,
            concept.module.to_lowercase().replace(' ', "_")
        );

        frontend_concepts.push(FrontendConcept {
            id: concept.id.clone(),
            name: concept.title.clone(),
            description: format!("Learn about {}", concept.title),
            domain: domain_obj,
            module_id: mod_id,
            state: status,
            mastery_score: eff_mastery,
            prerequisites: concept.prerequisites.clone(),
            estimated_minutes: 10,
            last_reviewed_at: concept.last_correct.clone(),
            next_review_at: concept.next_review.clone(),
        });
    }

    let total = all_concepts.len();
    let avg_mastery = if total > 0 {
        total_mastery / total as f64
    } else {
        0.0
    };

    Ok(CurriculumState {
        domains,
        modules,
        concepts: frontend_concepts,
        total_mastery: avg_mastery,
        concepts_completed: completed,
        concepts_total: total,
    })
}

/// Overall mastery statistics.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct DomainStats {
    pub domain: String,
    pub total: usize,
    pub mastered: usize,
    pub average_mastery: f64,
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

    let mut domain_map_stats: std::collections::HashMap<String, (usize, usize, f64)> =
        std::collections::HashMap::new();

    for concept in &all_concepts {
        let status = determine_status(concept, &all_concepts);
        match status.as_str() {
            "mastered" => mastered += 1,
            "in_progress" => in_progress += 1,
            "unlocked" => available += 1,
            "locked" => locked += 1,
            _ => {}
        }

        total_mastery += concept.mastery_score;
        total_attempts += concept.attempt_count;

        let entry = domain_map_stats
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

    let domains: Vec<DomainStats> = domain_map_stats
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

    // Check if prerequisites are mastered (>= 0.8 mastery threshold).
    let prereqs_met = concept.prerequisites.iter().all(|prereq_id| {
        all_concepts
            .iter()
            .any(|c| c.id == *prereq_id && c.mastery_score >= 0.8)
    });

    if prereqs_met {
        "unlocked".to_string()
    } else {
        "locked".to_string()
    }
}
