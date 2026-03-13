use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// A concept definition as loaded from the flat curriculum JSON file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurriculumConcept {
    pub id: String,
    pub domain: String,
    pub module: String,
    pub title: String,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    #[serde(default)]
    pub learning_objectives: Vec<String>,
    #[serde(default)]
    pub difficulty_tier: Option<i64>,
    #[serde(default)]
    pub error_patterns: Vec<String>,
}

/// The full curriculum structure (flat concept list).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Curriculum {
    pub concepts: Vec<CurriculumConcept>,
}

/// A concept within a domain module (rich domain JSON format).
#[derive(Debug, Clone, Deserialize)]
pub struct DomainConcept {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub prerequisites: Vec<String>,
    #[serde(default)]
    pub learning_objectives: Vec<String>,
    #[serde(default)]
    pub difficulty_tier: Option<i64>,
    #[serde(default)]
    pub error_patterns: Vec<String>,
}

/// A module within a domain.
#[derive(Debug, Clone, Deserialize)]
pub struct DomainModule {
    pub title: String,
    pub concepts: Vec<DomainConcept>,
}

/// A single domain JSON file structure.
#[derive(Debug, Clone, Deserialize)]
pub struct DomainFile {
    pub domain: String,
    pub modules: Vec<DomainModule>,
}

/// Parse a domain JSON string and flatten into CurriculumConcepts.
pub fn load_domain_from_str(json: &str) -> Result<Vec<CurriculumConcept>, String> {
    let domain: DomainFile =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse domain JSON: {e}"))?;

    let mut concepts = Vec::new();
    for module in &domain.modules {
        for concept in &module.concepts {
            concepts.push(CurriculumConcept {
                id: concept.id.clone(),
                domain: domain.domain.clone(),
                module: module.title.clone(),
                title: concept.title.clone(),
                prerequisites: concept.prerequisites.clone(),
                learning_objectives: concept.learning_objectives.clone(),
                difficulty_tier: concept.difficulty_tier,
                error_patterns: concept.error_patterns.clone(),
            });
        }
    }
    Ok(concepts)
}

/// Validate the curriculum DAG:
/// 1. All concept IDs are unique.
/// 2. All prerequisite references resolve to existing concepts.
/// 3. No cycles exist in the dependency graph.
pub fn validate_dag(curriculum: &Curriculum) -> Result<(), String> {
    let ids: HashSet<&str> = curriculum.concepts.iter().map(|c| c.id.as_str()).collect();

    // Check uniqueness.
    if ids.len() != curriculum.concepts.len() {
        return Err("Duplicate concept IDs found in curriculum".to_string());
    }

    // Check all prerequisites resolve.
    for concept in &curriculum.concepts {
        for prereq in &concept.prerequisites {
            if !ids.contains(prereq.as_str()) {
                return Err(format!(
                    "Concept '{}' has unresolved prerequisite '{}'",
                    concept.id, prereq
                ));
            }
        }
    }

    // Check for cycles using DFS.
    detect_cycles(curriculum)?;

    Ok(())
}

/// Detect cycles in the prerequisite graph using iterative DFS with coloring.
fn detect_cycles(curriculum: &Curriculum) -> Result<(), String> {
    let adj: HashMap<&str, Vec<&str>> = curriculum
        .concepts
        .iter()
        .map(|c| {
            (
                c.id.as_str(),
                c.prerequisites.iter().map(|p| p.as_str()).collect(),
            )
        })
        .collect();

    // 0 = white (unvisited), 1 = gray (in progress), 2 = black (done)
    let mut color: HashMap<&str, u8> = adj.keys().map(|&k| (k, 0u8)).collect();

    for &node in adj.keys() {
        if color[node] == 0 {
            let mut stack: Vec<(&str, bool)> = vec![(node, false)];

            while let Some((current, processed)) = stack.pop() {
                if processed {
                    color.insert(current, 2);
                    continue;
                }

                if color[current] == 1 {
                    // Already being processed — we've returned to it.
                    color.insert(current, 2);
                    continue;
                }

                if color[current] == 2 {
                    continue;
                }

                color.insert(current, 1);
                stack.push((current, true)); // Mark for post-processing.

                if let Some(neighbors) = adj.get(current) {
                    for &neighbor in neighbors {
                        match color[neighbor] {
                            1 => {
                                return Err(format!(
                                    "Cycle detected: '{}' -> '{}'",
                                    current, neighbor
                                ));
                            }
                            0 => {
                                stack.push((neighbor, false));
                            }
                            _ => {} // Already fully processed.
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_dag() {
        let curriculum = Curriculum {
            concepts: vec![
                CurriculumConcept {
                    id: "a".into(),
                    domain: "math".into(),
                    module: "basics".into(),
                    title: "Addition".into(),
                    prerequisites: vec![],
                    learning_objectives: vec![],
                    difficulty_tier: None,
                    error_patterns: vec![],
                },
                CurriculumConcept {
                    id: "b".into(),
                    domain: "math".into(),
                    module: "basics".into(),
                    title: "Subtraction".into(),
                    prerequisites: vec!["a".into()],
                    learning_objectives: vec![],
                    difficulty_tier: None,
                    error_patterns: vec![],
                },
            ],
        };
        assert!(validate_dag(&curriculum).is_ok());
    }

    #[test]
    fn test_cycle_detection() {
        let curriculum = Curriculum {
            concepts: vec![
                CurriculumConcept {
                    id: "a".into(),
                    domain: "math".into(),
                    module: "basics".into(),
                    title: "A".into(),
                    prerequisites: vec!["b".into()],
                    learning_objectives: vec![],
                    difficulty_tier: None,
                    error_patterns: vec![],
                },
                CurriculumConcept {
                    id: "b".into(),
                    domain: "math".into(),
                    module: "basics".into(),
                    title: "B".into(),
                    prerequisites: vec!["a".into()],
                    learning_objectives: vec![],
                    difficulty_tier: None,
                    error_patterns: vec![],
                },
            ],
        };
        assert!(validate_dag(&curriculum).is_err());
    }

    #[test]
    fn test_unresolved_prereq() {
        let curriculum = Curriculum {
            concepts: vec![CurriculumConcept {
                id: "a".into(),
                domain: "math".into(),
                module: "basics".into(),
                title: "A".into(),
                prerequisites: vec!["nonexistent".into()],
                learning_objectives: vec![],
                difficulty_tier: None,
                error_patterns: vec![],
            }],
        };
        assert!(validate_dag(&curriculum).is_err());
    }
}
