use crate::engine::session_builder::{self, DailySession};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn get_daily_session(state: State<'_, AppState>) -> Result<DailySession, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    session_builder::build_daily_session(&conn)
}
