# Security Evaluation Against Main Branch

- **Evaluated**: origin/main at commit `82a8863`
- **Compared against**: Security audit findings from `audits/01-security-audit.md` and `audits/2026-03-11-multi-agent/01-security-agent-report.md`
- **Date**: 2026-03-11

## Results Summary

| Status | Count |
|--------|-------|
| FIXED | 10 |
| PARTIALLY ADDRESSED | 8 |
| NOT ADDRESSED | 4 |

---

## FIXED (10)

### 1. Hardcoded XOR Obfuscation Key (CRITICAL)
Replaced with OS keychain via `keyring` crate (`keychain.rs:12`). No XOR obfuscation remains.

### 2. API Key File Stored Without Encryption (CRITICAL)
No `astrolabe.key` references remain; key lives in OS keychain exclusively.

### 3. Prompt Injection via User Input (CRITICAL)
`xml_escape()` applied to all user inputs (`ai_cmds.rs:15-21`, `quiz_cmds.rs:15-21`). User content is escaped before interpolation into XML-structured prompts.

### 4. API Key Exposed in test_api_key() Parameter (HIGH)
`test_api_key()` takes no parameters, reads from keychain (`settings_cmds.rs:50-52`).

### 5. dangerouslySetInnerHTML XSS in Math Rendering (HIGH)
DOMPurify sanitization added (`AccessibleMath.tsx:3,41`), KaTeX `trust: false` (`AccessibleMath.tsx:37`).

### 6. No File Size Limits (HIGH)
25 MB limit checked before read (`file_handler.rs:8,63-69`).

### 7. Free Response Text Not Validated (HIGH)
5000 char limit enforced backend (`quiz_cmds.rs:12,152-158`) and frontend (`FreeResponse.tsx:7,109-110`).

### 8. RichText/LaTeX XSS (MEDIUM)
LessonContent uses React JSX auto-escaping; LaTeX routed through DOMPurify-guarded AccessibleMath.

### 9. No Backend File Type Validation (MEDIUM)
Magic byte + extension detection with whitelist enforcement (`file_handler.rs:77-82,99-148`).

### 10. Settings Export Unfiltered (MEDIUM)
Sensitive keys filtered by substring match (`ai_cmds.rs:24-26,664-669`).

---

## PARTIALLY ADDRESSED (8)

### 11. Path Traversal Risk (MEDIUM)
Canonicalization and file-type checks added (`file_handler.rs:51-53`), but **no directory sandboxing** — any allowed-type file on disk is readable.

### 12. No Request Validation in Tauri Commands (MEDIUM)
Limits on free response, XP, scores, settings keys; but **no length limits** on `explain_mistake`, `regrade_with_reasoning`, `verify_no_right_answer` string parameters.

### 13. Cache Poisoning Risk (MEDIUM)
Staleness checks and pruning exist (`content_cache.rs:50-73`), but **no cryptographic integrity** (hash/HMAC) on cached payloads.

### 14. Arbitrary Local File Read via submit_project (P0)
MIME whitelist and size cap restrict scope, but `/etc/passwd` (text/plain), any PDF, etc. remain readable and sent to Claude API (`project_cmds.rs:65,136`).

### 15. Client-Authoritative Scoring (P0)
Frontend still supplies `correctOptionId` and `expectedBlanks` used for MC/fill-in-blank grading (`quiz_cmds.rs:119-121,166-176`). Free response graded server-side.

### 16. XP and Mastery Inflation Exploits (P0)
Per-answer XP is server-computed and capped, but **duplicate award paths** remain: per-answer XP (`quiz_cmds.rs:245-255`) plus frontend-triggered `award_xp` bonus (`Quiz.tsx:49-53`) with no idempotency.

### 17. Unbounded Input DoS (P1)
Free response and files capped, but AI command inputs (`explain_mistake`, `regrade_with_reasoning`, etc.) accept arbitrarily large strings.

### 18. Privacy Leakage Through Export/Read Surfaces (P2)
Export filters sensitive settings and `get_submissions` strips paths (`ai_cmds.rs:539`), but `get_projects` still returns full file paths (`project_cmds.rs:43`).

---

## NOT ADDRESSED (4)

### 19. SQLite Database Not Encrypted (HIGH)
`Connection::open()` with no encryption (`db/init.rs:17`). Student learning data unprotected at rest.

### 20. Insufficient Security Event Logging (MEDIUM)
Only `eprintln!` for operational messages. No structured security event audit trail.

### 21. No Rate Limiting on API Commands (MEDIUM)
All API-calling commands have zero throttling — enables quota exhaustion and billing abuse.

### 22. Weak Data-Layer Integrity Constraints (P3)
No foreign keys, no CHECK constraints, no `PRAGMA foreign_keys = ON` (`db/init.rs:23-81`).
