use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
use crate::api::types::{ContentBlock, DocumentSource, ImageSource, Message, MessageContent};
use crate::db;
use crate::engine::{mastery, spaced_rep};
use crate::file_handler;
use crate::keychain;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

#[derive(Debug, Serialize)]
pub struct ProjectInfo {
    pub id: i64,
    pub concept_id: String,
    pub project_id: Option<String>,
    pub file_path: Option<String>,
    pub status: String,
    pub feedback: Option<String>,
    pub submitted_at: String,
}

#[tauri::command]
pub fn get_projects(
    state: State<'_, AppState>,
    concept_id: Option<String>,
) -> Result<Vec<ProjectInfo>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let subs = match concept_id {
        Some(cid) => db::submissions::get_submissions_for_concept(&conn, &cid)
            .map_err(|e| format!("DB error: {e}"))?,
        None => db::submissions::get_recent_submissions(&conn, 50)
            .map_err(|e| format!("DB error: {e}"))?,
    };

    Ok(subs
        .into_iter()
        .map(|s| ProjectInfo {
            id: s.id.unwrap_or(0),
            concept_id: s.concept_id,
            project_id: s.project_id,
            file_path: s.file_path,
            status: s.status,
            feedback: s.feedback_json,
            submitted_at: s.submitted_at,
        })
        .collect())
}

#[derive(Debug, Deserialize)]
pub struct ProjectSubmission {
    pub concept_id: String,
    pub project_id: String,
    pub file_path: String,
}

#[tauri::command]
pub async fn submit_project(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    submission: ProjectSubmission,
) -> Result<ProjectInfo, String> {
    // Process the file.
    let processed = file_handler::process_file(&submission.file_path)?;

    // Create a pending submission record.
    let now = chrono::Utc::now().to_rfc3339();
    let sub = db::submissions::Submission {
        id: None,
        concept_id: submission.concept_id.clone(),
        project_id: Some(submission.project_id.clone()),
        file_path: Some(submission.file_path.clone()),
        mime_type: Some(processed.mime_type.clone()),
        feedback_json: None,
        status: "pending".to_string(),
        submitted_at: now.clone(),
    };

    let sub_id = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::submissions::insert_submission(&conn, &sub)
            .map_err(|e| format!("DB error: {e}"))?
    };

    // Get concept for context.
    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &submission.concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {}", submission.concept_id))?
    };

    let api_key = keychain::get_api_key_cached(&state)?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = prompt::load_system_prompt(&resource_dir);

    // Build the API request with the file attached.
    let learner_ctx = LearnerContext::from(&concept);
    let user_text = format!(
        "<mode>evaluate</mode>\n\n\
         <concept>\n  <id>{}</id>\n  <title>{}</title>\n  <domain>{}</domain>\n  <module>{}</module>\n</concept>\n\n\
         <learner_context>\n  <mastery_score>{:.2}</mastery_score>\n  <attempt_count>{}</attempt_count>\n</learner_context>\n\n\
         Please evaluate the attached project submission for the concept above.",
        concept.id, concept.title, concept.domain, concept.module,
        learner_ctx.mastery_score, learner_ctx.attempt_count
    );

    // Build content blocks with the file.
    let file_block = build_file_content_block(&processed)?;
    let text_block = ContentBlock::Text {
        text: user_text,
    };

    let messages = vec![Message::user_blocks(vec![text_block, file_block])];

    let model = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        crate::commands::ai_cmds::get_base_model(&conn)
    };

    let request = crate::api::types::MessagesRequest::new(
        &model,
        4096,
        Some(system_prompt),
        messages,
        false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    let feedback = extract_text(&response);

    // Update the submission with feedback.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::submissions::update_submission(&conn, sub_id, "reviewed", Some(&feedback))
            .map_err(|e| format!("DB error: {e}"))?;
    }

    // Parse the AI feedback score and update concept mastery.
    // Project submissions count as practice — a reviewed project with a score
    // updates mastery the same way a quiz answer does.
    {
        let score = parse_project_score(&feedback);
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Ok(Some(concept)) = db::concepts::get_concept(&conn, &submission.concept_id) {
            let is_correct = score >= 0.7;
            let new_streak = if is_correct { concept.streak_correct + 1 } else { 0 };

            let attempt = mastery::AttemptRecord {
                correct: is_correct,
                latency_ms: None,
                is_transfer: true, // projects are application/transfer tasks
            };

            let new_mastery = if concept.attempt_count == 0 {
                mastery::compute_mastery(&[attempt])
            } else {
                let single_score = mastery::compute_mastery(&[attempt]);
                let weight = 1.0 / (concept.attempt_count as f64 + 1.0);
                concept.mastery_score * (1.0 - weight) + single_score * weight
            };

            let quality = spaced_rep::classify_response(is_correct, new_streak, None);
            let schedule = spaced_rep::update_schedule(quality, concept.ease_factor, concept.interval_days);

            let last_correct = if is_correct {
                Some(chrono::Local::now().format("%Y-%m-%d").to_string())
            } else {
                concept.last_correct.clone()
            };

            let _ = db::concepts::update_mastery(
                &conn,
                &submission.concept_id,
                new_mastery,
                schedule.ease_factor,
                schedule.interval_days,
                &schedule.next_review,
                last_correct.as_deref(),
                None,
                new_streak,
            );

            // Award XP atomically with the mastery update (same db lock)
            let xp_amount = (10.0 + score * 30.0) as i64;
            let xp_amount = xp_amount.clamp(1, 50);
            let current_xp = db::settings::get_setting(&conn, "total_xp")
                .ok()
                .flatten()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(0);
            let _ = db::settings::set_setting(&conn, "total_xp", &(current_xp + xp_amount).to_string());
            let _ = db::xp_events::insert_xp_event(
                &conn, xp_amount, "project_submission",
                &format!("Project for {}", concept.title),
            );
        }
    }

    Ok(ProjectInfo {
        id: sub_id,
        concept_id: submission.concept_id,
        project_id: Some(submission.project_id),
        file_path: Some(submission.file_path),
        status: "reviewed".to_string(),
        feedback: Some(feedback),
        submitted_at: now,
    })
}

