# Functionality Audit Report — Astrolabe

**Date**: 2026-03-11
**Scope**: End-to-end data flow tracing across all features (frontend IPC → Rust backend → SQLite)

---

## 1. QUIZ FLOW

**Status: FUNCTIONAL**

**Trace**: `getQuiz()` (ipc.ts:191) → `get_quiz` (quiz_cmds.rs:12) → AI generation → cache → frontend parsing

- QuestionContext properly assembled from QuizShell.tsx before submitAnswer call
- `FrontendAnswer` and `QuestionContext` correctly deserialize with camelCase conversion
- MC grading: compares selected vs correct option ID
- Fill-in-blank: case-insensitive matching with partial credit
- Free response: calls `grade_free_response()` with AI, fallback to 0.3 partial credit
- Quiz completion: 10 base XP + (totalScore * 40) bonus, persisted to settings

### MEDIUM Issue: Default QuestionContext
- File: `ipc.ts:206-211`
- When `submitAnswer()` called without question context, creates minimal default with empty fields
- Answers still grade but tracking is incomplete

---

## 2. LESSON FLOW

**Status: FUNCTIONAL**

**Trace**: `getLesson()` (ipc.ts:173) → `get_lesson` (lesson_cmds.rs:9) → AI generation → cache

- Lesson caching works correctly (concept_id + "lesson" type)
- Model selection respects `base_model` setting
- `requestExplanation()` strategy rotation implemented correctly:
  - Strategies: `["default", "analogy", "visual", "step_by_step", "basics_review"]`
  - Index: `attempt % strategies.len()`
  - Escalates to reasoning model after 3 attempts
  - Returns `next_strategy` in response

---

## 3. DIAGNOSTIC TEST

**Status: FUNCTIONAL (design limitation)**

- File: `Diagnostic.tsx`
- Builds questions from curriculum concepts, samples 4 positions per domain (0%, 30%, 60%, 90%)
- Scores confident responses per domain, identifies `firstUnknown` concept
- Auto-enrolls in domain with lowest score

### MEDIUM Issue: Self-Assessment Only
- Questions are "How familiar are you with [concept]?" not actual math questions
- Diagnostic still works for placement but may be less accurate

---

## 4. LEARNING PATHS & PREREQUISITES

**Status: FUNCTIONAL**

- `LearningPath.tsx`: Concept locking based on state (mastered/in_progress/unlocked/locked)
- `curriculum/graph.rs`: DAG validation with cycle detection (iterative DFS with coloring)
  - Checks concept ID uniqueness
  - Validates all prerequisites resolve to existing concepts
  - Unit tests confirm cycle detection

---

## 5. SPACED REPETITION (SM-2)

**Status: CORRECTLY IMPLEMENTED**

**File**: `spaced_rep.rs`

| Response | Ease Change | Interval Change |
|----------|------------|-----------------|
| Easy (+streak>=3) | +0.1 | interval * ease_factor |
| Good | no change | interval * ease_factor |
| Hard (correct, slow >30s) | -0.2 | max(interval * ease, 1) |
| Failed | -0.2 | reset to 1 |

- Minimum ease floor: 1.3
- Mastery calculation: 50% accuracy + 25% consistency + 25% transfer success
- EWA weight: `1 / (attempt_count + 1)` — harmonic weighting

---

## 6. GAMIFICATION

**Status: MOSTLY FUNCTIONAL**

### HIGH Issue: XP Source/Description Not Stored
- File: `gamification_cmds.rs:93-97`
- `source` and `description` params marked `#[allow(unused)]` — received but discarded
- Frontend sends: `awardXP(25, "lesson_complete", "Completed lesson: ...")`
- Backend ignores source and description — no audit trail

### HIGH Issue: GamificationState Type Mismatch
- TS expects: `{ xp, level: { current, title, ... }, streak: { currentDays, ... }, badges, recentXpEvents }`
- Rust returns: `{ total_xp, level, xp_to_next_level, current_streak_days, longest_streak_days, badges }`
- Fields don't match: `xp` vs `total_xp`, nested `level` object vs flat `level` integer, `streak` object vs separate fields
- Frontend may not render gamification data correctly

**Working features**:
- Streak tracking: increments on daily activity, resets on gap
- Badge system: 10 conditions (streak 3/7/30, XP 100/1000, mastery 1/10/50, attempts 100)
- Level system: level N requires N*100 cumulative XP

---

## 7. DATA EXPORT

**Status: PARTIAL**

- File: `ai_cmds.rs:580-598`
- Exports: concepts, settings, submissions (up to 1000), timestamp, version
- **Missing**: quiz answer history, lesson attempt logs, per-question feedback, learning path progress

---

## 8. CONTENT CACHE

**Status: FUNCTIONAL**

- File: `content_cache.rs`
- Insert: stores quiz/lesson JSON, auto-prunes to 3 most recent per concept+type
- Retrieval: returns most recent (ORDER BY created_at DESC LIMIT 1)
- 30-day purge: `purge_cache_before()` runs on app startup in `lib.rs`
- Explicit invalidation function available

---

## 9. MODEL SELECTION

**Status: FUNCTIONAL — all commands respect settings**

| Command | Base Model | Escalation Model |
|---------|-----------|-----------------|
| get_quiz | Yes | — |
| get_lesson | Yes | — |
| grade_free_response | Yes | — |
| request_explanation | Yes | Yes (after 3 attempts) |
| explain_mistake | Yes | Yes (if escalate=true) |
| regrade_with_reasoning | — | Always |
| verify_no_right_answer | — | Always |

**Defaults**: Base = `claude-sonnet-4-20250514`, Escalation = `claude-opus-4-6`

---

## 10. CONTRACT MISMATCHES

### Verified (all match):

| Frontend (camelCase) | Backend (snake_case) | Status |
|---------------------|---------------------|--------|
| selectedOptionId | selected_option_id | Match |
| freeText | free_text | Match |
| filledBlanks | filled_blanks | Match |
| timeSpentMs | time_spent_ms | Match |
| isCorrect | is_correct | Match |
| questionId | question_id | Match |
| masteryScore | mastery_score | Match |

### Mismatched:

| Frontend Type | Backend Struct | Issue |
|--------------|---------------|-------|
| `GamificationState.xp` | `GamificationState.total_xp` | Field name mismatch |
| `GamificationState.level` (object) | `level` (i64) | Shape mismatch |
| `GamificationState.streak` (object) | `current_streak_days` (i64) | Shape mismatch |
| `GamificationState.recentXpEvents` | (not returned) | Missing field |

---

## PRIORITY SUMMARY

| Issue | Severity | Location |
|-------|----------|----------|
| GamificationState type mismatch | HIGH | gamification.ts vs gamification_cmds.rs |
| XP source/description not stored | HIGH | gamification_cmds.rs:93 |
| Diagnostic is self-assessment only | MEDIUM | Diagnostic.tsx |
| QuestionContext optional with empty default | MEDIUM | ipc.ts:206-211 |
| Data export missing quiz/lesson history | MEDIUM | ai_cmds.rs:580 |

### Top Actions
1. Fix GamificationState Rust struct to match TS interface (or add normalization in IPC layer)
2. Store XP source and description for analytics
3. Consider adding actual math questions to diagnostic
4. Make QuestionContext required in submitAnswer
5. Expand data export to include quiz answer history
