use crate::api::client::{extract_text, ClaudeClient};
use crate::api::types::{ContentBlock, ImageSource, Message, MessagesRequest};
use crate::db;
use crate::keychain;
use crate::rate_limit;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

/// Maximum length for string parameters sent to AI commands (characters).
const MAX_INPUT_LEN: usize = 10_000;

/// Default models — can be overridden by user settings.
const FALLBACK_BASE_MODEL: &str = "claude-sonnet-4-20250514";
const FALLBACK_ESCALATION_MODEL: &str = "claude-opus-4-6";

/// Escape user-supplied content for safe interpolation into XML-structured prompts.
/// Prevents prompt injection via XML tag breakout.
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Settings keys that must never appear in exported data.
const SENSITIVE_KEYS: &[&str] = &[
    "api_key", "auth_token", "password", "secret", "token",
];

/// Helper: get the configured base model from settings, falling back to default.
pub(crate) fn get_base_model(conn: &rusqlite::Connection) -> String {
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
    rate_limit::check_rate_limit("explain_mistake")?;

    // Validate input lengths to prevent token exhaustion / DoS
    for (name, val) in [
        ("question_prompt", &question_prompt),
        ("user_answer", &user_answer),
        ("correct_answer", &correct_answer),
        ("context", &context),
    ] {
        if val.len() > MAX_INPUT_LEN {
            return Err(format!("{name} exceeds maximum length of {MAX_INPUT_LEN} characters."));
        }
    }

    let api_key = keychain::get_api_key_cached(&state)?
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
        "<question>{}</question>\n\n\
         <student_answer>{}</student_answer>\n\n\
         <correct_explanation>{}</correct_explanation>\n\n\
         <context>{}</context>\n\n\
         Please explain the student's mistake and help them understand the correct approach.",
        xml_escape(&question_prompt),
        xml_escape(&user_answer),
        xml_escape(&correct_answer),
        xml_escape(&context),
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
    rate_limit::check_rate_limit("regrade_with_reasoning")?;

    // Validate input lengths
    for (name, val) in [
        ("question_prompt", &question_prompt),
        ("user_answer", &user_answer),
        ("rubric", &rubric),
    ] {
        if val.len() > MAX_INPUT_LEN {
            return Err(format!("{name} exceeds maximum length of {MAX_INPUT_LEN} characters."));
        }
    }

    let api_key = keychain::get_api_key_cached(&state)?
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
        "<question>{}</question>\n\n\
         <student_answer>{}</student_answer>\n\n\
         <rubric>{}</rubric>\n\n\
         Re-grade this answer carefully. Consider partial credit.",
        xml_escape(&question_prompt),
        xml_escape(&user_answer),
        xml_escape(&rubric),
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
            score: parsed.score.clamp(0.0, 1.0),
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
    // Return known models directly — no need to waste an API call since the
    // result is the same regardless of connection status.
    Ok(known_models())
}

// ── Request Explanation (Lesson) ────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationResponse {
    pub content: String,
    pub strategy: String,
    pub next_strategy: Option<String>,
}

