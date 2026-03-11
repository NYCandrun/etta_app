# Prompt and App Optimization Evaluation Against Main Branch

- **Evaluated**: origin/main at commit `82a8863`
- **Compared against**: Prompt optimization findings from `audits/2026-03-11-multi-agent/04-prompt-and-app-optimization-agent-report.md`
- **Date**: 2026-03-11

## Results Summary

| Status | Count |
|--------|-------|
| FIXED | 0 |
| PARTIALLY ADDRESSED | 3 |
| NOT ADDRESSED | 4 |

---

## PARTIALLY ADDRESSED (3)

### 1. Cache Reuse Too Aggressive — Bypasses Adaptive Personalization (HIGH)
A 7-day staleness window was added in `content_cache.rs:48-58`. However, cache key remains `(concept_id, content_type)` only — does not incorporate mastery score, streak, or ease factor. Learner mastery changes within 7 days still serve stale content. `invalidate_cache` function exists at `content_cache.rs:102-108` but is **never called** from any command handler.

### 5. Cache Invalidation Underpowered (MEDIUM)
Three time-based mechanisms exist: 30-day startup purge, 7-day read-time TTL, per-concept pruning (keep 3 most recent). But **no event-driven invalidation**: mastery updates after quiz/project don't invalidate cache. `invalidate_cache` defined but zero callers. No invalidation on model change, settings change, or curriculum update.

### 6. Attachment Path Causes Token/Cost Spikes (MEDIUM)
25 MB file size guard added in `file_handler.rs:8,62-69`. However, 25 MB base64 = ~33 MB text = potentially hundreds of thousands of tokens with no token-level guard. `regrade_with_reasoning` at `ai_cmds.rs:156-173` accepts raw base64 image data with **no size validation at all**.

---

## NOT ADDRESSED (4)

### 2. Explain Flow Under-Contextualized (HIGH)
`request_explanation` at `ai_cmds.rs:266-334` builds ad-hoc user message with only `<concept>` metadata. Does NOT include `<mode>explain</mode>` tag, `<learner_context>` block, or use the shared `prompt::build_user_message` function. The tutor prompt expects these tags but they're never provided.

### 3. System Prompt Not Mode-Specific (HIGH)
Single 180-line `tutor_prompt.txt` loaded wholesale for every mode via `prompt.rs:154-166`. Contains instructions for all five modes (lesson, quiz, explain, evaluate, review) — all irrelevant noise for any single request. No mechanism to extract mode-relevant sections. Some commands bypass it entirely with inline prompts.

### 4. Token Budgets Not Per-Mode, Usage Not Instrumented (MEDIUM)
Single `DEFAULT_MAX_TOKENS: u32 = 4096` at `prompt.rs:6` used uniformly. Ad-hoc overrides exist (2048 for explain, 256 for grading) with no centralized policy. `Usage` struct exists in `types.rs:88-92` but response usage data is **never logged, stored, or surfaced**. No token-tracking, no cost monitoring.

### 7. Prompt Logic Duplication (LOW)
5+ callsites bypass the shared prompt builder with inline prompts: `explain_mistake`, `regrade_with_reasoning`, `request_explanation`, `verify_no_right_answer`, `grade_free_response`. `xml_escape` helper duplicated identically in both `quiz_cmds.rs:15-21` and `ai_cmds.rs:15-21`.
