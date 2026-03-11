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

/// Check whether an API key is stored without returning the key itself.
#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    keychain::has_api_key()
}

#[tauri::command]
pub fn store_api_key(api_key: String) -> Result<(), String> {
    keychain::store_api_key(&api_key)
}

/// Test the *stored* API key by making a lightweight API call.
/// Does NOT accept an API key parameter — uses the key from the OS keychain.
#[tauri::command]
pub async fn test_api_key() -> Result<bool, String> {
    let api_key = keychain::get_api_key()?
        .ok_or_else(|| "No API key stored. Please store one first.".to_string())?;
    let client = ClaudeClient::new(&api_key);
    client.test_connection().await
}
