use crate::api::client::{extract_text, ClaudeClient};
use crate::api::types::{ContentBlock, ImageSource, Message, MessagesRequest};
use crate::db;
use crate::keychain;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Default models — can be overridden by user settings.
const FALLBACK_BASE_MODEL: &str = "claude-sonnet-4-20250514";
const FALLBACK_ESCALATION_MODEL: &str = "claude-opus-4-6";

/// Helper: get the configured base model from settings, falling back to default.
fn get_base_model(conn: &rusqlite::Connection) -> String {
    db::settings::get_setting(conn, "base_model")
        .ok()
        .flatten()
        .map(|v| v.trim_matches('"').to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| FALLBACK_BASE_MODEL.to_string())
}

/// Helper: get the configured escalation model from settings, falling back to default.
fn get_escalation_model(conn: &rusqlite::Connection) -> String {
    db::settings::get_setting(conn, "escalation_model")
        .ok()
        .flatten()
        .map(|v| v.trim_matches('"').to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| FALLBACK_ESCALATION_MODEL.to_string())
}

// ── Explain Mistake ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn explain_mistake(
    state: State<'_, AppState>,
    question_prompt: String,
    user_answer: String,
    correct_answer: String,
    context: String,
    escalate: bool,
) -> Result<String, String> {
    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if escalate {
            get_escalation_model(&conn)
        } else {
            get_base_model(&conn)
        }
    };

    let system = format!(
        "You are a patient, encouraging math tutor. \
         The student got a question wrong and needs help understanding their mistake. \
         Explain clearly what went wrong and guide them toward the correct understanding. \
         Use LaTeX notation wrapped in $ delimiters for any math expressions. \
         Keep the explanation concise but thorough.{}",
        if escalate {
            " Think step by step and provide a detailed, alternative explanation \
             that approaches the concept from a different angle."
        } else {
            ""
        }
    );

    let user_msg = format!(
        "<question>{question_prompt}</question>\n\n\
         <student_answer>{user_answer}</student_answer>\n\n\
         <correct_explanation>{correct_answer}</correct_explanation>\n\n\
         <context>{context}</context>\n\n\
         Please explain the student's mistake and help them understand the correct approach."
    );

    let request = MessagesRequest::new(
        &model,
        2048,
        Some(system),
        vec![Message::user_text(&user_msg)],
        false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    Ok(extract_text(&response))
}

// ── Re-grade with Reasoning ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegradeResult {
    pub is_correct: bool,
    pub score: f64,
    pub explanation: String,
}

#[tauri::command]
pub async fn regrade_with_reasoning(
    state: State<'_, AppState>,
    question_prompt: String,
    user_answer: String,
    rubric: String,
    file_data: Option<String>,
    file_mime_type: Option<String>,
) -> Result<RegradeResult, String> {
    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        get_escalation_model(&conn)
    };

    let system = "You are an expert math grader using careful reasoning. \
         Re-evaluate the student's answer thoroughly. \
         Consider partial credit for partially correct work. \
         If the student uploaded handwritten work, examine it carefully. \
         Respond with a JSON object: {\"isCorrect\": bool, \"score\": 0.0-1.0, \"explanation\": \"...\"}. \
         Only output the JSON, no other text."
        .to_string();

    let user_text = format!(
        "<question>{question_prompt}</question>\n\n\
         <student_answer>{user_answer}</student_answer>\n\n\
         <rubric>{rubric}</rubric>\n\n\
         Re-grade this answer carefully. Consider partial credit."
    );

    // Build message content — include image if file data provided
    let messages = if let (Some(data), Some(mime)) = (&file_data, &file_mime_type) {
        if mime.starts_with("image/") {
            vec![Message::user_blocks(vec![
                ContentBlock::Image {
                    source: ImageSource {
                        source_type: "base64".to_string(),
                        media_type: mime.clone(),
                        data: data.clone(),
                    },
                },
                ContentBlock::Text { text: user_text },
            ])]
        } else {
            vec![Message::user_text(&user_text)]
        }
    } else {
        vec![Message::user_text(&user_text)]
    };

    let request = MessagesRequest::new(&model, 1024, Some(system), messages, false);

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let text = extract_text(&response);

    // Parse the JSON response
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RawRegrade {
        is_correct: bool,
        score: f64,
        explanation: String,
    }

    // Try to extract JSON from the response (it might be wrapped in markdown code fences)
    let json_str = text
        .trim()
        .strip_prefix("```json")
        .or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim())
        .strip_suffix("```")
        .unwrap_or(text.trim())
        .trim();

    match serde_json::from_str::<RawRegrade>(json_str) {
        Ok(parsed) => Ok(RegradeResult {
            is_correct: parsed.is_correct,
            score: parsed.score,
            explanation: parsed.explanation,
        }),
        Err(_) => {
            // If JSON parsing fails, return the raw text as explanation
            Ok(RegradeResult {
                is_correct: false,
                score: 0.0,
                explanation: text,
            })
        }
    }
}

// ── List Available Models ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableModel {
    pub id: String,
    pub display_name: String,
}

/// Known Claude models with display names.
fn known_models() -> Vec<AvailableModel> {
    vec![
        AvailableModel {
            id: "claude-haiku-4-5-20251001".to_string(),
            display_name: "Claude Haiku 4.5".to_string(),
        },
        AvailableModel {
            id: "claude-sonnet-4-20250514".to_string(),
            display_name: "Claude Sonnet 4".to_string(),
        },
        AvailableModel {
            id: "claude-sonnet-4-6".to_string(),
            display_name: "Claude Sonnet 4.6".to_string(),
        },
        AvailableModel {
            id: "claude-opus-4-6".to_string(),
            display_name: "Claude Opus 4.6".to_string(),
        },
    ]
}

#[tauri::command]
pub async fn list_available_models() -> Result<Vec<AvailableModel>, String> {
    // Try to discover models from the API
    match keychain::get_api_key() {
        Ok(Some(api_key)) => {
            // Attempt to validate the key and return known models if valid
            let client = ClaudeClient::new(&api_key);
            match client.test_connection().await {
                Ok(true) => Ok(known_models()),
                _ => Ok(known_models()),
            }
        }
        _ => Ok(known_models()),
    }
}