#[tauri::command]
pub async fn request_explanation(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    concept_id: String,
    _lesson_id: String,
    attempt: u32,
) -> Result<ExplanationResponse, String> {
    rate_limit::check_rate_limit("request_explanation")?;

    let api_key = keychain::get_api_key_cached(&state)?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {concept_id}"))?
    };

    // Escalate to reasoning model after multiple attempts
    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if attempt >= 3 {
            get_escalation_model(&conn)
        } else {
            get_base_model(&conn)
        }
    };

    let strategies = ["default", "analogy", "visual", "step_by_step", "basics_review"];
    let strategy = strategies.get(attempt as usize % strategies.len()).unwrap_or(&"default");
    let next_strategy = strategies.get((attempt as usize + 1) % strategies.len()).map(|s| s.to_string());

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = crate::api::prompt::load_system_prompt(&resource_dir);

    let system = format!(
        "{}\n\nThe student is requesting an additional explanation (attempt #{}) for the concept below. \
         Use the '{}' strategy: {}. \
         Use LaTeX notation wrapped in $ delimiters for math. Be encouraging.",
        system_prompt,
        attempt + 1,
        strategy,
        match *strategy {
            "analogy" => "Explain using real-world analogies the student can relate to",
            "visual" => "Describe the concept using a text-based visual approach: ASCII diagrams, tables, number lines, or LaTeX-formatted expressions. Do NOT reference or generate images. Structure the explanation spatially using formatting the student can read as plain text.",
            "step_by_step" => "Break down into very small, numbered steps",
            "basics_review" => "Review the fundamental prerequisite concepts first",
            _ => "Explain in a clear, straightforward manner",
        }
    );

    let user_msg = format!(
        "<concept>\n  <id>{}</id>\n  <title>{}</title>\n  <domain>{}</domain>\n  <module>{}</module>\n</concept>\n\n\
         Please explain this concept again using the {} approach.",
        xml_escape(&concept.id), xml_escape(&concept.title), xml_escape(&concept.domain), xml_escape(&concept.module), strategy
    );

    let request = MessagesRequest::new(&model, 2048, Some(system), vec![Message::user_text(&user_msg)], false);
    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;

    Ok(ExplanationResponse {
        content: extract_text(&response),
        strategy: strategy.to_string(),
        next_strategy,
    })
}

// ── Verify No Right Answer (MC) ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoRightAnswerResult {
    pub confirmed: bool,
    pub explanation: String,
}

#[tauri::command]
pub async fn verify_no_right_answer(
    state: State<'_, AppState>,
    question_prompt: String,
    options: Vec<String>,
) -> Result<NoRightAnswerResult, String> {
    rate_limit::check_rate_limit("verify_no_right_answer")?;

    // Validate input lengths
    if question_prompt.len() > MAX_INPUT_LEN {
        return Err(format!("question_prompt exceeds maximum length of {MAX_INPUT_LEN} characters."));
    }
    for opt in &options {
        if opt.len() > MAX_INPUT_LEN {
            return Err(format!("Option text exceeds maximum length of {MAX_INPUT_LEN} characters."));
        }
    }

    let api_key = keychain::get_api_key_cached(&state)?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        get_escalation_model(&conn)
    };

    let options_text = options.iter().enumerate()
        .map(|(i, o)| format!("  {}. {}", (b'A' + i as u8) as char, xml_escape(o)))
        .collect::<Vec<_>>()
        .join("\n");

    let system = "You are an expert math evaluator. A student claims none of the answer options are correct. \
         Carefully verify each option. Respond with JSON: {\"confirmed\": bool, \"explanation\": \"...\"}. \
         Set confirmed=true ONLY if genuinely no option is correct. Only output JSON."
        .to_string();

    let user_msg = format!(
        "<question>{}</question>\n\n<options>\n{options_text}\n</options>\n\n\
         Is it true that none of these options are correct? Verify carefully.",
        xml_escape(&question_prompt),
    );

    let request = MessagesRequest::new(&model, 512, Some(system), vec![Message::user_text(&user_msg)], false);
    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let text = extract_text(&response);

    #[derive(Deserialize)]
    struct RawResult {
        confirmed: bool,
        explanation: String,
    }

    let json_str = text.trim()
        .strip_prefix("```json").or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim())
        .strip_suffix("```").unwrap_or(text.trim()).trim();

    match serde_json::from_str::<RawResult>(json_str) {
        Ok(parsed) => Ok(NoRightAnswerResult {
            confirmed: parsed.confirmed,
            explanation: parsed.explanation,
        }),
        Err(_) => Ok(NoRightAnswerResult {
            confirmed: false,
            explanation: "Unable to verify. Please try selecting an answer.".to_string(),
        }),
    }
}

// ── Mastery History ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasteryDataPoint {
    pub date: String,
    pub domain: String,
    pub score: f64,
}

