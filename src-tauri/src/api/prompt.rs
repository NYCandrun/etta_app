use super::types::{Message, MessagesRequest};
use crate::db::concepts::Concept;
use serde::{Deserialize, Serialize};

pub const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

/// Per-mode max token budgets to avoid overspending on simpler modes.
fn max_tokens_for_mode(mode: &TutorMode) -> u32 {
    match mode {
        TutorMode::Lesson => 4096,
        TutorMode::Quiz => 3072,   // JSON output is more compact
        TutorMode::Explain => 2048,
        TutorMode::Evaluate => 4096,
        TutorMode::Review => 2048,
    }
}

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

/// Build a complete API request for a given tutor mode.
/// If `model_override` is provided, it takes precedence over DEFAULT_MODEL.
pub fn build_request(
    mode: &TutorMode,
    concept: &Concept,
    learner_ctx: &LearnerContext,
    system_prompt: &str,
    extra_user_text: Option<&str>,
) -> MessagesRequest {
    build_request_with_model(DEFAULT_MODEL, mode, concept, learner_ctx, system_prompt, extra_user_text, false)
}

/// Build a request with a specific model.
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
    let max_tokens = max_tokens_for_mode(mode);

    MessagesRequest::new(
        model,
        max_tokens,
        Some(system_prompt.to_string()),
        vec![Message::user_text(&user_message)],
        stream,
    )
}

/// Build a streaming API request.
pub fn build_streaming_request(
    mode: &TutorMode,
    concept: &Concept,
    learner_ctx: &LearnerContext,
    system_prompt: &str,
    extra_user_text: Option<&str>,
) -> MessagesRequest {
    build_request_with_model(DEFAULT_MODEL, mode, concept, learner_ctx, system_prompt, extra_user_text, true)
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

/// Load the mode-specific system prompt by composing shared + mode fragment.
/// Falls back to the monolithic tutor_prompt.txt if fragment files are missing.
pub fn load_system_prompt_for_mode(resource_dir: &std::path::Path, mode: &TutorMode) -> String {
    let shared_path = resource_dir.join("tutor_prompt_shared.txt");
    let mode_file = format!("tutor_prompt_{}.txt", mode.as_str());
    let mode_path = resource_dir.join(&mode_file);

    let shared = match std::fs::read_to_string(&shared_path) {
        Ok(contents) => contents,
        Err(_) => {
            // Fall back to monolithic prompt
            return load_system_prompt(resource_dir);
        }
    };

    let mode_fragment = match std::fs::read_to_string(&mode_path) {
        Ok(contents) => contents,
        Err(_) => {
            // Fall back to monolithic prompt
            return load_system_prompt(resource_dir);
        }
    };

    format!("{}\n\n{}", shared.trim(), mode_fragment.trim())
}

/// Load the full monolithic system prompt (kept for backward compatibility).
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
