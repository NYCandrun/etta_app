//! Simple in-memory rate limiter for API-calling commands.
//!
//! Uses a token-bucket-style approach per command name. Each command gets a
//! budget of `max_tokens` calls. One token is consumed per call. Tokens
//! refill at a steady rate (one per `refill_interval`). If the bucket is
//! empty, the call is rejected.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Global rate-limiter state, keyed by command name.
static RATE_LIMITER: Mutex<Option<HashMap<String, Bucket>>> = Mutex::new(None);

struct Bucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl Bucket {
    fn new(max_tokens: f64, refill_rate: f64) -> Self {
        Self {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    fn try_consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Default bucket parameters for AI-calling commands:
/// - max burst of 10 requests
/// - refill 1 request per 3 seconds (~20/min sustained)
const DEFAULT_MAX_TOKENS: f64 = 10.0;
const DEFAULT_REFILL_RATE: f64 = 1.0 / 3.0;

/// Check the rate limit for `command_name`. Returns `Ok(())` if allowed,
/// or `Err(message)` if the caller should be throttled.
pub fn check_rate_limit(command_name: &str) -> Result<(), String> {
    let mut guard = RATE_LIMITER
        .lock()
        .map_err(|_| "Rate limiter lock poisoned".to_string())?;

    let map = guard.get_or_insert_with(HashMap::new);

    let bucket = map
        .entry(command_name.to_string())
        .or_insert_with(|| Bucket::new(DEFAULT_MAX_TOKENS, DEFAULT_REFILL_RATE));

    if bucket.try_consume() {
        Ok(())
    } else {
        Err(format!(
            "Rate limit exceeded for '{}'. Please wait a moment before trying again.",
            command_name
        ))
    }
}
