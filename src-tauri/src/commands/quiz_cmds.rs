use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
use crate::api::types::{Message, MessagesRequest};
use crate::db;
use crate::engine::{mastery, spaced_rep};
use crate::keychain;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[tauri::command]
pub async fn get_quiz(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    concept_id: String,
) -> Result<String, String> {
    // Check cache.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Some(cached) =
            db::content_cache::get_cached_content(&conn, &concept_id, "quiz")
                .map_err(|e| format!("DB error: {e}"))?
        {
            return Ok(cached.payload_json);
        }
    }

    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {concept_id}"))?
    };

    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = prompt::load_system_prompt(&resource_dir);

    let learner_ctx = LearnerContext::from(&concept);

    // Use user-configured base model if available
    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::settings::get_setting(&conn, "base_model")
            .ok()
            .flatten()
            .map(|v| v.trim_matches('"').to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| prompt::DEFAULT_MODEL.to_string())
    };

    let request = prompt::build_request_with_model(
        &model, &TutorMode::Quiz, &concept, &learner_ctx, &system_prompt, None, false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let text = extract_text(&response);

    // Cache the quiz.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let entry = db::content_cache::CachedContent {
            id: None,
            concept_id: concept_id.clone(),
            content_type: "quiz".to_string(),
            payload_json: text.clone(),
            model_version: Some(response.model),
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        let _ = db::content_cache::insert_cache_entry(&conn, &entry);
    }

    Ok(text)
}

// ── Answer submission (frontend-compatible) ─────────────────────────────────

/// Frontend Answer object — matches the TypeScript Answer type.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendAnswer {
    pub question_id: String,
    #[serde(default)]
    pub selected_option_id: Option<String>,
    #[serde(default)]
    pub free_text: Option<String>,
    #[serde(default)]
    pub filled_blanks: Option<Vec<String>>,
    #[serde(default)]
    pub time_spent_ms: Option<i64>,
}

/// Question context sent alongside the answer so the backend can grade.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionContext {
    pub concept_id: String,
    pub question_type: String,
    pub prompt: String,
    #[serde(default)]
    pub correct_option_id: Option<String>,
    #[serde(default)]
    pub expected_blanks: Option<Vec<String>>,
    #[serde(default)]
    pub rubric: Option<String>,
    #[serde(default)]
    pub explanation: Option<String>,
}

/// Feedback returned to the frontend — matches TypeScript Feedback type.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackResponse {
    pub question_id: String,
    pub is_correct: bool,
    pub score: f64,
    pub explanation: String,
    pub encouragement: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_hint: Option<String>,
}

#[tauri::command]
pub async fn submit_answer(
    state: State<'_, AppState>,
    _session_id: String,
    answer: FrontendAnswer,
    question: QuestionContext,
) -> Result<FeedbackResponse, String> {
    let time_ms = answer.time_spent_ms;

    // Grade the answer based on question type
    let (is_correct, score) = match question.question_type.as_str() {
        "multiple_choice" => {
            let correct = match (&answer.selected_option_id, &question.correct_option_id) {
                (Some(selected), Some(correct)) => selected == correct,
                _ => false,
            };
            (correct, if correct { 1.0 } else { 0.0 })
        }
        "fill_in_blank" => {
            match (&answer.filled_blanks, &question.expected_blanks) {
                (Some(filled), Some(expected)) => {
                    let mut matches = 0;
                    for (f, e) in filled.iter().zip(expected.iter()) {
                        if f.trim().eq_ignore_ascii_case(e.trim()) {
                            matches += 1;
                        }
                    }
                    let total = expected.len().max(1);
                    let score = matches as f64 / total as f64;
                    (score >= 0.999, score)
                }
                _ => (false, 0.0),
            }
        }
        "free_response" => {
            // Call AI to grade free-response answers
            match grade_free_response(&state, &question.prompt, answer.free_text.as_deref().unwrap_or(""), question.rubric.as_deref()).await {
                Ok((correct, s)) => (correct, s),
                Err(_) => {
                    // Fallback: give partial credit and let user re-grade
                    (false, 0.3)
                }
            }
        }
        _ => (false, 0.0),
    };

    // Update mastery for the concept
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Ok(Some(concept)) = db::concepts::get_concept(&conn, &question.concept_id) {
            let new_streak = if is_correct { concept.streak_correct + 1 } else { 0 };

            let attempt = mastery::AttemptRecord {
                correct: is_correct,
                latency_ms: time_ms,
                is_transfer: false,
            };

            let new_mastery = if concept.attempt_count == 0 {
                mastery::compute_mastery(&[attempt])
            } else {
                let single_score = mastery::compute_mastery(&[attempt]);
                let weight = 1.0 / (concept.attempt_count as f64 + 1.0);
                concept.mastery_score * (1.0 - weight) + single_score * weight
            };

            let quality = spaced_rep::classify_response(is_correct, new_streak, time_ms);
            let schedule = spaced_rep::update_schedule(quality, concept.ease_factor, concept.interval_days);

            let last_correct = if is_correct {
                Some(chrono::Local::now().format("%Y-%m-%d").to_string())
            } else {
                concept.last_correct.clone()
            };

            let _ = db::concepts::update_mastery(
                &conn,
                &question.concept_id,
                new_mastery,
                schedule.ease_factor,
                schedule.interval_days,
                &schedule.next_review,
                last_correct.as_deref(),
                time_ms,
                new_streak,
            );
        }
    }

    let explanation = question.explanation.unwrap_or_else(|| {
        if is_correct {
            "Correct! Well done.".to_string()
        } else {
            "Not quite right. Review the concept and try again.".to_string()
        }
    });

    let encouragement = if is_correct {
        "Great job! Keep up the good work!".to_string()
    } else if score > 0.0 {
        "Good effort! You're on the right track.".to_string()
    } else {
        "Don't worry, mistakes help us learn. Try reviewing the lesson.".to_string()
    };

    Ok(FeedbackResponse {
        question_id: answer.question_id,
        is_correct,
        score,
        explanation,
        encouragement,
        next_hint: None,
    })
}

