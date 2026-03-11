/// Compute a decayed mastery score using an exponential forgetting curve.
///
/// decayed_score = mastery * e^(-decay_rate * days_since_review)
///
/// The decay_rate is inversely proportional to the ease_factor:
///   decay_rate = BASE_DECAY / ease_factor
///
/// This means concepts with higher ease (well-learned) decay more slowly.
const BASE_DECAY: f64 = 0.1;

/// Compute the decayed mastery score.
///
/// - `mastery`: the raw mastery score (0.0 to 1.0)
/// - `days_since_review`: number of days since last review
/// - `ease_factor`: the concept's ease factor (1.3+)
pub fn decayed_mastery(mastery: f64, days_since_review: f64, ease_factor: f64) -> f64 {
    if days_since_review <= 0.0 {
        return mastery;
    }

    let decay_rate = BASE_DECAY / ease_factor.max(1.0);
    let decayed = mastery * (-decay_rate * days_since_review).exp();

    decayed.clamp(0.0, 1.0)
}

/// Calculate days since a given date string (ISO 8601 YYYY-MM-DD) relative to today.
/// Returns 0 if the date is today or in the future, or if parsing fails.
pub fn days_since(date_str: &str) -> f64 {
    let today = chrono::Local::now().date_naive();
    match chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(date) => {
            let diff = today.signed_duration_since(date).num_days();
            if diff > 0 { diff as f64 } else { 0.0 }
        }
        Err(_) => 0.0,
    }
}

/// Compute effective mastery for a concept, accounting for time decay.
pub fn effective_mastery(mastery: f64, last_review: Option<&str>, ease_factor: f64) -> f64 {
    match last_review {
        Some(date) => {
            let days = days_since(date);
            decayed_mastery(mastery, days, ease_factor)
        }
        None => mastery,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_decay_at_zero_days() {
        assert!((decayed_mastery(0.8, 0.0, 2.5) - 0.8).abs() < 0.001);
    }

    #[test]
    fn test_decay_over_time() {
        let score = decayed_mastery(0.8, 10.0, 2.5);
        assert!(score < 0.8, "Score should decay over time");
        assert!(score > 0.0, "Score should remain positive");
    }

    #[test]
    fn test_higher_ease_slower_decay() {
        let low_ease = decayed_mastery(0.8, 10.0, 1.3);
        let high_ease = decayed_mastery(0.8, 10.0, 3.0);
        assert!(
            high_ease > low_ease,
            "Higher ease should result in slower decay"
        );
    }

    #[test]
    fn test_score_bounds() {
        let score = decayed_mastery(1.0, 1000.0, 1.3);
        assert!(score >= 0.0 && score <= 1.0);
    }
}
