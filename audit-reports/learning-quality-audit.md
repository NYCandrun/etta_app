# Etta App — Educational Quality & Learning Audit

## 1. Curriculum Completeness

### Strengths
The curriculum is remarkably thorough — ~280+ concepts across 12 domains with well-defined learning objectives (typically 3 per concept). The concept counts are appropriate per domain (Algebra: 56, Calculus: 51, Astrophysics: 47, etc.). Each domain includes 3-4 capstone projects with required concepts.

### Gaps

**CRITICAL: Statistics and Probability is entirely absent.** The astrophysics curriculum references chi-squared minimization, density of states, probability density, Maxwell-Boltzmann distribution, and joint density functions — yet there is no statistics module. A learner needs: error analysis, probability distributions, hypothesis testing, Bayesian inference.

**MINOR: Geometry** not a standalone domain (coordinate geometry embedded in algebra, triangle geometry in trig). Acceptable for adult learners.

**MINOR: Fourier analysis** gets only a "preview" in linear algebra. Thin bridge to CMB power spectrum in astrophysics.

**MINOR: No PDEs module.** Physics courses reference PDEs but differential equations only covers ODEs.

**MINOR: Complex analysis absent.** Used extensively in QM and E&M but not systematically treated.

---

## 2. Curricular Dependencies

### Strengths
- DAG validation in `graph.rs` (unique IDs, resolved prerequisites, cycle detection via DFS)
- Prerequisite gate requires mastery_score >= 0.8 before unlocking
- Well-designed cross-domain dependencies (e.g., `diffeq_006` requires `mvc_010`, `qm_011` requires both `linalg_008` and `linalg_019`)

### Issues

**ISSUE: Mastery unlock check not decay-adjusted.** `get_unlocked_new_concepts` (concepts.rs:116) checks raw `mastery_score >= 0.8`, but `engine/decay.rs` has `effective_mastery()` that accounts for time decay. A learner who mastered algebra 6 months ago could access calculus with genuinely forgotten prerequisites.

**ISSUE: Very long prerequisite chains.** Reaching `astro_043` (Gravitational Lensing) requires traversing 200+ concepts. At one new concept per day, that's 200+ days minimum. For adult learners studying several hours/day, this is artificially constraining.

---

## 3. Progressive Difficulty

### Strengths
Each domain has `difficulty_tier` values (1-3) that progress appropriately.

### Issues

**CRITICAL: `difficulty_tier` and `learning_objectives` are dropped during curriculum loading.** `DomainConcept` in graph.rs only extracts id, title, prerequisites. The richest parts of the curriculum design (objectives, difficulty) are never stored in the DB or passed to the AI.

**ISSUE: No bridge content between domains.** Jump from precalculus limits to epsilon-delta proofs can be jarring.

---

## 4. Question Type Mix

### Issues

**CRITICAL: Quiz type mismatch between AI prompt and frontend.** The tutor prompt (tutor_prompt.txt:43) tells the AI to generate `short_answer | true_false`, but the frontend (quiz.ts:1) defines `multiple_choice | free_response | fill_in_blank`. The AI's `short_answer` responses hit the `_ => (false, 0.0)` default case, giving automatic zeros.

**ISSUE: Fill-in-blank grading is brittle.** `eq_ignore_ascii_case` after trimming means "2/4" vs "1/2" or "sqrt(2)/2" vs "1/sqrt(2)" fail. For a math app, this is a significant usability risk.

**ISSUE: No specification of question type mix.** The AI is free to generate all multiple-choice.

---

## 5. Grading Sanity

### Strengths
- AI-powered free-response grading with partial credit
- 5000-char limit prevents token exhaustion
- XML-escaping prevents prompt injection

### Issues

**ISSUE: `is_transfer` always hardcoded to `false`** (quiz_cmds.rs:208). 25% of the mastery model (transfer success) is non-functional.

**ISSUE: Mastery uses single-attempt EMA instead of rolling window.** After 20 attempts, each answer moves mastery by ~5%. A learner who initially struggled but "got it" takes very long to reach 0.8.

**ISSUE: 30-second "hard" threshold is fixed.** Fine for algebra, unreasonably short for QM derivations.

**ISSUE: No per-question answer history stored.** Can't show past wrong answers or identify error patterns.

**ISSUE: No numerical precision constraints.** AI may expect "3.14159" when learner writes "pi" or "3.14".

**ISSUE: No prohibition against multi-page proofs for low-difficulty concepts.**

---

## 6. Adaptive Learning Context

### Strengths
Context includes: mastery_score, attempt_count, streak_correct, ease_factor, last_latency_ms with clear interpretation guidance.

### Issues
- **Learning objectives not passed to AI** — missed opportunity for targeted questions
- **No error pattern tracking** — system stores correctness but not error types
- **No prerequisite mastery context** — AI doesn't know if learner's struggles stem from weak prerequisites

---

## 7. Spaced Repetition

### Strengths
Clean SM-2 implementation with ease floor of 1.3, streak/latency-aware classification.

### Issues
- **No max interval or ease cap** — ease can grow to 4.0+, scheduling reviews a year out
- **No initial step progression** (standard SM-2 uses 1 day → 6 days before multiplicative)

---

## 8. Session Building

### Issues

**CRITICAL: Only one new concept per session** (session_builder.rs:30). Adult learners studying hours/day are artificially constrained.

**ISSUE: No session size limit.** After a break, dozens of reviews accumulate with no cap.

**ISSUE: No review prioritization.** Most overdue first, but doesn't consider: decay level, prerequisite relationship to today's new concept.

---

## 9. Interleaving

**CRITICAL: Interleaving is implemented but never called.** `generate_interleaved_set` exists in interleave.rs but `build_daily_session` in session_builder.rs doesn't use it. Dead code.

---

## 10. AI Prompt Quality

### Strengths
Exceptionally well-written system prompt with clear persona, mastery-based adaptation, anti-condescension guidelines, LaTeX formatting.

### Issues
- **Quiz JSON schema mismatch** — AI outputs `question`/`correct_answer` but frontend expects `prompt`/`options[].isCorrect`
- **No precision constraints** for numerical answers
- **No difficulty calibration** tied to expected response length

---

## Priority Summary

1. **Quiz type/schema mismatch** (prompt vs frontend) — questions won't render/grade correctly
2. **`is_transfer` always false** — 25% of mastery model non-functional
3. **Learning objectives & difficulty tiers dropped** — richest curriculum data unused
4. **Interleaving dead code** — implemented but never called
5. **Statistics/probability missing** — required for physics
6. **Mastery unlock not decay-adjusted** — stale mastery passes prerequisite checks
7. **Only one new concept per session** — constraining for adult learners
8. **Mastery from single attempts** — multi-factor model underutilized
9. **Fill-in-blank doesn't handle math equivalence** — "1/2" ≠ "0.5"
10. **No max ease/interval cap** — reviews scheduled too far apart