/// Call AI to grade a free-response answer.
async fn grade_free_response(
    state: &State<'_, AppState>,
    question_prompt: &str,
    user_answer: &str,
    rubric: Option<&str>,
) -> Result<(bool, f64), String> {
    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::settings::get_setting(&conn, "base_model")
            .ok()
            .flatten()
            .map(|v| v.trim_matches('"').to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| prompt::DEFAULT_MODEL.to_string())
    };

    let rubric_text = rubric.unwrap_or("Grade based on mathematical correctness and completeness.");

    let system = "You are a math grader. Grade the student's answer. \
         Respond with ONLY a JSON object: {\"correct\": bool, \"score\": 0.0-1.0}. \
         Give partial credit for partially correct work."
        .to_string();

    let user_msg = format!(
        "<question>{question_prompt}</question>\n\
         <answer>{user_answer}</answer>\n\
         <rubric>{rubric_text}</rubric>"
    );

    let request = MessagesRequest::new(&model, 256, Some(system), vec![Message::user_text(&user_msg)], false);
    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let text = extract_text(&response);

    #[derive(Deserialize)]
    struct GradeResult {
        correct: bool,
        score: f64,
    }

    let json_str = text.trim()
        .strip_prefix("```json").or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim())
        .strip_suffix("```").unwrap_or(text.trim()).trim();

    match serde_json::from_str::<GradeResult>(json_str) {
        Ok(parsed) => Ok((parsed.correct, parsed.score)),
        Err(_) => Ok((false, 0.3)), // Fallback partial credit
    }
}

// ── Complete Quiz ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizCompletionResult {
    pub total_score: f64,
    pub xp_earned: u32,
}

#[tauri::command]
pub fn complete_quiz(
    state: State<'_, AppState>,
    session_id: String,
    scores: Vec<f64>,
) -> Result<QuizCompletionResult, String> {
    let total_score = if scores.is_empty() {
        0.0
    } else {
        scores.iter().sum::<f64>() / scores.len() as f64
    };

    // Calculate XP based on score
    let base_xp = 10u32;
    let bonus_xp = (total_score * 40.0) as u32; // Up to 40 bonus XP for perfect score
    let xp_earned = base_xp + bonus_xp;

    // Award XP via settings
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let current_xp = db::settings::get_setting(&conn, "total_xp")
            .map_err(|e| format!("DB error: {e}"))?
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0);

        let new_xp = current_xp + xp_earned as i64;
        let _ = db::settings::set_setting(&conn, "total_xp", &new_xp.to_string());

        // Log the quiz completion
        eprintln!("Quiz {} completed: score={:.2}, xp={}", session_id, total_score, xp_earned);
    }

    Ok(QuizCompletionResult {
        total_score,
        xp_earned,
    })
}
