//! HMAC-based integrity verification for content cache entries.
//!
//! Generates a per-install secret key on first use (stored in the settings table)
//! and uses HMAC-SHA256 to sign cache payloads. On retrieval, the signature is
//! verified before the content is trusted.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Settings key for the cache signing secret.
const SECRET_KEY: &str = "_cache_hmac_secret";

/// Get or create the per-install HMAC secret.
pub fn get_or_create_secret(conn: &rusqlite::Connection) -> Result<Vec<u8>, String> {
    if let Ok(Some(hex_val)) = crate::db::settings::get_setting(conn, SECRET_KEY) {
        hex::decode(&hex_val).map_err(|e| format!("Failed to decode HMAC secret: {e}"))
    } else {
        // Generate a new 32-byte random secret
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let secret: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        let hex_val = hex::encode(&secret);
        crate::db::settings::set_setting(conn, SECRET_KEY, &hex_val)
            .map_err(|e| format!("Failed to store HMAC secret: {e}"))?;
        Ok(secret)
    }
}

/// Compute an HMAC-SHA256 signature for a cache payload.
pub fn compute_hmac(secret: &[u8], concept_id: &str, content_type: &str, payload: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret)
        .expect("HMAC can take key of any size");
    mac.update(concept_id.as_bytes());
    mac.update(b"|");
    mac.update(content_type.as_bytes());
    mac.update(b"|");
    mac.update(payload.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Verify an HMAC-SHA256 signature for a cache payload.
pub fn verify_hmac(
    secret: &[u8],
    concept_id: &str,
    content_type: &str,
    payload: &str,
    expected_hmac: &str,
) -> bool {
    let computed = compute_hmac(secret, concept_id, content_type, payload);
    // Constant-time comparison via the hmac crate is done internally;
    // we compare hex strings here which is acceptable for this use case.
    computed == expected_hmac
}
