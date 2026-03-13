use super::types::{Message, MessagesRequest, MessagesResponse};
use crate::db::concepts::Concept;
use serde::{Deserialize, Serialize};

pub const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

/// The modes the tutor can operate in.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TutorMode {
    Lesson,
    Quiz,
    Explain,
    Evaluate,
    Review,
}

impl TutorMode {
    pub fn as_str(&self) -> &str {
        match self {
            TutorMode::Lesson => "lesson",
            TutorMode::Quiz => "quiz",
            TutorMode::Explain => "explain",
            TutorMode::Evaluate => "evaluate",
            TutorMode::Review => "review",
        }
    }

    /// Per-mode max output token budget. Keeps tight limits on shorter tasks
    /// to avoid wasting tokens, while allowing full budget for content generation.
    pub fn max_tokens(&self) -> u32 {
        match self {
            TutorMode::Lesson => 8192,
            TutorMode::Quiz => 16384,
            TutorMode::Explain => 4096,
            TutorMode::Evaluate => 8192,
            TutorMode::Review => 4096,
        }
    }
}

/// Escape user-supplied content for safe interpolation into XML-structured prompts.
/// Prevents prompt injection via XML tag breakout.
pub fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Context about the learner injected into the prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnerContext {
    pub mastery_score: f64,
    pub attempt_count: i64,
    pub streak_correct: i64,
    pub ease_factor: f64,
    pub last_latency_ms: Option<i64>,
}

impl From<&Concept> for LearnerContext {
    fn from(c: &Concept) -> Self {
        Self {
            mastery_score: c.mastery_score,
            attempt_count: c.attempt_count,
            streak_correct: c.streak_correct,
            ease_factor: c.ease_factor,
            last_latency_ms: c.last_latency_ms,
        }
    }
}

/// Build a request with a specific model. Uses mode-specific max tokens and
/// extracts only the relevant system prompt sections for the given mode.
pub fn build_request_with_model(
    model: &str,
    mode: &TutorMode,
    concept: &Concept,
    learner_ctx: &LearnerContext,
    system_prompt: &str,
    extra_user_text: Option<&str>,
    stream: bool,
) -> MessagesRequest {
    let user_message = build_user_message(mode, concept, learner_ctx, extra_user_text);
    let trimmed_prompt = extract_mode_prompt(system_prompt, mode);

    MessagesRequest::new(
        model,
        mode.max_tokens(),
        Some(trimmed_prompt),
        vec![Message::user_text(&user_message)],
        stream,
    )
}

fn build_user_message(
    mode: &TutorMode,
    concept: &Concept,
    learner_ctx: &LearnerContext,
    extra_user_text: Option<&str>,
) -> String {
    let mut msg = String::with_capacity(1024);

    msg.push_str(&format!("<mode>{}</mode>\n\n", mode.as_str()));

    msg.push_str("<concept>\n");
    msg.push_str(&format!("  <id>{}</id>\n", concept.id));
    msg.push_str(&format!("  <title>{}</title>\n", concept.title));
    msg.push_str(&format!("  <domain>{}</domain>\n", concept.domain));
    msg.push_str(&format!("  <module>{}</module>\n", concept.module));
    if !concept.prerequisites.is_empty() {
        msg.push_str(&format!(
            "  <prerequisites>{}</prerequisites>\n",
            concept.prerequisites.join(", ")
        ));
    }
    if !concept.learning_objectives.is_empty() {
        msg.push_str("  <learning_objectives>\n");
        for obj in &concept.learning_objectives {
            msg.push_str(&format!("    - {}\n", obj));
        }
        msg.push_str("  </learning_objectives>\n");
    }
    if let Some(tier) = concept.difficulty_tier {
        msg.push_str(&format!("  <difficulty_tier>{}</difficulty_tier>\n", tier));
    }
    if !concept.error_patterns.is_empty() {
        msg.push_str("  <error_patterns>\n");
        for pat in &concept.error_patterns {
            msg.push_str(&format!("    - {}\n", pat));
        }
        msg.push_str("  </error_patterns>\n");
    }
    msg.push_str("</concept>\n\n");

    msg.push_str("<learner_context>\n");
    msg.push_str(&format!(
        "  <mastery_score>{:.2}</mastery_score>\n",
        learner_ctx.mastery_score
    ));
    msg.push_str(&format!(
        "  <attempt_count>{}</attempt_count>\n",
        learner_ctx.attempt_count
    ));
    msg.push_str(&format!(
        "  <streak_correct>{}</streak_correct>\n",
        learner_ctx.streak_correct
    ));
    msg.push_str(&format!(
        "  <ease_factor>{:.2}</ease_factor>\n",
        learner_ctx.ease_factor
    ));
    if let Some(latency) = learner_ctx.last_latency_ms {
        msg.push_str(&format!(
            "  <last_latency_ms>{}</last_latency_ms>\n",
            latency
        ));
    }
    msg.push_str("</learner_context>\n");

    if let Some(extra) = extra_user_text {
        msg.push_str(&format!("\n<user_input>\n{extra}\n</user_input>\n"));
    }

    msg
}

