# Learning Quality Agent Report

- Agent: `019cdbab-898b-7cf0-a345-c98e65da29fe`
- Scope: adaptive learning quality, progression logic, curriculum dependencies, question mix, grading sanity for adult learners
- Commit audited: `403e644`

## Findings (Prioritized)

1. **P0: Mastery inflates too fast, unlocking advanced concepts prematurely.**
   Single attempt can push mastery near 1.0; prerequisites unlock at `mastery_score > 0.0`.
   Evidence: [quiz_cmds.rs:188](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:188), [mastery.rs:23](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/mastery.rs:23), [mastery.rs:54](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/mastery.rs:54), [mastery.rs:79](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/mastery.rs:79), [concepts.rs:103](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/concepts.rs:103), [concepts.rs:116](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/concepts.rs:116), [progress_cmds.rs:311](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/progress_cmds.rs:311)
   Fix: require prereq mastery `>= 0.8` plus minimum attempts (for example 3); compute mastery from rolling attempt windows and persist attempt-level records.

2. **P0: Quiz contract mismatch breaks question-type balance and grading reliability.**
   Prompt asks for unsupported types (`short_answer|true_false`); frontend/backend support only `multiple_choice|free_response|fill_in_blank`; unknown types score as zero.
   Evidence: [tutor_prompt.txt:42](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/tutor_prompt.txt:42), [quiz.ts:1](/Users/jacobnikolau/Documents/Codex/etta_app/src/types/quiz.ts:1), [quiz_cmds.rs:139](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:139), [quiz_cmds.rs:173](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:173), [quiz_cmds.rs:16](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:16), [ipc.ts:191](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:191), [QuizShell.tsx:36](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:36)
   Fix: strict backend `QuizSession` schema with serde validation, prompt type alignment, and normalization/repair before UI delivery.

3. **P1: Adaptive context sent to model is too thin for adult-quality personalization.**
   Curriculum stores richer metadata but parser/DB/prompt flow drops key fields.
   Evidence: [algebra.json:17](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/curriculum/algebra.json:17), [algebra.json:22](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/curriculum/algebra.json:22), [graph.rs:24](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/curriculum/graph.rs:24), [graph.rs:69](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/curriculum/graph.rs:69), [schema.sql:6](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/resources/schema.sql:6), [prompt.rs:107](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/api/prompt.rs:107)
   Fix: persist/inject objectives, difficulty tier, recent error patterns, and prerequisite mastery vector into prompts.

4. **P1: Interleaving/review architecture exists but is not wired into live session generation.**
   Interleave engine exists but sessions are simplistic and review generation is not clearly surfaced.
   Evidence: [interleave.rs:33](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/interleave.rs:33), [session_builder.rs:24](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/session_builder.rs:24), [lib.rs:61](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/lib.rs:61), [lib.rs:67](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/lib.rs:67)
   Fix: drive due concepts through interleave ratios, cap due load, and generate dedicated review-mode question sets.

5. **P1: Grading fairness issues (over-precision and punitive fallbacks).**
   Fill-in-blank relies on strict exact matching with near-perfect threshold; parse failures can penalize learner unfairly.
   Evidence: [quiz_cmds.rs:152](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:152), [quiz_cmds.rs:158](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:158), [quiz_cmds.rs:294](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:294)
   Fix: numeric tolerance/equivalence checks, acceptable-answer sets, score clamping to `[0,1]`, and `ungraded/retry` path for format failures.

6. **P2: Initial diagnostic is self-reported familiarity, not demonstrated ability.**
   Scoring mostly reflects confidence responses.
   Evidence: [Diagnostic.tsx:65](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:65), [Diagnostic.tsx:96](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:96)
   Fix: competency probes with short solved items, then map to starting nodes and remediation.

## Curriculum Dataset Check

Across `src-tauri/resources/curriculum/*.json`, the concept graph is structurally strong (12 domains, 421 concepts, acyclic, no unresolved prerequisite IDs), but runtime progression logic currently undermines that quality.

## Validation Note

`cargo test` could not run due Tauri feature mismatch (`macos-private-api` allowlist error).
