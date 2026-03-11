//! File reading and MIME type detection for project submissions.
//! Supports PDF, DOCX, PNG, JPG, and plaintext files.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::path::Path;

/// Maximum file size: 25 MB.
const MAX_FILE_SIZE: u64 = 25 * 1024 * 1024;

/// Allowed MIME types for file uploads.
const ALLOWED_MIME_TYPES: &[&str] = &[
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/x-python",
    "text/x-rust",
    "text/javascript",
    "text/typescript",
    "text/html",
    "text/css",
    "application/json",
];

/// A processed file ready for API submission.
#[derive(Debug, Clone)]
pub struct ProcessedFile {
    pub data_base64: String,
    pub mime_type: String,
    pub file_name: String,
    pub size_bytes: usize,
}

/// Read a file from disk, detect its MIME type, and base64-encode it.
///
/// Validates:
/// - File exists and is a regular file (not directory/symlink to device)
/// - File size is within the 25 MB limit
/// - MIME type is in the allowed whitelist
/// - Path is canonicalized to prevent traversal
pub fn process_file(path: &str) -> Result<ProcessedFile, String> {
    let file_path = Path::new(path);

    if !file_path.exists() {
        return Err(format!("File not found: {path}"));
    }

    // Canonicalize to resolve symlinks and prevent path traversal
    let canonical = file_path
        .canonicalize()
        .map_err(|e| format!("Failed to resolve file path: {e}"))?;

    // Ensure it's a regular file, not a directory, device, or pipe
    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("Failed to read file metadata: {e}"))?;
    if !metadata.is_file() {
        return Err("Path does not point to a regular file.".to_string());
    }

    // Check file size before reading into memory
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File is too large ({:.1} MB). Maximum allowed size is {} MB.",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    let bytes =
        std::fs::read(&canonical).map_err(|e| format!("Failed to read file: {e}"))?;

    let mime_type = detect_mime_type(&canonical, &bytes);

    // Validate MIME type against whitelist
    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return Err(format!(
            "File type '{}' is not allowed. Supported types: PDF, PNG, JPEG, DOCX, and plain text.",
            mime_type
        ));
    }

    let data_base64 = B64.encode(&bytes);
    let file_name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    Ok(ProcessedFile {
        data_base64,
        mime_type,
        file_name,
        size_bytes: bytes.len(),
    })
}

/// Detect MIME type from extension and magic bytes.
fn detect_mime_type(path: &Path, bytes: &[u8]) -> String {
    // Check magic bytes first for binary formats.
    if bytes.len() >= 4 {
        // PDF: starts with %PDF
        if bytes.starts_with(b"%PDF") {
            return "application/pdf".to_string();
        }

        // PNG: 89 50 4E 47
        if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            return "image/png".to_string();
        }

        // JPEG: FF D8 FF
        if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            return "image/jpeg".to_string();
        }

        // DOCX (ZIP): 50 4B 03 04
        if bytes.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
            // Check extension to distinguish ZIP-based formats.
            if let Some(ext) = path.extension() {
                if ext.eq_ignore_ascii_case("docx") {
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string();
                }
            }
        }
    }

    // Fall back to extension-based detection.
    if let Some(ext) = path.extension() {
        match ext.to_string_lossy().to_lowercase().as_str() {
            "pdf" => "application/pdf".to_string(),
            "png" => "image/png".to_string(),
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
            "txt" => "text/plain".to_string(),
            "md" => "text/markdown".to_string(),
            "py" => "text/x-python".to_string(),
            "rs" => "text/x-rust".to_string(),
            "js" | "jsx" => "text/javascript".to_string(),
            "ts" | "tsx" => "text/typescript".to_string(),
            "html" => "text/html".to_string(),
            "css" => "text/css".to_string(),
            "json" => "application/json".to_string(),
            _ => "application/octet-stream".to_string(),
        }
    } else {
        "application/octet-stream".to_string()
    }
}
