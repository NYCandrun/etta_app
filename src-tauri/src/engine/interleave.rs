use crate::db::concepts::Concept;
use serde::{Deserialize, Serialize};

/// Distribution targets for interleaved problem sets.
const NEW_RATIO: f64 = 0.20;
const RECENT_RATIO: f64 = 0.30;
const REVIEW_RATIO: f64 = 0.50;

/// Category of a concept in an interleaved set.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProblemCategory {
    New,
    Recent,
    Review,
}

/// A single item in an interleaved problem set.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterleavedItem {
    pub concept: Concept,
    pub category: ProblemCategory,
}

/// Generate an interleaved problem set from available concepts.
///
/// Distribution: 20% new, 30% recent (attempted in last 7 days), 50% review (older).
///
/// `new_concepts`: concepts never attempted.
/// `recent_concepts`: concepts attempted within the last 7 days.
/// `review_concepts`: concepts attempted more than 7 days ago, due for review.
/// `target_size`: desired total number of problems.
pub fn generate_interleaved_set(
    new_concepts: &[Concept],
    recent_concepts: &[Concept],
    review_concepts: &[Concept],
    target_size: usize,
) -> Vec<InterleavedItem> {
    let new_count = ((target_size as f64) * NEW_RATIO).round() as usize;
    let recent_count = ((target_size as f64) * RECENT_RATIO).round() as usize;
    let review_count = ((target_size as f64) * REVIEW_RATIO).round() as usize;

    let mut items = Vec::with_capacity(target_size);

    // Take up to the target count from each category.
    let new_items: Vec<_> = new_concepts
        .iter()
        .take(new_count)
        .map(|c| InterleavedItem {
            concept: c.clone(),
            category: ProblemCategory::New,
        })
        .collect();

    let recent_items: Vec<_> = recent_concepts
        .iter()
        .take(recent_count)
        .map(|c| InterleavedItem {
            concept: c.clone(),
            category: ProblemCategory::Recent,
        })
        .collect();

    let review_items: Vec<_> = review_concepts
        .iter()
        .take(review_count)
        .map(|c| InterleavedItem {
            concept: c.clone(),
            category: ProblemCategory::Review,
        })
        .collect();

    // Interleave: review, recent, new pattern to space out difficulty.
    let mut new_iter = new_items.into_iter();
    let mut recent_iter = recent_items.into_iter();
    let mut review_iter = review_items.into_iter();

    // Build the interleaved sequence following review-heavy pattern.
    loop {
        let before = items.len();

        // Add a review item.
        if let Some(item) = review_iter.next() {
            items.push(item);
        }
        // Add a recent item.
        if let Some(item) = recent_iter.next() {
            items.push(item);
        }
        // Add another review item.
        if let Some(item) = review_iter.next() {
            items.push(item);
        }
        // Add a new item.
        if let Some(item) = new_iter.next() {
            items.push(item);
        }

        // If no items were added this round, we've exhausted all sources.
        if items.len() == before {
            break;
        }

        if items.len() >= target_size {
            items.truncate(target_size);
            break;
        }
    }

    // Drain any remaining items if we haven't hit target.
    for item in review_iter {
        if items.len() >= target_size {
            break;
        }
        items.push(item);
    }
    for item in recent_iter {
        if items.len() >= target_size {
            break;
        }
        items.push(item);
    }
    for item in new_iter {
        if items.len() >= target_size {
            break;
        }
        items.push(item);
    }

    items
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_concept(id: &str) -> Concept {
        Concept {
            id: id.to_string(),
            domain: "math".to_string(),
            module: "algebra".to_string(),
            title: format!("Concept {id}"),
            prerequisites: vec![],
            mastery_score: 0.0,
            ease_factor: 2.5,
            interval_days: 1,
            next_review: None,
            last_correct: None,
            last_latency_ms: None,
            attempt_count: 0,
            streak_correct: 0,
        }
    }

    #[test]
    fn test_interleaved_set_distribution() {
        let new = vec![make_concept("n1"), make_concept("n2")];
        let recent = vec![make_concept("r1"), make_concept("r2"), make_concept("r3")];
        let review = vec![
            make_concept("v1"),
            make_concept("v2"),
            make_concept("v3"),
            make_concept("v4"),
            make_concept("v5"),
        ];

        let set = generate_interleaved_set(&new, &recent, &review, 10);
        assert!(!set.is_empty());
        assert!(set.len() <= 10);
    }

    #[test]
    fn test_empty_categories() {
        let set = generate_interleaved_set(&[], &[], &[], 10);
        assert!(set.is_empty());
    }
}