/// Load the system prompt from the bundled resources file.
/// Falls back to a built-in default if the file is not found.
pub fn load_system_prompt(resource_dir: &std::path::Path) -> String {
    let prompt_path = resource_dir.join("tutor_prompt.txt");
    match std::fs::read_to_string(&prompt_path) {
        Ok(contents) => contents,
        Err(_) => {
            eprintln!(
                "Warning: tutor_prompt.txt not found at {:?}, using built-in fallback",
                prompt_path
            );
            include_str!("../../resources/tutor_prompt.txt").to_string()
        }
    }
}

/// Extract mode-relevant sections from the full system prompt.
///
/// The full tutor_prompt.txt contains instructions for all 5 modes, but each
/// API call only uses one mode. This extracts the shared preamble (Core Persona,
/// Voice Guidelines), the specific mode section, and shared footer sections
/// (Learner Context, Mathematical Formatting, Important Constraints),
/// saving ~800-1000 tokens per call by omitting irrelevant mode sections.
pub fn extract_mode_prompt(full_prompt: &str, mode: &TutorMode) -> String {
    let mode_header = format!("### Mode: {}", mode.as_str());

    // Find the "## Operating Modes" boundary
    let modes_start = full_prompt.find("## Operating Modes");
    // Find the start of our target mode section
    let target_start = full_prompt.find(&mode_header);
    // Find the "## Learner Context" footer section
    let footer_start = full_prompt.find("## Learner Context Interpretation");

    // If we can't find the expected structure, return the full prompt as fallback
    let (modes_start, target_start, footer_start) = match (modes_start, target_start, footer_start) {
        (Some(ms), Some(ts), Some(fs)) => (ms, ts, fs),
        _ => return full_prompt.to_string(),
    };

    // Find the end of the target mode section (start of the next ### Mode: header or footer)
    let after_target = &full_prompt[target_start + mode_header.len()..];
    let target_end = after_target
        .find("### Mode: ")
        .map(|offset| target_start + mode_header.len() + offset)
        .unwrap_or(footer_start);

    let mut result = String::with_capacity(full_prompt.len());

    // Preamble: everything before "## Operating Modes"
    result.push_str(full_prompt[..modes_start].trim_end());
    result.push_str("\n\n");

    // Operating Modes header + only the relevant mode
    result.push_str("## Operating Modes\n\n");
    result.push_str("You operate in exactly one mode per request, indicated by the <mode> tag.\n\n");
    result.push_str(full_prompt[target_start..target_end].trim_end());
    result.push_str("\n\n");

    // Footer: Learner Context, Math Formatting, Constraints
    result.push_str(full_prompt[footer_start..].trim_end());
    result.push('\n');

    result
}

/// Log token usage from an API response. Writes to stderr for now;
/// a future iteration could persist this to the database for analytics.
pub fn log_token_usage(mode: &TutorMode, model: &str, response: &MessagesResponse) {
    eprintln!(
        "[token-usage] mode={} model={} input_tokens={} output_tokens={} total={}",
        mode.as_str(),
        model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        response.usage.input_tokens + response.usage.output_tokens,
    );
}

/// Estimate the number of Claude API tokens for a base64-encoded attachment.
///
/// Claude counts ~1 token per 6.5 bytes of base64 for images, and roughly
/// 1 token per 4 characters of text/document content after decoding.
/// Returns an estimate so callers can warn users before sending oversized payloads.
pub fn estimate_attachment_tokens(base64_data: &str, mime_type: &str) -> u64 {
    let base64_len = base64_data.len() as u64;

    if mime_type.starts_with("image/") {
        // Images: Claude vision uses ~85 tokens per 512x512 tile.
        // Rough estimate: base64 length / 750 (empirically derived).
        // Minimum 85 tokens (one tile).
        (base64_len / 750).max(85)
    } else {
        // Documents (PDF, text, etc.): roughly 1 token per 4 decoded bytes.
        // base64 encodes 3 bytes into 4 chars, so decoded_bytes ≈ base64_len * 3/4.
        let decoded_bytes = base64_len * 3 / 4;
        decoded_bytes / 4
    }
}