#[tauri::command]
pub fn get_mastery_history(state: State<'_, AppState>) -> Result<Vec<MasteryDataPoint>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let concepts = db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;

    // Compute today's average mastery per domain and record snapshots
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut domain_scores: std::collections::HashMap<String, Vec<f64>> = std::collections::HashMap::new();
    for c in &concepts {
        domain_scores.entry(c.domain.clone()).or_default().push(c.mastery_score);
    }
    for (domain, scores) in &domain_scores {
        let avg = scores.iter().sum::<f64>() / scores.len() as f64;
        let _ = db::mastery_snapshots::upsert_snapshot(&conn, &today, domain, avg);
    }

    // Return recent snapshots (90-day window) to avoid sending unbounded data
    let snapshots = db::mastery_snapshots::get_snapshots_since(&conn, None)
        .map_err(|e| format!("DB error: {e}"))?;

    Ok(snapshots.into_iter().map(|s| MasteryDataPoint {
        date: s.date,
        domain: s.domain,
        score: s.score,
    }).collect())
}

// ── Review Forecast ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewForecastItem {
    pub concept_id: String,
    pub concept_name: String,
    pub due_date: String,
    pub domain: String,
}

#[tauri::command]
pub fn get_review_forecast(state: State<'_, AppState>) -> Result<Vec<ReviewForecastItem>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let concepts = db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;

    let mut forecast: Vec<ReviewForecastItem> = concepts
        .iter()
        .filter_map(|c| {
            c.next_review.as_ref().map(|date| ReviewForecastItem {
                concept_id: c.id.clone(),
                concept_name: c.title.clone(),
                due_date: date.clone(),
                domain: c.domain.clone(),
            })
        })
        .collect();

    forecast.sort_by(|a, b| a.due_date.cmp(&b.due_date));
    // Return next 30 upcoming reviews
    forecast.truncate(30);
    Ok(forecast)
}

// ── Activate Streak Freeze ──────────────────────────────────────────────────

#[tauri::command]
pub fn activate_streak_freeze(state: State<'_, AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let freezes = db::settings::get_setting(&conn, "streak_freezes_available")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(1); // Default 1 free freeze

    if freezes <= 0 {
        return Ok(false);
    }

    // Use a freeze
    db::settings::set_setting(&conn, "streak_freezes_available", &(freezes - 1).to_string())
        .map_err(|e| format!("DB error: {e}"))?;
    db::settings::set_setting(&conn, "streak_freeze_active", "true")
        .map_err(|e| format!("DB error: {e}"))?;

    Ok(true)
}

// ── Get Submissions ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionInfo {
    pub id: i64,
    pub project_id: Option<String>,
    pub file_name: String,
    pub file_type: String,
    pub file_path: String,
    pub submitted_at: String,
    pub status: String,
    pub feedback: Option<String>,
}

#[tauri::command]
pub fn get_submissions(
    state: State<'_, AppState>,
    project_id: Option<String>,
) -> Result<Vec<SubmissionInfo>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let subs = match project_id {
        Some(pid) => db::submissions::get_submissions_for_project(&conn, &pid)
            .map_err(|e| format!("DB error: {e}"))?,
        None => db::submissions::get_recent_submissions(&conn, 50)
            .map_err(|e| format!("DB error: {e}"))?,
    };

    Ok(subs.into_iter().map(|s| {
        let file_path = s.file_path.clone().unwrap_or_default();
        let file_name = std::path::Path::new(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        SubmissionInfo {
            id: s.id.unwrap_or(0),
            project_id: s.project_id,
            file_name: file_name.clone(),
            file_type: s.mime_type.unwrap_or_else(|| "application/octet-stream".to_string()),
            // Expose only the file name, not the full absolute path (privacy)
            file_path: file_name,
            submitted_at: s.submitted_at,
            status: s.status,
            feedback: s.feedback_json,
        }
    }).collect())
}

// ── Get Submission Feedback ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackResultInfo {
    pub submission_id: String,
    pub verdict: String,
    pub overall_score: f64,
    pub strengths: Vec<String>,
    pub areas_for_improvement: Vec<String>,
    pub next_steps: Vec<String>,
    pub detailed_comments: String,
    pub evaluated_at: String,
    pub xp_earned: u32,
}

