use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
use crate::db;
use crate::keychain;
use crate::rate_limit;
use crate::AppState;
use tauri::{Manager, State};

#[tauri::command]
pub async fn get_lesson(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    concept_id: String,
) -> Result<String, String> {
    rate_limit::check_rate_limit("get_lesson")?;

    // Record the lesson view for export/analytics
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let _ = db::lesson_views::insert_lesson_view(&conn, &concept_id, "");
    }

    // Get concept metadata (needed for mastery-aware cache lookup).
    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {concept_id}"))?
    };

    // Check content cache with mastery- and model-aware lookup.
    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let m = db::settings::get_setting(&conn, "base_model")
            .ok()
            .flatten()
            .map(|v| v.trim_matches('"').to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| prompt::DEFAULT_MODEL.to_string());
        if let Some(cached) =
            db::content_cache::get_cached_content_personalized(
                &conn, &concept_id, "lesson",
                Some(concept.mastery_score), Some(&m),
            ).map_err(|e| format!("DB error: {e}"))?
        {
            return Ok(cached.payload_json);
        }
        m
    };

    // Get API key.
    let api_key = keychain::get_api_key_cached(&state)?
        .ok_or_else(|| "API key not configured. Please set your API key in Settings.".to_string())?;

    // Load system prompt.
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = prompt::load_system_prompt(&resource_dir);

    let learner_ctx = LearnerContext::from(&concept);

    let request = prompt::build_request_with_model(
        &model, &TutorMode::Lesson, &concept, &learner_ctx, &system_prompt, None, false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    prompt::log_token_usage(&TutorMode::Lesson, &model, &response);
    let text = extract_text(&response);
    if text.trim().is_empty() {
        return Err("The AI returned an empty lesson. Please try again.".to_string());
    }

    // Cache the result with mastery band tag for personalized invalidation.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let entry = db::content_cache::CachedContent {
            id: None,
            concept_id: concept_id.clone(),
            content_type: "lesson".to_string(),
            payload_json: text.clone(),
            model_version: Some(response.model),
            created_at: chrono::Utc::now().to_rfc3339(),
            content_hash: None,
        };
        let _ = db::content_cache::insert_cache_entry_with_mastery(
            &conn, &entry, Some(concept.mastery_score),
        );
    }

    Ok(text)
}
