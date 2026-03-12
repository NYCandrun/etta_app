use crate::db::concepts::Concept;

/// Number of consecutive low-mastery attempts that trigger struggle detection.
const STRUGGLE_THRESHOLD_ATTEMPTS: i64 = 3;
/// Mastery score below which a concept is considered struggling.
const STRUGGLE_MASTERY_CEILING: f64 = 0.3;

/// Result of struggle detection for a concept.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StruggleInfo {
    /// Whether the learner is struggling with this concept.
    pub is_struggling: bool,
    /// Recommendation text (if struggling).
    pub recommendation: Option<String>,
    /// Prerequisite concept IDs to revisit (if struggling).
    pub revisit_prerequisites: Vec<String>,
}

/// Detect if a learner is struggling with a concept.
///
/// Criteria: mastery_score < 0.3 after 3+ attempts with streak_correct == 0
/// (meaning the last answer was wrong, so consecutive failures).
pub fn detect_struggle(concept: &Concept, all_concepts: &[Concept]) -> StruggleInfo {
    let is_struggling = concept.attempt_count >= STRUGGLE_THRESHOLD_ATTEMPTS
        && concept.mastery_score < STRUGGLE_MASTERY_CEILING
        && concept.streak_correct == 0;

    if !is_struggling {
        return StruggleInfo {
            is_struggling: false,
            recommendation: None,
            revisit_prerequisites: vec![],
        };
    }

    // Find prerequisite concepts that aren't fully mastered
    let weak_prereqs: Vec<String> = concept
        .prerequisites
        .iter()
        .filter(|prereq_id| {
            all_concepts
                .iter()
                .any(|c| c.id == **prereq_id && c.mastery_score < 0.8)
        })
        .cloned()
        .collect();

    let recommendation = if !weak_prereqs.is_empty() {
        let prereq_names: Vec<String> = weak_prereqs
            .iter()
            .filter_map(|pid| all_concepts.iter().find(|c| c.id == *pid))
            .map(|c| c.title.clone())
            .collect();
        Some(format!(
            "You seem to be struggling with this concept. Consider revisiting: {}. \
             Strengthening these foundations will make this topic much easier.",
            prereq_names.join(", ")
        ))
    } else {
        Some(
            "You seem to be struggling with this concept. Try reviewing the lesson again \
             with a different explanation strategy, or take a break and come back to it later."
                .to_string(),
        )
    };

    StruggleInfo {
        is_struggling: true,
        recommendation,
        revisit_prerequisites: weak_prereqs,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::concepts::Concept;

    fn make_concept(
        id: &str,
        mastery: f64,
        attempts: i64,
        streak: i64,
        prereqs: Vec<String>,
    ) -> Concept {
        Concept {
            id: id.to_string(),
            domain: "algebra".to_string(),
            module: "test".to_string(),
            title: format!("Concept {id}"),
            prerequisites: prereqs,
            learning_objectives: vec![],
            difficulty_tier: None,
            error_patterns: vec![],
            mastery_score: mastery,
            ease_factor: 2.5,
            interval_days: 1,
            next_review: None,
            last_correct: None,
            last_latency_ms: None,
            attempt_count: attempts,
            streak_correct: streak,
        }
    }

    #[test]
    fn test_no_struggle_new_concept() {
        let c = make_concept("c1", 0.0, 0, 0, vec![]);
        let result = detect_struggle(&c, &[c.clone()]);
        assert!(!result.is_struggling);
    }

    #[test]
    fn test_struggle_detected() {
        let c = make_concept("c1", 0.2, 4, 0, vec![]);
        let result = detect_struggle(&c, &[c.clone()]);
        assert!(result.is_struggling);
        assert!(result.recommendation.is_some());
    }

    #[test]
    fn test_no_struggle_when_streak_positive() {
        let c = make_concept("c1", 0.2, 4, 1, vec![]);
        let result = detect_struggle(&c, &[c.clone()]);
        assert!(!result.is_struggling);
    }

    #[test]
    fn test_struggle_with_weak_prereqs() {
        let prereq = make_concept("p1", 0.5, 3, 0, vec![]);
        let c = make_concept("c1", 0.15, 5, 0, vec!["p1".to_string()]);
        let result = detect_struggle(&c, &[c.clone(), prereq]);
        assert!(result.is_struggling);
        assert_eq!(result.revisit_prerequisites, vec!["p1".to_string()]);
    }
}
