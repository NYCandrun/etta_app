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
            drop(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings_cmds::get_setting,
            commands::settings_cmds::set_setting,
            commands::settings_cmds::get_api_key,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Astrolabe");
}
