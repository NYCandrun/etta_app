/// Weights for mastery score calculation.
const WEIGHT_QUIZ_ACCURACY: f64 = 0.50;
const WEIGHT_RESPONSE_CONSISTENCY: f64 = 0.25;
const WEIGHT_TRANSFER_SUCCESS: f64 = 0.25;

/// A single attempt record used for mastery computation.
#[derive(Debug, Clone)]
pub struct AttemptRecord {
    /// Whether the answer was correct.
    pub correct: bool,
    /// Response latency in milliseconds (if available).
    pub latency_ms: Option<i64>,
    /// Whether this was a transfer/application question (cross-concept).
    pub is_transfer: bool,
}

/// Compute mastery score as a weighted average of three components:
///   - Quiz accuracy (50%): fraction of correct answers in recent attempts
///   - Response consistency (25%): based on latency stability (lower variance = higher score)
///   - Transfer success (25%): accuracy on transfer/application questions
///
/// Returns a score in [0.0, 1.0].
pub fn compute_mastery(attempts: &[AttemptRecord]) -> f64 {
    if attempts.is_empty() {
        return 0.0;
    }

    let quiz_accuracy = compute_quiz_accuracy(attempts);
    let consistency = compute_response_consistency(attempts);
    let transfer = compute_transfer_success(attempts);

    let score = WEIGHT_QUIZ_ACCURACY * quiz_accuracy
        + WEIGHT_RESPONSE_CONSISTENCY * consistency
        + WEIGHT_TRANSFER_SUCCESS * transfer;

    score.clamp(0.0, 1.0)
}

/// Fraction of correct answers.
fn compute_quiz_accuracy(attempts: &[AttemptRecord]) -> f64 {
    let correct = attempts.iter().filter(|a| a.correct).count() as f64;
    correct / attempts.len() as f64
}

/// Response consistency based on latency stability.
/// If we have latency data, a low coefficient of variation means high consistency.
/// If no latency data, we use quiz accuracy as a proxy.
fn compute_response_consistency(attempts: &[AttemptRecord]) -> f64 {
    let latencies: Vec<f64> = attempts
        .iter()
        .filter_map(|a| a.latency_ms.map(|l| l as f64))
        .collect();

    if latencies.len() < 2 {
        // Not enough data — fall back to accuracy as proxy.
        return compute_quiz_accuracy(attempts);
    }

    let mean = latencies.iter().sum::<f64>() / latencies.len() as f64;
    if mean <= 0.0 {
        return 1.0;
    }

    let variance =
        latencies.iter().map(|l| (l - mean).powi(2)).sum::<f64>() / latencies.len() as f64;
    let std_dev = variance.sqrt();
    let cv = std_dev / mean; // coefficient of variation

    // Map CV to a score: CV=0 -> 1.0, CV>=1 -> 0.0
    (1.0 - cv).clamp(0.0, 1.0)
}

/// Accuracy specifically on transfer/application questions.
/// If no transfer questions exist, defaults to overall quiz accuracy.
fn compute_transfer_success(attempts: &[AttemptRecord]) -> f64 {
    let transfer_attempts: Vec<&AttemptRecord> =
        attempts.iter().filter(|a| a.is_transfer).collect();

    if transfer_attempts.is_empty() {
        // No transfer questions — use overall accuracy.
        return compute_quiz_accuracy(attempts);
    }

    let correct = transfer_attempts.iter().filter(|a| a.correct).count() as f64;
    correct / transfer_attempts.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_attempts() {
        assert_eq!(compute_mastery(&[]), 0.0);
    }

    #[test]
    fn test_perfect_score() {
        let attempts = vec![
            AttemptRecord {
                correct: true,
                latency_ms: Some(1000),
                is_transfer: false,
            },
            AttemptRecord {
                correct: true,
                latency_ms: Some(1100),
                is_transfer: true,
            },
            AttemptRecord {
                correct: true,
                latency_ms: Some(1050),
                is_transfer: false,
            },
        ];
        let score = compute_mastery(&attempts);
        assert!(score > 0.9, "Perfect attempts should yield high mastery");
    }

    #[test]
    fn test_mixed_results() {
        let attempts = vec![
            AttemptRecord {
                correct: true,
                latency_ms: Some(1000),
                is_transfer: false,
            },
            AttemptRecord {
                correct: false,
                latency_ms: Some(5000),
                is_transfer: false,
            },
            AttemptRecord {
                correct: true,
                latency_ms: Some(1200),
                is_transfer: true,
            },
            AttemptRecord {
                correct: false,
                latency_ms: Some(8000),
                is_transfer: true,
            },
        ];
        let score = compute_mastery(&attempts);
        assert!(
            score > 0.0 && score < 1.0,
            "Mixed results should be between 0 and 1"
        );
    }
}
