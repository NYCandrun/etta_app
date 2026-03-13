use crate::api::client::{extract_text, ClaudeClient};
use crate::api::prompt::{self, xml_escape, LearnerContext, TutorMode};
use crate::api::types::{Message, MessagesRequest};
use crate::db;
use crate::engine::{mastery, spaced_rep, struggle};
use crate::keychain;
use crate::rate_limit;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

/// Maximum length for free-response text (characters).
const MAX_FREE_RESPONSE_LEN: usize = 5000;

/// Check whether a quiz payload string contains at least one parseable question.
fn quiz_has_questions(text: &str) -> bool {
    let json_str = text.trim()
        .strip_prefix("```json").or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim())
        .strip_suffix("```").unwrap_or(text.trim()).trim();
    if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(json_str) {
        !arr.is_empty()
    } else if let Ok(obj) = serde_json::from_str::<serde_json::Value>(json_str) {
        obj.get("questions").and_then(|q| q.as_array()).map_or(false, |a| !a.is_empty())
    } else {
        false
    }
}

// ── Server-side quiz answer lookup ───────────────────────────────────────────

/// Parsed quiz question from the cached quiz JSON (server-authoritative answers).
#[derive(Debug, Deserialize)]
struct CachedQuizOption {
    #[serde(default)]
    id: Option<String>,
    #[serde(default, alias = "is_correct")]
    #[serde(rename = "isCorrect")]
    is_correct: Option<bool>,
    #[serde(default)]
    correct: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CachedQuizQuestion {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    options: Option<Vec<CachedQuizOption>>,
    #[serde(default)]
    blanks: Option<Vec<String>>,
    #[serde(default, alias = "expected_blanks")]
    #[serde(rename = "expectedBlanks")]
    expected_blanks_alt: Option<Vec<String>>,
}

/// Look up the correct answer for a question from the server-side cached quiz.
/// Returns (correct_option_id, expected_blanks) extracted from the cached quiz JSON.
fn lookup_server_answers(
    conn: &rusqlite::Connection,
    concept_id: &str,
    question_id: &str,
) -> (Option<String>, Option<Vec<String>>) {
    let cached = match db::content_cache::get_cached_content(conn, concept_id, "quiz") {
        Ok(Some(c)) => c,
        _ => return (None, None),
    };

    // Strip markdown code fences if present
    let json_str = cached.payload_json.trim()
        .strip_prefix("```json").or_else(|| cached.payload_json.trim().strip_prefix("```"))
        .unwrap_or(cached.payload_json.trim())
        .strip_suffix("```").unwrap_or(cached.payload_json.trim()).trim();

    // Try parsing as array of questions or object with "questions" field
    let questions: Vec<CachedQuizQuestion> = if let Ok(qs) = serde_json::from_str::<Vec<CachedQuizQuestion>>(json_str) {
        qs
    } else {
        #[derive(Deserialize)]
        struct QuizWrapper { #[serde(default)] questions: Vec<CachedQuizQuestion> }
        match serde_json::from_str::<QuizWrapper>(json_str) {
            Ok(w) => w.questions,
            Err(_) => return (None, None),
        }
    };

    // Match question by ID. The frontend normalizes IDs as q_0, q_1, etc.
    // Try exact match first, then try matching by index suffix.
    let question = questions.iter().enumerate().find(|(i, q)| {
        match &q.id {
            Some(id) => id == question_id || format!("q_{i}") == question_id,
            None => format!("q_{i}") == question_id,
        }
    });

    match question {
        Some((_, q)) => {
            // Extract correct option ID for MC
            let correct_option = q.options.as_ref().and_then(|opts| {
                opts.iter().enumerate().find_map(|(j, opt)| {
                    let is_correct = opt.is_correct.or(opt.correct).unwrap_or(false);
                    if is_correct {
                        Some(opt.id.clone().unwrap_or_else(|| format!("opt_{j}")))
                    } else {
                        None
                    }
                })
            });

            // Extract expected blanks for fill-in-blank
            let blanks = q.blanks.clone().or_else(|| q.expected_blanks_alt.clone());

            (correct_option, blanks)
        }
        None => (None, None),
    }
}

#[tauri::command]
pub async fn get_quiz(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    concept_id: String,
    mistakes_context: Option<String>,
) -> Result<String, String> {
    rate_limit::check_rate_limit("get_quiz")?;

    let concept = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::concepts::get_concept(&conn, &concept_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Concept not found: {concept_id}"))?
    };

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

    // Check cache with mastery- and model-aware lookup.
    // Skip cache when mistakes_context is provided — reinforcement quizzes must target specific errors.
    // Validate cached content actually contains questions; delete stale/corrupt entries.
    if mistakes_context.is_none() {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Some(cached) =
            db::content_cache::get_cached_content_personalized(
                &conn, &concept_id, "quiz",
                Some(concept.mastery_score), Some(&model),
            ).map_err(|e| format!("DB error: {e}"))?
        {
            if quiz_has_questions(&cached.payload_json) {
                return Ok(cached.payload_json);
            }
            // Cached quiz is empty/corrupt — delete it so we regenerate.
            eprintln!("[get_quiz] Invalidating cached quiz with no valid questions for {concept_id}");
            let _ = db::content_cache::invalidate_cache(&conn, &concept_id, "quiz");
        }
    }

    let api_key = keychain::get_api_key_cached(&state)?
        .ok_or_else(|| "API key not configured.".to_string())?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;
    let system_prompt = prompt::load_system_prompt(&resource_dir);

    let learner_ctx = LearnerContext::from(&concept);

    let request = prompt::build_request_with_model(
        &model, &TutorMode::Quiz, &concept, &learner_ctx, &system_prompt,
        mistakes_context.as_deref(), false,
    );

    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    prompt::log_token_usage(&TutorMode::Quiz, &model, &response);
    let text = extract_text(&response);

    if text.trim().is_empty() {
        return Err("The AI returned an empty quiz. Please try again.".to_string());
    }

    // Validate that the response contains at least one parseable question before caching.
    if !quiz_has_questions(&text) {
        return Err("Quiz generation produced no valid questions. Please try again.".to_string());
    }

    // Cache the quiz with mastery band tag for personalized invalidation.
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let entry = db::content_cache::CachedContent {
            id: None,
            concept_id: concept_id.clone(),
            content_type: "quiz".to_string(),
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
    /// Struggle detection: populated when the learner is consistently failing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub struggle_alert: Option<struggle::StruggleInfo>,
}

#[tauri::command]
pub async fn submit_answer(
    state: State<'_, AppState>,
    _session_id: String,
    answer: FrontendAnswer,
    question: QuestionContext,
) -> Result<FeedbackResponse, String> {
    rate_limit::check_rate_limit("submit_answer")?;

    // Validate free-response text length to prevent token exhaustion
    if let Some(ref text) = answer.free_text {
        if text.len() > MAX_FREE_RESPONSE_LEN {
            return Err(format!(
                "Free response text exceeds maximum length of {} characters.",
                MAX_FREE_RESPONSE_LEN
            ));
        }
    }

    let time_ms = answer.time_spent_ms;

    // Look up server-side correct answers from the cached quiz to prevent
    // the frontend from supplying manipulated correct answers.
    let (server_correct_option, server_expected_blanks) = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        lookup_server_answers(&conn, &question.concept_id, &answer.question_id)
    };

    // Grade the answer based on question type, preferring server-side answers
    let (is_correct, score) = match question.question_type.as_str() {
        "multiple_choice" => {
            // Use server-side correct answer; fall back to frontend only if cache miss
            let correct_id = server_correct_option.as_ref()
                .or(question.correct_option_id.as_ref());
            let correct = match (&answer.selected_option_id, correct_id) {
                (Some(selected), Some(correct)) => selected == correct,
                _ => false,
            };
            (correct, if correct { 1.0 } else { 0.0 })
        }
        "fill_in_blank" => {
            // Use server-side expected blanks; fall back to frontend only if cache miss
            let expected = server_expected_blanks.as_ref()
                .or(question.expected_blanks.as_ref());
            match (&answer.filled_blanks, expected) {
                (Some(filled), Some(expected)) => {
                    let mut matches = 0;
                    for (f, e) in filled.iter().zip(expected.iter()) {
                        let f_trimmed = f.trim();
                        let e_trimmed = e.trim();
                        // First try exact case-insensitive match
                        if f_trimmed.eq_ignore_ascii_case(e_trimmed) {
                            matches += 1;
                        } else if let (Ok(fv), Ok(ev)) = (
                            f_trimmed.parse::<f64>(),
                            e_trimmed.parse::<f64>(),
                        ) {
                            // Numeric tolerance: accept answers within 1% relative
                            // error or 0.01 absolute error (whichever is larger).
                            let abs_diff = (fv - ev).abs();
                            let rel_threshold = ev.abs() * 0.01;
                            if abs_diff <= rel_threshold.max(0.01) {
                                matches += 1;
                            }
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
            // Call AI to grade free-response answers (already server-authoritative).
            // On API/parse failure, don't penalize — skip the mastery update for
            // this question and flag for re-grade.
            match grade_free_response(&state, &question.prompt, answer.free_text.as_deref().unwrap_or(""), question.rubric.as_deref()).await {
                Ok((correct, s)) => (correct, s),
                Err(_) => {
                    // Don't penalize learner for grading failures — give neutral
                    // partial credit (0.5) instead of punitive 0.3, so SM-2
                    // treats it as uncertain rather than incorrect.
                    (false, 0.5)
                }
            }
        }
        _ => (false, 0.0),
    };

    // Update mastery and award XP atomically (single db lock)
    {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Ok(Some(concept)) = db::concepts::get_concept(&conn, &question.concept_id) {
            let old_mastery = concept.mastery_score;
            let new_streak = if is_correct { concept.streak_correct + 1 } else { 0 };

            let attempt = mastery::AttemptRecord {
                correct: is_correct,
                latency_ms: time_ms,
                is_transfer: false,
            };

            // Compute mastery as an exponential moving average with a
            // streak-based bonus.  The EMA weight is capped at 0.35 so
            // early attempts grow slowly (~0.35 after the first correct
            // answer).  Reaching mastery = 1.0 requires a streak of 5
            // consecutive correct answers, ensuring the learner truly
            // demonstrates sustained competence rather than getting lucky.
            let single_score = mastery::compute_mastery(&[attempt]);
            let total_attempts = concept.attempt_count as f64 + 1.0;
            let weight = (1.0 / total_attempts).min(0.35);
            let ema_mastery = concept.mastery_score * (1.0 - weight) + single_score * weight;

            // Streak floors: consecutive correct answers are the strongest
            // signal of genuine mastery.  3 in a row clears the 0.8 prereq
            // gate, 5 in a row grants full mastery.
            let streak_floor = match new_streak {
                s if s >= 5 => 1.0,
                4 => 0.92,
                3 => 0.82,
                _ => 0.0,
            };
            let new_mastery = ema_mastery.max(streak_floor);

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

            // Invalidate cache if the mastery band changed (event-driven)
            let _ = db::content_cache::invalidate_on_mastery_change(
                &conn, &question.concept_id, old_mastery, new_mastery,
            );

            // Check curriculum milestone rewards (concept started, mastered, module/domain completed).
            // This replaces the old per-answer XP system — points are now tied to
            // meaningful curriculum progress rather than individual quiz answers.
            let _ = crate::commands::gamification_cmds::award_curriculum_milestones(&conn);
        }

        // Persist per-question answer for data export
        let blanks_json = answer.filled_blanks.as_ref().map(|b| serde_json::to_string(b).unwrap_or_default());
        let _ = db::quiz_answers::insert_quiz_answer(
            &conn,
            &_session_id,
            &answer.question_id,
            &question.concept_id,
            &question.question_type,
            answer.selected_option_id.as_deref(),
            answer.free_text.as_deref(),
            blanks_json.as_deref(),
            is_correct,
            score,
            time_ms,
        );
    }

    // Check for struggle after mastery update
    let struggle_alert = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        if let Ok(Some(updated_concept)) = db::concepts::get_concept(&conn, &question.concept_id) {
            let all_concepts = db::concepts::get_all_concepts(&conn)
                .unwrap_or_default();
            let info = struggle::detect_struggle(&updated_concept, &all_concepts);
            if info.is_struggling { Some(info) } else { None }
        } else {
            None
        }
    };

    let explanation = question.explanation.unwrap_or_else(|| {
        if is_correct {
            "Correct! Well done.".to_string()
        } else {
            "Not quite right. Review the concept and try again.".to_string()
        }
    });

    let encouragement = if struggle_alert.is_some() {
        "This concept seems challenging. Check the recommendation below for next steps.".to_string()
    } else if is_correct {
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
        struggle_alert,
    })
}

/// Call AI to grade a free-response answer.
async fn grade_free_response(
    state: &State<'_, AppState>,
    question_prompt: &str,
    user_answer: &str,
    rubric: Option<&str>,
) -> Result<(bool, f64), String> {
    let api_key = keychain::get_api_key_cached(&state)?
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
        "<question>{}</question>\n\
         <answer>{}</answer>\n\
         <rubric>{}</rubric>",
        xml_escape(question_prompt),
        xml_escape(user_answer),
        xml_escape(rubric_text),
    );

    let request = MessagesRequest::new(&model, 256, Some(system), vec![Message::user_text(&user_msg)], false);
    let client = ClaudeClient::new(&api_key);
    let response = client.send(&request).await?;
    eprintln!(
        "[token-usage] mode=grade_free_response model={} input_tokens={} output_tokens={} total={}",
        model, response.usage.input_tokens, response.usage.output_tokens,
        response.usage.input_tokens + response.usage.output_tokens,
    );
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
        Ok(parsed) => Ok((parsed.correct, parsed.score.clamp(0.0, 1.0))),
        Err(_) => Ok((false, 0.5)), // Neutral partial credit — don't penalize for parse failures
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
pub fn invalidate_quiz_cache(
    state: State<'_, AppState>,
    concept_id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::content_cache::invalidate_cache(&conn, &concept_id, "quiz")
        .map_err(|e| format!("Failed to invalidate quiz cache: {e}"))?;
    eprintln!("[invalidate_quiz_cache] Invalidated quiz cache for {concept_id}");
    Ok(())
}

#[tauri::command]
pub fn complete_quiz(
    state: State<'_, AppState>,
    session_id: String,
    scores: Vec<f64>,
) -> Result<QuizCompletionResult, String> {
    // Clamp individual scores to valid range and compute average
    let clamped: Vec<f64> = scores.iter().map(|s| s.clamp(0.0, 1.0)).collect();
    let total_score = if clamped.is_empty() {
        0.0
    } else {
        clamped.iter().sum::<f64>() / clamped.len() as f64
    };

    // XP is now awarded via curriculum milestones (concept started/mastered,
    // module/domain completed) rather than per quiz answer.
    // Run a final milestone check and report any XP earned.
    let xp_earned = {
        let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
        match crate::commands::gamification_cmds::award_curriculum_milestones(&conn) {
            Ok(result) => result.total_xp_awarded as u32,
            Err(_) => 0,
        }
    };

    eprintln!("Quiz {} completed: score={:.2}, xp_earned={}", session_id, total_score, xp_earned);

    Ok(QuizCompletionResult {
        total_score,
        xp_earned,
    })
}
