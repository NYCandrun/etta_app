/// Result quality levels for SM-2 algorithm.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ResponseQuality {
    /// Incorrect answer — reset interval.
    Failed,
    /// Correct but difficult — decrease ease factor.
    Hard,
    /// Correct with moderate effort — keep ease factor.
    Good,
    /// Correct and easy — increase ease factor.
    Easy,
}

/// Updated scheduling parameters after a review.
#[derive(Debug, Clone)]
pub struct ScheduleUpdate {
    pub ease_factor: f64,
    pub interval_days: i64,
    pub next_review: String,
}

/// Minimum ease factor floor.
const MIN_EASE_FACTOR: f64 = 1.3;

/// Modified SM-2 algorithm.
///
/// - ease_factor starts at 2.5
/// - Easy: +0.1
/// - Good: no change
/// - Hard: -0.2
/// - Failed: reset interval to 1 day, ease_factor -0.2
///
/// interval = old_interval * ease_factor (on success)
/// Failed = reset to 1 day
pub fn update_schedule(
    quality: ResponseQuality,
    current_ease: f64,
    current_interval: i64,
) -> ScheduleUpdate {
    let (new_ease, new_interval) = match quality {
        ResponseQuality::Failed => {
            let ease = (current_ease - 0.2).max(MIN_EASE_FACTOR);
            (ease, 1_i64)
        }
        ResponseQuality::Hard => {
            let ease = (current_ease - 0.2).max(MIN_EASE_FACTOR);
            let interval = ((current_interval as f64) * ease).round() as i64;
            (ease, interval.max(1))
        }
        ResponseQuality::Good => {
            let interval = ((current_interval as f64) * current_ease).round() as i64;
            (current_ease, interval.max(1))
        }
        ResponseQuality::Easy => {
            let ease = current_ease + 0.1;
            let interval = ((current_interval as f64) * ease).round() as i64;
            (ease, interval.max(1))
        }
    };

    let next_review = compute_next_review_date(new_interval);

    ScheduleUpdate {
        ease_factor: new_ease,
        interval_days: new_interval,
        next_review,
    }
}

/// Determine response quality from correctness and optional context.
pub fn classify_response(correct: bool, streak: i64, latency_ms: Option<i64>) -> ResponseQuality {
    if !correct {
        return ResponseQuality::Failed;
    }

    // If correct and on a streak, consider it easy.
    if streak >= 3 {
        return ResponseQuality::Easy;
    }

    // If response was slow (>30s), consider it hard even if correct.
    if let Some(ms) = latency_ms {
        if ms > 30_000 {
            return ResponseQuality::Hard;
        }
    }

    ResponseQuality::Good
}

/// Compute next review date string (ISO 8601) by adding interval_days to today.
fn compute_next_review_date(interval_days: i64) -> String {
    let today = chrono::Local::now().date_naive();
    let next = today + chrono::Duration::days(interval_days);
    next.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_failed_resets_interval() {
        let result = update_schedule(ResponseQuality::Failed, 2.5, 10);
        assert_eq!(result.interval_days, 1);
        assert!((result.ease_factor - 2.3).abs() < 0.01);
    }

    #[test]
    fn test_easy_increases_ease() {
        let result = update_schedule(ResponseQuality::Easy, 2.5, 5);
        assert!((result.ease_factor - 2.6).abs() < 0.01);
        // interval should be 5 * 2.6 = 13
        assert_eq!(result.interval_days, 13);
    }

    #[test]
    fn test_ease_floor() {
        // Start at minimum and fail — should stay at floor.
        let result = update_schedule(ResponseQuality::Failed, 1.3, 5);
        assert!((result.ease_factor - 1.3).abs() < 0.01);
        assert_eq!(result.interval_days, 1);
    }

    #[test]
    fn test_good_keeps_ease() {
        let result = update_schedule(ResponseQuality::Good, 2.5, 4);
        assert!((result.ease_factor - 2.5).abs() < 0.01);
        assert_eq!(result.interval_days, 10); // 4 * 2.5 = 10
    }

    #[test]
    fn test_classify_correct_streak() {
        assert_eq!(classify_response(true, 5, None), ResponseQuality::Easy);
    }

    #[test]
    fn test_classify_slow_response() {
        assert_eq!(
            classify_response(true, 0, Some(45_000)),
            ResponseQuality::Hard
        );
    }
}
