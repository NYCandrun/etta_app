use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
use crate::db;
use crate::keychain;
use crate::AppState;
use tauri::State;

/// Bucket mastery into coarse tiers for cache keying.
fn mastery_bucket(score: f64) -> &'static str {
    if score < 0.3 {
        "low"
    } else if score <= 0.6 {
        "mid"
    } else {
        "high"
    }
}

#[tauri::command]
pub async fn get_lesson(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    concept_id: String,
) -> Result<String, String> {
    // Resolve model early so we can include it in the cache key.
    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::settings::get_setting(&conn, "base_model")
            .ok()
            .flatten()
            .map(|v| v.trim_matches('"').to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| prompt::DEFAULT_MODEL.to_string())
    };

    // Get concept metadata (needed for cache key and request).
    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {concept_id}"))?
    };

    // Context-aware cache: match model + mastery bucket.
    let bucket = mastery_bucket(concept.mastery_score);
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Some(cached) =
            db::content_cache::get_cached_content_ctx(&conn, &concept_id, "lesson", &model, bucket)
                .map_err(|e| format!("DB error: {e}"))?
        {
            return Ok(cached.payload_json);
        }
    }

    // Get API key.
    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "API key not configured. Please set your API key in Settings.".to_string())?;

    // Load mode-specific system prompt (shared + lesson fragment only).
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = prompt::load_system_prompt_for_mode(&resource_dir, &TutorMode::Lesson);

    let learner_ctx = LearnerContext::from(&concept);

    let request = prompt::build_request_with_model(
        &model, &TutorMode::Lesson, &concept, &learner_ctx, &system_prompt, None, false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let text = extract_text(&response);

    // Log token usage.
    eprintln!(
        "[lesson] concept={} model={} in={} out={} stop={}",
        concept_id, response.model, response.usage.input_tokens, response.usage.output_tokens,
        response.stop_reason.as_deref().unwrap_or("none")
    );

    // Cache the result with context key.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let entry = db::content_cache::CachedContent {
            id: None,
            concept_id: concept_id.clone(),
            content_type: "lesson".to_string(),
            payload_json: text.clone(),
            model_version: Some(response.model),
            context_key: Some(bucket.to_string()),
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        let _ = db::content_cache::insert_cache_entry(&conn, &entry);
    }

    Ok(text)
}
