use crate::api::client::ClaudeClient;
use crate::db;
use crate::keychain;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::settings::get_setting(&conn, &key).map_err(|e| format!("DB error: {e}"))
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::settings::set_setting(&conn, &key, &value).map_err(|e| format!("DB error: {e}"))
}

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
    keychain::get_api_key()
}

#[tauri::command]
pub fn store_api_key(api_key: String) -> Result<(), String> {
    keychain::store_api_key(&api_key)
}

#[tauri::command]
pub async fn test_api_key(api_key: String) -> Result<bool, String> {
    let client = ClaudeClient::new(&api_key);
    client.test_connection().await
}
