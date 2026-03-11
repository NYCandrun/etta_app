use super::types::{Message, MessagesRequest};
use crate::db::concepts::Concept;
use serde::{Deserialize, Serialize};

pub const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS: u32 = 4096;

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

    MessagesRequest::new(
        model,
        DEFAULT_MAX_TOKENS,
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
