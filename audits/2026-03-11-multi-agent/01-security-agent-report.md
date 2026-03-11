# Security Agent Report

- Agent: `019cdbab-8857-75c1-aaa2-ca78dfb85440`
- Scope: comprehensive security audit (Tauri IPC surface, auth/session integrity, prompt injection paths, data/privacy, dependency scan)
- Commit audited: `403e644`

Audited `etta_app` at `HEAD 403e644` (static code/config review + `npm audit --omit=dev`).

## Findings (Prioritized P0-P3)

1. **P0: Arbitrary local file read and exfiltration via Tauri command**
   Evidence: [project_cmds.rs:54](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:54), [project_cmds.rs:64](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:64), [file_handler.rs:25](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/file_handler.rs:25), [project_cmds.rs:130](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:130).  
   Exploit: any renderer JS can invoke `submit_project` with an arbitrary path (for example `~/.ssh/id_rsa`); backend reads file and sends base64 to Anthropic.  
   Impact: local sensitive file exfiltration, privacy/compliance breach.  
   Fix: never accept raw IPC path; use user-approved file handles only, canonicalize + symlink checks, strict MIME/extension allowlist, explicit max size limit before read, and per-upload user confirmation.

2. **P0: Session/progress integrity is client-authoritative and forgeable**
   Evidence: [QuizShell.tsx:51](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:51), [QuizShell.tsx:53](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:53), [quiz_cmds.rs:132](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:132), [quiz_cmds.rs:139](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:139), [quiz_cmds.rs:313](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:313), [gamification_cmds.rs:95](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/gamification_cmds.rs:95).  
   Exploit: caller supplies `correctOptionId`/`expectedBlanks`, `session_id` is ignored, caller also controls `scores` and `award_xp` amount.  
   Impact: trivial forging of mastery, streaks, quiz outcomes, and XP.  
   Fix: persist quiz/session state server-side, validate signed session tokens, derive answer keys from backend state only, remove/lock down `award_xp`, enforce score bounds and count checks.

3. **P1: API key handling is recoverable and directly exposed to IPC**
   Evidence: [keychain.rs:17](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/keychain.rs:17), [keychain.rs:30](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/keychain.rs:30), [keychain.rs:40](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/keychain.rs:40), [settings_cmds.rs:20](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/settings_cmds.rs:20), [lib.rs:57](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/lib.rs:57).  
   Exploit: key is XOR-obfuscated with hardcoded key and retrievable via `get_api_key` command.  
   Impact: API key theft, billing abuse, data misuse.  
   Fix: move to OS keychain APIs; remove plaintext retrieval command (`get_api_key`), replace with `has_api_key` + `test_stored_api_key`.

4. **P1: Prompt-injection path influences grading decisions**
   Evidence: [ai_cmds.rs:70](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:70), [ai_cmds.rs:126](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:126), [quiz_cmds.rs:273](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:273), [quiz_cmds.rs:294](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:294).  
   Exploit: attacker-controlled rubric/prompt text can coerce model JSON output (`{"correct":true,"score":1}`), because content is string-interpolated and response is weakly validated.  
   Impact: grading bypass and model behavior manipulation.  
   Fix: structured JSON prompting (no ad-hoc XML tags), strong schema validation (`0<=score<=1`), backend-owned rubric/question context only.

5. **P1: Multiple high-impact DoS/cost vectors via unbounded input sizes**
   Evidence: [file_handler.rs:25](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/file_handler.rs:25), [file_handler.rs:28](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/file_handler.rs:28), [ai_cmds.rs:107](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:107), [ai_cmds.rs:141](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:141).  
   Exploit: huge files/base64/text inputs force large allocations and expensive outbound API calls.  
   Impact: app freeze/OOM and quota/billing exhaustion.  
   Fix: hard size caps on all IPC payloads, reject early before allocation, command-level rate limiting and backpressure.

6. **P2: Privacy leakage through broad export/read surfaces**
   Evidence: [ai_cmds.rs:492](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:492), [ai_cmds.rs:523](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:523), [ai_cmds.rs:585](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:585), [settings_cmds.rs:8](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/settings_cmds.rs:8).  
   Exploit: compromised renderer can bulk-export learning history and absolute local file paths.  
   Impact: user privacy exposure.  
   Fix: redact absolute paths, restrict export to explicit user-confirmed flow, key allowlist for settings access.

7. **P3: Data-layer integrity constraints are weak**
   Evidence: [schema.sql:22](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/schema.sql:22), [schema.sql:29](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/schema.sql:29), [project_cmds.rs:81](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:81), [project_cmds.rs:88](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:88).  
   Exploit: orphan/invalid submissions can be inserted before concept validation.  
   Impact: inconsistent records, analytics corruption, storage bloat.  
   Fix: FK/check constraints, validate concept before insert, use transaction for insert+update flow.

## What was checked

- Tauri command exposure and registration: [lib.rs](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/lib.rs), capabilities/CSP: [tauri.conf.json](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/tauri.conf.json), [default.json](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/capabilities/default.json).
- IPC/frontend call paths: [ipc.ts](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts), [QuizShell.tsx](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx), project/settings routes.
- Auth/session/progress integrity: quiz + gamification commands.
- SQL/data-layer patterns: `db/*.rs` and [schema.sql](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/schema.sql) (no SQLi found; queries are parameterized).
- Prompt construction and AI response parsing: `ai_cmds.rs`, `quiz_cmds.rs`, `api/*.rs`.
- File/network operations and key storage: `file_handler.rs`, `project_cmds.rs`, `keychain.rs`, `api/client.rs`.
- Dependency scan: `npm audit --omit=dev` returned 0 prod vulns; `cargo audit` unavailable in environment.

## Residual risk

- Static analysis only; no live exploit execution against a running app.
- Rust dependency CVE scan incomplete (`cargo-audit` unavailable).
- Desktop threat model still depends on renderer trust; an XSS/supply-chain compromise amplifies impact via current IPC design.
