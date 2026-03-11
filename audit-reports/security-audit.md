# Etta App — Security Audit Report

## POSITIVE FINDINGS (10)

1. **OS Keychain for API keys** — API keys stored via `keychain.rs` using OS-level secure storage, not plaintext
2. **100% parameterized SQL queries** — All DB operations use `params![]` macro, no string interpolation
3. **DOMPurify-sanitized HTML rendering** — AI-generated content is sanitized before rendering in `LessonContent.tsx`
4. **Restrictive Tauri capabilities** — `capabilities/default.json` uses narrow permissions
5. **No hardcoded secrets** — No API keys, tokens, or passwords found in source code
6. **XML escaping for prompt injection prevention** — `xml_escape()` used in most prompt-building functions
7. **Free-response length validation** — `MAX_FREE_RESPONSE_LEN` (5000 chars) prevents token exhaustion
8. **File size validation** — `MAX_FILE_SIZE` (25 MB) prevents upload abuse
9. **Sensitive keys filtered from exports** — `SENSITIVE_KEYS` array filters API keys from data export
10. **Privacy-preserving file paths** — `get_submissions` returns only filenames, not full paths

## HIGH ISSUES

### H1: Unrestricted `set_setting` command (FIXED)
- **File**: `src-tauri/src/commands/settings_cmds.rs:14`
- **Issue**: The `set_setting` Tauri command accepted ANY key/value pair, allowing the frontend (or a compromised webview) to tamper with internal state like `streak_freezes`, `streak_freeze_active`, or `base_model`.
- **Fix applied**: Added `ALLOWED_SETTING_KEYS` allowlist — only user-facing settings (theme, model selection, display_name, etc.) can be modified via IPC.

### H2: Missing `xml_escape()` in `request_explanation` (FIXED)
- **File**: `src-tauri/src/commands/ai_cmds.rs:320-322`
- **Issue**: Concept fields (id, title, domain, module) were interpolated directly into XML-structured prompts without escaping. While these come from the DB/curriculum, a compromised DB could enable prompt injection.
- **Fix applied**: Added `xml_escape()` to all concept fields in the prompt.

### H3: Missing `xml_escape()` in other prompt functions
- **Note**: `quiz_cmds.rs` already uses `xml_escape()` properly in `grade_free_response`. The `explain_mistake` and `regrade_with_reasoning` functions in `ai_cmds.rs` also properly escape user input. Only `request_explanation` was missing escaping (now fixed).

## MEDIUM ISSUES

### M1: Unencrypted SQLite database
- **Issue**: The SQLite database storing all user learning data, mastery scores, and submission history is stored unencrypted on disk.
- **Risk**: If the device is compromised, all learning data is accessible.
- **Recommendation**: Consider SQLCipher for at-rest encryption, or rely on OS-level disk encryption (FileVault/BitLocker).

### M2: File path leakage in exports
- **File**: `src-tauri/src/commands/ai_cmds.rs` (export_data function)
- **Issue**: While `get_submissions` strips paths to filenames, the raw `submissions` in `export_data` may include full `file_path` values.
- **Recommendation**: Filter `file_path` to basename in the export as well.

### M3: No API rate limiting
- **Issue**: No rate limiting on AI API calls. A runaway frontend loop could exhaust the user's API credits.
- **Recommendation**: Add a per-minute rate limiter in `ClaudeClient` (e.g., 30 requests/minute).

### M4: Unnecessary key retrieval in `has_api_key`
- **File**: `src-tauri/src/keychain.rs`
- **Issue**: `has_api_key()` may retrieve the full key just to check existence.
- **Recommendation**: If the keychain API allows it, check existence without reading the value.

### M5: No API key format validation
- **Issue**: `store_api_key` accepts any string without validating it looks like a valid Anthropic API key.
- **Recommendation**: Add basic format validation (e.g., starts with `sk-ant-`).

### M6: `withGlobalTauri: true` expands attack surface
- **File**: `tauri.conf.json`
- **Issue**: Exposing the Tauri API globally makes it accessible to any script running in the webview.
- **Recommendation**: Use specific Tauri API imports instead of global exposure.

## LOW ISSUES

### L1: Unnecessary `macos-private-api` feature
- **File**: `Cargo.toml`
- **Issue**: The `macos-private-api` feature is enabled but may not be needed.

### L2: Verbose API error propagation
- **Issue**: Some error messages may leak internal details (DB paths, API response bodies).
- **Recommendation**: Use generic user-facing errors with detailed logging to stderr.

### L3: Missing `delete_api_key` command
- **Issue**: Users can store an API key but there's no explicit command to delete it.

### L4: Plaintext quiz answers in content cache
- **Issue**: AI-generated quiz content (including correct answers) is stored in plaintext in `content_cache`.
- **Risk**: Minimal — this is a desktop app and the user is the learner.

### L5: `unsafe-inline` in CSP
- **Issue**: If CSP is configured, `unsafe-inline` for styles may be present.
- **Recommendation**: Use nonce-based or hash-based style loading.
