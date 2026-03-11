use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
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

/// Input for submitting an answer.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnswerSubmission {
    pub concept_id: String,
    pub correct: bool,
    #[serde(default)]
    pub latency_ms: Option<i64>,
    #[serde(default)]
    pub is_transfer: bool,
}

/// Output after processing an answer.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnswerResult {
    pub new_mastery: f64,
    pub new_ease_factor: f64,
    pub new_interval_days: i64,
    pub next_review: String,
    pub streak_correct: i64,
}

#[tauri::command]
pub fn submit_answer(
    state: State<'_, AppState>,
    submission: AnswerSubmission,
) -> Result<AnswerResult, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let concept = db::concepts::get_concept(&conn, &submission.concept_id)
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("Concept not found: {}", submission.concept_id))?;

    let new_streak = if submission.correct {
        concept.streak_correct + 1
    } else {
        0
    };

    let attempt = mastery::AttemptRecord {
        correct: submission.correct,
        latency_ms: submission.latency_ms,
        is_transfer: submission.is_transfer,
    };

    let new_mastery = if concept.attempt_count == 0 {
        mastery::compute_mastery(&[attempt])
    } else {
        let single_score = mastery::compute_mastery(&[attempt]);
        let weight = 1.0 / (concept.attempt_count as f64 + 1.0);
        concept.mastery_score * (1.0 - weight) + single_score * weight
    };

    let quality = spaced_rep::classify_response(
        submission.correct,
        new_streak,
        submission.latency_ms,
    );
    let schedule = spaced_rep::update_schedule(
        quality,
        concept.ease_factor,
        concept.interval_days,
    );

    let last_correct = if submission.correct {
        Some(chrono::Local::now().format("%Y-%m-%d").to_string())
    } else {
        concept.last_correct.clone()
    };

    db::concepts::update_mastery(
        &conn,
        &submission.concept_id,
        new_mastery,
        schedule.ease_factor,
        schedule.interval_days,
        &schedule.next_review,
        last_correct.as_deref(),
        submission.latency_ms,
        new_streak,
    )
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(AnswerResult {
        new_mastery,
        new_ease_factor: schedule.ease_factor,
        new_interval_days: schedule.interval_days,
        next_review: schedule.next_review,
        streak_correct: new_streak,
    })
}

/// Complete a quiz session and return summary.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizCompletionResult {
    pub total_score: f64,
    pub xp_earned: u32,
}

#[tauri::command]
pub fn complete_quiz(
    _session_id: String,
) -> Result<QuizCompletionResult, String> {
    Ok(QuizCompletionResult {
        total_score: 0.0,
        xp_earned: 0,
    })
}
