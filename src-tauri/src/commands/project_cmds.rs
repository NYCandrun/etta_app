use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, LearnerContext, TutorMode};
use crate::api::types::{ContentBlock, DocumentSource, ImageSource, Message, MessageContent};
use crate::db;
use crate::file_handler;
use crate::keychain;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

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

    let api_key = keychain::get_api_key()?
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