#[tauri::command]
pub fn get_submission_feedback(
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<Option<FeedbackResultInfo>, String> {
    let id: i64 = submission_id.parse().map_err(|_| "Invalid submission ID".to_string())?;
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let sub = db::submissions::get_submission(&conn, id)
        .map_err(|e| format!("DB error: {e}"))?;

    match sub {
        Some(s) if s.status == "reviewed" && s.feedback_json.is_some() => {
            let feedback_text = s.feedback_json.unwrap_or_default();

            // Try to parse structured feedback from the AI response
            #[derive(Deserialize)]
            struct ParsedFeedback {
                #[serde(default)]
                verdict: Option<String>,
                #[serde(default, alias = "overall_score")]
                overall_score: Option<f64>,
                #[serde(default)]
                strengths: Option<Vec<String>>,
                #[serde(default, alias = "areas_for_improvement")]
                areas_for_improvement: Option<Vec<String>>,
                #[serde(default, alias = "next_steps")]
                next_steps: Option<Vec<String>>,
                #[serde(default, alias = "detailed_comments")]
                detailed_comments: Option<String>,
                #[serde(default, alias = "xp_earned")]
                xp_earned: Option<u32>,
            }

            // Strip markdown code fences if present
            let json_str = feedback_text.trim()
                .strip_prefix("```json").or_else(|| feedback_text.trim().strip_prefix("```"))
                .unwrap_or(feedback_text.trim())
                .strip_suffix("```").unwrap_or(feedback_text.trim()).trim();

            let parsed = serde_json::from_str::<ParsedFeedback>(json_str).ok();

            Ok(Some(FeedbackResultInfo {
                submission_id: id.to_string(),
                verdict: parsed.as_ref()
                    .and_then(|p| p.verdict.clone())
                    .unwrap_or_else(|| "pass".to_string()),
                overall_score: parsed.as_ref()
                    .and_then(|p| p.overall_score)
                    .unwrap_or(0.0),
                strengths: parsed.as_ref()
                    .and_then(|p| p.strengths.clone())
                    .unwrap_or_default(),
                areas_for_improvement: parsed.as_ref()
                    .and_then(|p| p.areas_for_improvement.clone())
                    .unwrap_or_default(),
                next_steps: parsed.as_ref()
                    .and_then(|p| p.next_steps.clone())
                    .unwrap_or_default(),
                detailed_comments: parsed.as_ref()
                    .and_then(|p| p.detailed_comments.clone())
                    .unwrap_or_else(|| feedback_text.clone()),
                evaluated_at: s.submitted_at,
                xp_earned: parsed.as_ref()
                    .and_then(|p| p.xp_earned)
                    .unwrap_or(0),
            }))
        }
        _ => Ok(None),
    }
}

// ── Export Data ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn export_data(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let concepts = db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;
    let settings = db::settings::get_all_settings(&conn).map_err(|e| format!("DB error: {e}"))?;
    let submissions = db::submissions::get_recent_submissions(&conn, 1000)
        .map_err(|e| format!("DB error: {e}"))?;

    // Include quiz/lesson history from content cache
    let quiz_history: Vec<_> = concepts
        .iter()
        .flat_map(|c| {
            db::content_cache::get_cache_for_concept(&conn, &c.id)
                .unwrap_or_default()
        })
        .collect();

    // Include XP event history
    let xp_events = db::xp_events::get_all_xp_events(&conn)
        .map_err(|e| format!("DB error: {e}"))?;

    // Include mastery history
    let mastery_snapshots = db::mastery_snapshots::get_all_snapshots(&conn)
        .map_err(|e| format!("DB error: {e}"))?;

    // Filter out sensitive settings (API keys, tokens, passwords)
    let safe_settings: Vec<_> = settings
        .into_iter()
        .filter(|(k, _)| {
            let lower = k.to_lowercase();
            !SENSITIVE_KEYS.iter().any(|s| lower.contains(s))
        })
        .map(|(k, v)| serde_json::json!({"key": k, "value": v}))
        .collect();

    let export = serde_json::json!({
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "version": "1.2",
        "concepts": concepts,
        "settings": safe_settings,
        "submissions": submissions,
        "contentHistory": quiz_history,
        "xpEvents": xp_events,
        "masterySnapshots": mastery_snapshots,
    });

    serde_json::to_string_pretty(&export).map_err(|e| format!("Serialization error: {e}"))
}