/// Extract an overall score (0.0–1.0) from the AI project feedback.
/// Looks for an `overall_score` field in JSON, falls back to 0.5 for reviewed work.
fn parse_project_score(feedback: &str) -> f64 {
    #[derive(Deserialize)]
    struct FeedbackScore {
        #[serde(default, alias = "overall_score")]
        overall_score: Option<f64>,
        #[serde(default)]
        score: Option<f64>,
    }

    let json_str = feedback.trim()
        .strip_prefix("```json").or_else(|| feedback.trim().strip_prefix("```"))
        .unwrap_or(feedback.trim())
        .strip_suffix("```").unwrap_or(feedback.trim()).trim();

    if let Ok(parsed) = serde_json::from_str::<FeedbackScore>(json_str) {
        if let Some(s) = parsed.overall_score.or(parsed.score) {
            return s.clamp(0.0, 1.0);
        }
    }

    // If we can't parse a score, give default credit for submitting work
    0.5
}

fn build_file_content_block(
    file: &file_handler::ProcessedFile,
) -> Result<ContentBlock, String> {
    let mime = &file.mime_type;

    if mime.starts_with("image/") {
        Ok(ContentBlock::Image {
            source: ImageSource {
                source_type: "base64".to_string(),
                media_type: mime.clone(),
                data: file.data_base64.clone(),
            },
        })
    } else if mime == "application/pdf"
        || mime.contains("officedocument")
        || mime.starts_with("text/")
    {
        Ok(ContentBlock::Document {
            source: DocumentSource {
                source_type: "base64".to_string(),
                media_type: mime.clone(),
                data: file.data_base64.clone(),
            },
            cache_control: None,
        })
    } else {
        // Fallback: send as base64-encoded text description.
        Ok(ContentBlock::Text {
            text: format!(
                "[Attached file: {} ({}, {} bytes)]",
                file.file_name, mime, file.size_bytes
            ),
        })
    }
}
