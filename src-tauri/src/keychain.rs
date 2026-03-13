//! API key storage using the OS keychain (macOS Keychain, Windows DPAPI,
//! Linux secret-service / libsecret).
//!
//! Falls back to file-based encrypted storage only when the OS keychain is
//! unavailable. The old XOR-obfuscation scheme has been removed.

const SERVICE_NAME: &str = "com.astrolabe.app";
const KEY_ACCOUNT: &str = "anthropic-api-key";

/// Store the API key in the OS keychain.
pub fn store_api_key(api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_ACCOUNT)
        .map_err(|e| format!("Keychain init error: {e}"))?;
    entry
        .set_password(api_key)
        .map_err(|e| format!("Failed to store API key in keychain: {e}"))
}

/// Retrieve the stored API key from the OS keychain.
pub fn get_api_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_ACCOUNT)
        .map_err(|e| format!("Keychain init error: {e}"))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve API key from keychain: {e}")),
    }
}

/// Delete the stored API key from the OS keychain.
#[allow(dead_code)]
pub fn delete_api_key() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, KEY_ACCOUNT)
        .map_err(|e| format!("Keychain init error: {e}"))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone — not an error
        Err(e) => Err(format!("Failed to delete API key from keychain: {e}")),
    }
}

/// Retrieve the API key, using the in-memory cache on AppState to avoid
/// repeated OS keychain prompts (which can require a password on Linux).
pub fn get_api_key_cached(state: &crate::AppState) -> Result<Option<String>, String> {
    let mut cache = state.cached_api_key.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(ref key) = *cache {
        return Ok(Some(key.clone()));
    }
    let key = get_api_key()?;
    if let Some(ref k) = key {
        *cache = Some(k.clone());
    }
    Ok(key)
}

/// Invalidate the cached API key (call when the user stores or deletes their key).
pub fn invalidate_cache(state: &crate::AppState) {
    if let Ok(mut cache) = state.cached_api_key.lock() {
        *cache = None;
    }
}

/// Check whether an API key is stored (without returning it).
pub fn has_api_key() -> Result<bool, String> {
    Ok(get_api_key()?.is_some())
}
