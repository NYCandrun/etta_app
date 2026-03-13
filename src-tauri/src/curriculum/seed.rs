use crate::db::concepts::{self, Concept};
use rusqlite::Connection;

use super::graph::{self, Curriculum};

/// Seed concepts from the built-in domain files (fallback if resource directory not found).
/// Reads all 12 domain JSON files compiled into the binary.
pub fn seed_concepts(conn: &Connection) -> Result<(), String> {
    let mut all_concepts = Vec::new();

    // Include all domain files at compile time — source of truth
    let domain_sources: &[(&str, &str)] = &[
        ("algebra", include_str!("../../resources/curriculum/algebra.json")),
        ("trigonometry", include_str!("../../resources/curriculum/trigonometry.json")),
        ("precalculus", include_str!("../../resources/curriculum/precalculus.json")),
        ("single_variable_calculus", include_str!("../../resources/curriculum/single_variable_calculus.json")),
        ("multivariable_calculus", include_str!("../../resources/curriculum/multivariable_calculus.json")),
        ("linear_algebra", include_str!("../../resources/curriculum/linear_algebra.json")),
        ("differential_equations", include_str!("../../resources/curriculum/differential_equations.json")),
        ("classical_mechanics", include_str!("../../resources/curriculum/classical_mechanics.json")),
        ("electromagnetism", include_str!("../../resources/curriculum/electromagnetism.json")),
        ("thermodynamics", include_str!("../../resources/curriculum/thermodynamics.json")),
        ("quantum_mechanics", include_str!("../../resources/curriculum/quantum_mechanics.json")),
        ("astrophysics", include_str!("../../resources/curriculum/astrophysics.json")),
    ];

    for (name, json) in domain_sources {
        match graph::load_domain_from_str(json) {
            Ok(concepts) => all_concepts.extend(concepts),
            Err(e) => return Err(format!("Failed to parse domain '{}': {e}", name)),
        }
    }

    let curriculum = graph::Curriculum { concepts: all_concepts };
    graph::validate_dag(&curriculum)?;
    eprintln!("Seeding {} concepts from {} domains (built-in)",
        curriculum.concepts.len(),
        curriculum.concepts.iter().map(|c| c.domain.as_str()).collect::<std::collections::HashSet<_>>().len()
    );
    insert_curriculum(conn, &curriculum)
}

fn insert_curriculum(conn: &Connection, curriculum: &Curriculum) -> Result<(), String> {
    for cc in &curriculum.concepts {
        let concept = Concept {
            id: cc.id.clone(),
            domain: cc.domain.clone(),
            module: cc.module.clone(),
            title: cc.title.clone(),
            prerequisites: cc.prerequisites.clone(),
            learning_objectives: cc.learning_objectives.clone(),
            difficulty_tier: cc.difficulty_tier,
            error_patterns: cc.error_patterns.clone(),
            mastery_score: 0.0,
            ease_factor: 2.5,
            interval_days: 1,
            next_review: None,
            last_correct: None,
            last_latency_ms: None,
            attempt_count: 0,
            streak_correct: 0,
        };

        concepts::insert_concept(conn, &concept).map_err(|e| {
            format!("Failed to insert concept '{}': {e}", cc.id)
        })?;
    }

    Ok(())
}
