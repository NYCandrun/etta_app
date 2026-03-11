# Prompt and App Optimization Agent Report

- Agent: `019cdbab-8947-7c63-a55f-abd9ac001c87`
- Scope: prompt bloat, pruning aggressiveness, token efficiency, adaptive-quality-safe optimization
- Commit audited: `403e644`

Audited with a prompt/token-efficiency lens.

## Findings (Ordered by Severity)

1. **High: Cache reuse is too aggressive and bypasses adaptive personalization.**
   `get_lesson`/`get_quiz` short-circuit on cache before model/context-aware request construction.
   Evidence: [lesson_cmds.rs:14](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/lesson_cmds.rs:14), [quiz_cmds.rs:17](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:17), [content_cache.rs:54](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/content_cache.rs:54), [prompt.rs:120](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/prompt.rs:120), [content_cache.rs:10](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/content_cache.rs:10)
   Low-risk optimization: add coarse context/model keying (`model + mastery bucket + attempt/streak bucket`) and retrieve against it; invalidate on meaningful mastery shifts.
   Tradeoff: higher cache miss rate and slightly more API calls, but better adaptation quality.

2. **High: Explain flow is under-contextualized (too aggressively pruned) and noncompliant with prompt contract.**
   `request_explanation` sends concept metadata but omits expected explain-mode/context tags.
   Evidence: [ai_cmds.rs:290](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:290), [ai_cmds.rs:306](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:306), [tutor_prompt.txt:18](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/tutor_prompt.txt:18), [tutor_prompt.txt:65](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/tutor_prompt.txt:65)
   Low-risk optimization: route through `build_request_with_model(... TutorMode::Explain ...)` with compact learner + error context.
   Tradeoff: slight input-token increase per request, but likely fewer retries and higher quality.

3. **High: System prompt composition is not aggressively pruned; every call pays for all modes.**
   A single large prompt file is loaded and reused broadly across lesson/quiz/project/explain paths.
   Evidence: [tutor_prompt.txt](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/tutor_prompt.txt), [lesson_cmds.rs:42](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/lesson_cmds.rs:42), [quiz_cmds.rs:42](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:42), [project_cmds.rs:100](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:100), [ai_cmds.rs:288](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:288)
   Low-risk optimization: split prompt into `shared + mode-specific` fragments and compose only needed sections.
   Tradeoff: prompt maintenance spans multiple files.
   Expected win: ~800-1000 input tokens per call (heuristic estimate).

4. **Medium: Token budgets are not enforced per mode and usage is not instrumented.**
   Default 4096 in prompt builder, 2048 in explain path; response usage metadata is not used to tune budgets.
   Evidence: [prompt.rs:6](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/prompt.rs:6), [prompt.rs:77](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/prompt.rs:77), [ai_cmds.rs:80](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:80), [ai_cmds.rs:312](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:312), [types.rs:77](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/types.rs:77), [types.rs:90](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/types.rs:90)
   Low-risk optimization: per-mode caps + local logging of token usage and stop reasons.

5. **Medium: Cache invalidation is underpowered (not aggressive enough on freshness).**
   Only age-based purge is active at startup.
   Evidence: [lib.rs:40](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/lib.rs:40), [content_cache.rs:95](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/content_cache.rs:95)
   Low-risk optimization: invalidate lesson/quiz cache on mastery/streak inflection and model changes.

6. **Medium: Attachment path can cause token/cost spikes.**
   Full file reads/base64 with no strict size guard.
   Evidence: [file_handler.rs:24](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/file_handler.rs:24), [file_handler.rs:28](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/file_handler.rs:28), [FileUpload.tsx:41](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/project/FileUpload.tsx:41), [project_cmds.rs:174](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:174)
   Low-risk optimization: hard upload size limits and preflight warnings (plus optional page-limited analysis).

7. **Low: Prompt logic duplication increases bloat/entropy.**
   Overlapping hardcoded prompts exist in multiple command files.
   Evidence: [ai_cmds.rs:57](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:57), [ai_cmds.rs:118](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:118), [ai_cmds.rs:351](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:351), [quiz_cmds.rs:267](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:267)

## Pruning Balance Assessment

- **Too aggressive:** cache/context pruning currently removes personalization where it matters (lesson/quiz reuse and explain context).
- **Not aggressive enough:** system prompt size, broad max tokens, and attachment limits leave meaningful token savings available.

## Assumptions

1. Static code audit only (no runtime traffic traces).
2. Token savings estimates are approximate heuristics.
