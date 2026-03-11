use crate::db::concepts::{self, Concept};
use rusqlite::Connection;
use std::path::Path;

use super::graph::{self, Curriculum};

/// Seed the concepts table from the curriculum JSON file.
/// Expects the file at the given resource directory path.
pub fn seed_concepts_from_file(conn: &Connection, resource_dir: &Path) -> Result<(), String> {
    let curriculum_path = resource_dir.join("curriculum").join("curriculum.json");
    let curriculum = graph::load_curriculum(&curriculum_path)?;

    graph::validate_dag(&curriculum)?;
    insert_curriculum(conn, &curriculum)
}

/// Seed concepts from the built-in curriculum (fallback if resource file not found).
pub fn seed_concepts(conn: &Connection) -> Result<(), String> {
    let json = include_str!("../../resources/curriculum/curriculum.json");
    let curriculum = graph::load_curriculum_from_str(json)?;
    graph::validate_dag(&curriculum)?;
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
