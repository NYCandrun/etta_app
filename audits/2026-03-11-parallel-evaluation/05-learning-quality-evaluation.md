# Learning Quality Evaluation Against Main Branch

- **Evaluated**: origin/main at commit `82a8863`
- **Compared against**: Learning quality findings from `audits/2026-03-11-multi-agent/05-learning-quality-agent-report.md`
- **Date**: 2026-03-11

## Results Summary

| Status | Count |
|--------|-------|
| FIXED | 1 |
| PARTIALLY ADDRESSED | 2 |
| NOT ADDRESSED | 3 |

---

## FIXED (1)

### 2. Quiz Contract Mismatch Breaks Question-Type Balance (P0)
Prompt, frontend types, and backend grading are now aligned on three types: `multiple_choice`, `fill_in_blank`, `free_response`. No unsupported types (`short_answer`, `true_false`) in prompt. Catch-all `_ => (false, 0.0)` is safe fallback only.

---

## PARTIALLY ADDRESSED (2)

### 1. Mastery Inflates Too Fast (P0)
**Prerequisite threshold fixed to 0.8** — `concepts.rs:114-117`, `progress_cmds.rs:319-323`, `session_builder.rs:144-148` all use `>= 0.8`. EMA weighting added for attempts 2+ at `quiz_cmds.rs:213-218`.

However, **first attempt still yields mastery = 1.0**: when `attempt_count == 0`, raw `compute_mastery` is used. With 1 correct attempt and no latency data, `compute_response_consistency` and `compute_transfer_success` both fall back to accuracy (1.0), yielding `0.50*1.0 + 0.25*1.0 + 0.25*1.0 = 1.0`. This immediately meets the 0.8 threshold on a single correct answer.

### 5. Grading Fairness Issues (P1)
**Case-insensitive matching** added at `quiz_cmds.rs:176-177` with whitespace trimming. **Prompt guardrails** instruct AI to only use fill-in-blank for answers with one unambiguous form (`tutor_prompt.txt:58-59,102-104`). Parse failure fallback gives 0.3 partial credit instead of zero.

However, **no numeric tolerance** exists (e.g., "3.14" vs "3.1416"), no symbolic equivalence ("x^2" vs "x**2"), no equivalent representations ("1/2" vs "0.5"). Parse failures still set `is_correct = false`, resetting `streak_correct` and triggering `ResponseQuality::Failed` in SM-2 despite the 0.3 score.

---

## NOT ADDRESSED (3)

### 3. Adaptive Context Too Thin (P1)
Curriculum JSON files contain `learning_objectives` (array) and `difficulty_tier` (integer) per concept. But:
- **Parser drops metadata**: `DomainConcept` struct (`graph.rs:24-29`) only captures `id`, `title`, `prerequisites`
- **DB drops metadata**: `concepts` table (`schema.sql:6-19`) has no columns for objectives or difficulty
- **Prompt drops metadata**: `build_user_message` (`prompt.rs:97-150`) sends only `id`, `title`, `domain`, `module`, `prerequisites`
- **No error_patterns** field exists anywhere

Rich curriculum metadata is systematically dropped at every layer.

### 4. Interleaving/Review Architecture Not Wired In (P1)
`interleave.rs` contains a complete `generate_interleaved_set` function with new/recent/review distribution logic. However, `session_builder.rs` (`build_daily_session`) does NOT call it. It uses simple logic: gather due reviews (truncated to 10), append up to 3 new concepts. `generate_interleaved_set` has zero callers outside its own file — it is dead code.

### 6. Diagnostic Is Self-Reported Familiarity Only (P2)
Diagnostic questions at `Diagnostic.tsx:66-71` present four self-assessment options ("I can explain confidently" / "I've seen before" / "I've heard of" / "I've never learned"). Scoring at lines 86-113 simply counts "confident" selections. No actual skill-testing questions, no validated measure of demonstrated ability.
