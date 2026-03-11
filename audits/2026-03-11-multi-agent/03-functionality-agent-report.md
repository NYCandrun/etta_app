# Functionality Agent Report

- Agent: `019cdbab-890e-7023-ad89-56250184565d`
- Scope: route correctness, API contracts, quiz/session/progress behavior, runtime failures and regressions
- Commit audited: `403e644`

## Findings (Prioritized)

1. **Critical: Lesson route is contract-broken and will crash at runtime.**
   Frontend treats `get_lesson` as structured `LessonContent`, but backend returns plain `String` markdown.
   Evidence: [ipc.ts:173](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:173), [lesson_cmds.rs:13](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/lesson_cmds.rs:13), [lesson_cmds.rs:79](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/lesson_cmds.rs:79), [Lesson.tsx:125](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Lesson.tsx:125), [LessonContent.tsx:58](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/lesson/LessonContent.tsx:58)

2. **Critical: Quiz route is contract-broken and will fail before question flow works.**
   Frontend expects full `QuizSession`, backend returns plain `String`.
   Evidence: [ipc.ts:191](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:191), [quiz_cmds.rs:16](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:16), [quiz_cmds.rs:79](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:79), [Quiz.tsx:91](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Quiz.tsx:91), [QuizShell.tsx:36](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:36)

3. **Critical: Project route API contracts do not match backend signatures/shapes.**
   `get_projects` and `submit_project` payload shapes differ across frontend/backend.
   Evidence: [ipc.ts:248](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:248), [ipc.ts:257](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:257), [project_cmds.rs:23](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:23), [project_cmds.rs:50](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:50), [project_cmds.rs:61](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/project_cmds.rs:61), [Project.tsx:26](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Project.tsx:26), [Project.tsx:72](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Project.tsx:72), [ProjectPrompt.tsx:15](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/project/ProjectPrompt.tsx:15)

4. **Critical: Gamification state shape mismatch can corrupt dashboard state (`undefined`/`NaN`).**
   Frontend and backend objects differ materially.
   Evidence: [gamification.ts:1](/Users/jacobnikolau/Documents/Codex/etta_app/src/types/gamification.ts:1), [gamification_cmds.rs:8](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/gamification_cmds.rs:8), [gamificationStore.ts:59](/Users/jacobnikolau/Documents/Codex/etta_app/src/stores/gamificationStore.ts:59), [gamificationStore.ts:55](/Users/jacobnikolau/Documents/Codex/etta_app/src/stores/gamificationStore.ts:55), [Dashboard.tsx:44](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:44)

5. **High: Quiz XP can be awarded multiple times for one completion.**
   XP awarded in backend and frontend; completion callback triggered twice.
   Evidence: [quiz_cmds.rs:309](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:309), [quiz_cmds.rs:335](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/quiz_cmds.rs:335), [QuizShell.tsx:143](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:143), [QuizShell.tsx:227](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:227), [Quiz.tsx:24](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Quiz.tsx:24)

6. **High: Settings/API-key lifecycle has multiple correctness regressions.**
   `set_setting` typing mismatch, `test_api_key` signature mismatch, and false success states.
   Evidence: [settings_cmds.rs:14](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/settings_cmds.rs:14), [useSettings.ts:85](/Users/jacobnikolau/Documents/Codex/etta_app/src/hooks/useSettings.ts:85), [ipc.ts:31](/Users/jacobnikolau/Documents/Codex/etta_app/src/lib/ipc.ts:31), [settings_cmds.rs:30](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/settings_cmds.rs:30), [Settings.tsx:47](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:47), [useSettings.ts:35](/Users/jacobnikolau/Documents/Codex/etta_app/src/hooks/useSettings.ts:35), [settings_cmds.rs:25](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/settings_cmds.rs:25)

7. **High: Prerequisite gating unlocks too early (`mastery_score > 0`).**
   Violates intended mastery-based progression.
   Evidence: [concepts.rs:102](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/concepts.rs:102), [concepts.rs:116](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/db/concepts.rs:116), [progress_cmds.rs:310](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/progress_cmds.rs:310), [progress_cmds.rs:314](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/progress_cmds.rs:314), [session_builder.rs:27](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/engine/session_builder.rs:27)

8. **Medium: Diagnostic route has race-condition and failure-state gaps.**
   `setTimeout` closure races and potential blank-screen return.
   Evidence: [Diagnostic.tsx:142](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:142), [Diagnostic.tsx:154](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:154), [Diagnostic.tsx:159](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:159), [Diagnostic.tsx:335](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:335)

9. **Medium: Progress/feedback reporting is synthetic.**
   Mastery history and submission feedback are hardcoded or limited.
   Evidence: [ai_cmds.rs:400](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:400), [ai_cmds.rs:410](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:410), [ai_cmds.rs:562](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:562), [ai_cmds.rs:565](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:565), [ai_cmds.rs:571](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/src/commands/ai_cmds.rs:571)

10. **Medium: Verification tooling is partially non-functional at HEAD.**
    `npm run lint` fails (missing ESLint v9 flat config), and `cargo test` blocked by Tauri feature/allowlist mismatch.
    Evidence: [package.json:11](/Users/jacobnikolau/Documents/Codex/etta_app/package.json:11), [Cargo.toml:8](/Users/jacobnikolau/Documents/Codex/etta_app/src-tauri/Cargo.toml:8)

## Assumptions / Limits

1. Static + build/check based audit (`typecheck`, `build`, command tracing).
2. Full Tauri runtime flows were not executable due the feature mismatch.
