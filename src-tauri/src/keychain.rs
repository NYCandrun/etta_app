//! API key storage using a simple file-based approach with obfuscation.
//!
//! TODO: Replace with macOS Keychain integration using the `security-framework`
//! crate for production. The current approach stores the key XOR-encoded in a
//! separate file outside the SQLite database, which is better than plaintext in
//! the DB but not truly secure.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::fs;
use std::path::PathBuf;

const KEY_FILE: &str = "astrolabe.key";
const SERVICE_NAME: &str = "com.astrolabe.app";

/// XOR obfuscation key. This is NOT real encryption — it's a placeholder
/// until we integrate with macOS Keychain.
const OBFUSCATION_KEY: &[u8] = b"astrolabe-obfuscation-key-2024";

fn key_file_path() -> PathBuf {
    let base = dirs::data_dir().expect("Could not resolve data directory");
    let app_dir = base.join(SERVICE_NAME);
    fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    app_dir.join(KEY_FILE)
}

/// Store the API key.
pub fn store_api_key(api_key: &str) -> Result<(), String> {
    let encoded = xor_encode(api_key.as_bytes());
    let b64 = B64.encode(&encoded);
    fs::write(key_file_path(), b64).map_err(|e| format!("Failed to write API key: {e}"))
}

/// Retrieve the stored API key.
pub fn get_api_key() -> Result<Option<String>, String> {
    let path = key_file_path();
    if !path.exists() {
        return Ok(None);
    }

    let b64 = fs::read_to_string(&path).map_err(|e| format!("Failed to read API key: {e}"))?;

    let encoded = B64
        .decode(b64.trim())
        .map_err(|e| format!("Failed to decode API key: {e}"))?;

    let decoded = xor_encode(&encoded);
    let key =
        String::from_utf8(decoded).map_err(|e| format!("Invalid UTF-8 in API key: {e}"))?;

    Ok(Some(key))
}

/// Delete the stored API key.
pub fn delete_api_key() -> Result<(), String> {
    let path = key_file_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete API key: {e}"))?;
    }
    Ok(())
}

/// XOR encode/decode (symmetric operation).
fn xor_encode(data: &[u8]) -> Vec<u8> {
    data.iter()
        .enumerate()
        .map(|(i, &b)| b ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.len()])
        .collect()
}
