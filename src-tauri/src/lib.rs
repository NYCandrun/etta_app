use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

mod api;
mod commands;
mod curriculum;
mod db;
mod engine;
mod file_handler;
mod keychain;

/// Shared application state holding the SQLite connection.
pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Record mastery snapshots using the shared app state.
fn take_mastery_snapshot(state: &AppState) {
    if let Ok(conn) = state.db.lock() {
        let _ = engine::snapshots::record_mastery_snapshots(&conn);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let conn = db::init::initialize_database()?;
            let state = AppState {
                db: Mutex::new(conn),
            };
            app.manage(state);

            // Seed curriculum on first launch if concepts table is empty.
            let managed = app.state::<AppState>();
            let db = managed.db.lock().expect("Failed to lock database");
            let count: i64 =
                db.query_row("SELECT COUNT(*) FROM concepts", [], |row| row.get(0))?;
            if count == 0 {
                if let Err(e) = curriculum::seed::seed_concepts(&db) {
                    eprintln!("Warning: failed to seed curriculum: {e}");
                }
            }

            // Purge stale content cache entries (older than 30 days) to prevent bloat
            let cutoff = (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339();
            match db::content_cache::purge_cache_before(&db, &cutoff) {
                Ok(purged) if purged > 0 => {
                    eprintln!("Purged {purged} stale cache entries (older than 30 days)");
                }
                _ => {}
            }

            // Take a mastery snapshot on startup so progress is captured on launch
            let _ = engine::snapshots::record_mastery_snapshots(&db);

            drop(db);

            // Start a background timer to take mastery snapshots every 10 minutes.
            // This ensures progress is captured even if the user closes the app abruptly.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(600)); // 10 minutes
                    let state = app_handle.state::<AppState>();
                    take_mastery_snapshot(&state);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings_cmds::get_setting,
            commands::settings_cmds::set_setting,
            commands::settings_cmds::has_api_key,
            commands::settings_cmds::store_api_key,
            commands::settings_cmds::test_api_key,
            // Lessons
            commands::lesson_cmds::get_lesson,
            // Quizzes
            commands::quiz_cmds::get_quiz,
            commands::quiz_cmds::submit_answer,
            commands::quiz_cmds::complete_quiz,
            // Sessions
            commands::session_cmds::get_daily_session,
            // Progress
            commands::progress_cmds::get_curriculum_state,
            commands::progress_cmds::get_mastery_stats,
            // Gamification
            commands::gamification_cmds::get_gamification_state,
            commands::gamification_cmds::award_xp,
            commands::gamification_cmds::check_badges,
            // Projects
            commands::project_cmds::get_projects,
            commands::project_cmds::submit_project,
            // AI — explain mistake, re-grade, model discovery
            commands::ai_cmds::explain_mistake,
            commands::ai_cmds::regrade_with_reasoning,
            commands::ai_cmds::list_available_models,
            commands::ai_cmds::request_explanation,
            commands::ai_cmds::verify_no_right_answer,
            commands::ai_cmds::get_mastery_history,
            commands::ai_cmds::get_review_forecast,
            commands::ai_cmds::activate_streak_freeze,
            commands::ai_cmds::get_submissions,
            commands::ai_cmds::get_submission_feedback,
            commands::ai_cmds::export_data,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Astrolabe")
        .run(|app_handle, event| {
            // Take a final mastery snapshot when the app is about to exit
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<AppState>();
                take_mastery_snapshot(&state);
            }
        });
}
