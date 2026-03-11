# Functionality and Contract Evaluation Against Main Branch

- **Evaluated**: origin/main at commit `82a8863`
- **Compared against**: Functionality audit findings from `audits/03-functionality-audit.md` and `audits/2026-03-11-multi-agent/03-functionality-agent-report.md`
- **Date**: 2026-03-11

## Results Summary

| Status | Count |
|--------|-------|
| FIXED | 7 |
| PARTIALLY ADDRESSED | 5 |
| NOT ADDRESSED | 1 |

---

## FIXED (7)

### 1. Lesson Route Contract-Broken (CRITICAL)
Backend `get_lesson` returns `Result<String, String>`. Frontend IPC contains `normalizeLessonContent()` adapter that accepts either structured `LessonContent` or raw markdown string, parses into `LessonSection[]`. Contract bridged.

### 2. Quiz Route Contract-Broken (CRITICAL)
Backend `get_quiz` returns `Result<String, String>`. Frontend IPC contains `normalizeQuizSession()` adapter that parses JSON string and maps into full `QuizSession` shape with all required fields.

### 3. Project Route API Contract Mismatch (CRITICAL)
Frontend IPC contains `normalizeProjectDefinition()` and `normalizeSubmission()` adapters that map backend flat shapes to frontend types including JSON string parsing.

### 4. GamificationState Type Mismatch (CRITICAL)
Backend `GamificationState` now contains nested `level: LevelInfo` and `streak: StreakInfo` matching frontend types. Frontend IPC also handles legacy flat fields for backward compatibility.

### 5. Settings/API-Key Lifecycle Regressions (HIGH)
`set_setting` properly accepts `(key: String, value: String)` with frontend coercion. `test_api_key` uses keychain with no parameters. Return shapes handled.

### 6. XP Source/Description Params Unused (HIGH)
No `#[allow(unused)]` annotations remain. `award_xp` command actively stores `source` and `description` via `db::xp_events::insert_xp_event()`.

### 8. Prerequisite Gating Unlocks Too Early (HIGH)
All prerequisite checks now use `mastery_score >= 0.8` (`concepts.rs:116`, `progress_cmds.rs:319`, `session_builder.rs:147`).

---

## PARTIALLY ADDRESSED (5)

### 7. Quiz XP Awarded Multiple Times (HIGH)
Frontend `useRef` guard prevents completion bonus from firing twice per mount. Backend awards per-answer XP atomically. However, **structural double-counting remains**: per-answer XP from backend (`quiz_cmds.rs:245-255`) PLUS lump-sum bonus from frontend (`Quiz.tsx:49-53` calling `awardXP`). No idempotency mechanism.

### 9. Default QuestionContext With Empty Fields (MEDIUM)
Fallback at `QuizShell.tsx:56` produces minimal context with no `correctOptionId`, `expectedBlanks`, `rubric`, or `explanation`. Backend handles gracefully (scores 0.0), but produces meaningless grades. Guard at line 234 should prevent this path in practice.

### 10. Diagnostic Route Race-Condition and Failure-State Gaps (MEDIUM)
Rewritten to be frontend-driven (eliminating API race condition). Uses pre-computed state to avoid stale closures. However, empty `catch` block at `Diagnostic.tsx:134` silently proceeds with 0 questions. No retry on curriculum load failure.

### 11. Progress/Feedback Reporting Is Synthetic (MEDIUM)
Real data sources now exist (mastery history, review forecast, XP events). But concept `description` always `format!("Learn about {}", concept.title)`, `estimated_minutes` always `10`, quiz feedback falls back to hardcoded strings.

### 12. Data Export Missing History (MEDIUM)
Export now includes concepts, submissions, `contentHistory`, `xpEvents`, and `masterySnapshots`. But no per-question answer records, lesson view logs, or per-question feedback text (never stored in DB).

---

## NOT ADDRESSED (1)

### 13. Verification Tooling Partially Non-Functional (MEDIUM)
ESLint v9 declared in `package.json` but no flat config file exists — `npm run lint` fails. `cargo test` blocked by missing system library `gdk-3.0`. All Rust unit tests unverifiable.
