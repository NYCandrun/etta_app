# Etta App — Functionality & Usability Audit

## CRITICAL BUGS

### C1. Double XP Awarding
- **Files**: `src/hooks/useGamification.ts:41,44`, `src/stores/gamificationStore.ts:52-56`
- `awardXP` adds XP locally via `store.addXPEvent` AND sends to backend via `ipc.awardXp`. If `refresh()` fails, XP is permanently inflated.
- **Fix**: Don't add XP locally in `addXPEvent` — only show the popup. Let `refresh()` sync the real value from backend.

### C2. Hardcoded model in project submission
- **File**: `src-tauri/src/commands/project_cmds.rs:122`
- `submit_project` hardcodes `"claude-sonnet-4-20250514"` instead of reading user-configured model.
- **Fix**: Use `get_base_model(&conn)` like every other AI command.

### C3. QuizTimer drift — interval recreated every second
- **File**: `src/components/quiz/QuizTimer.tsx:40`
- `remaining` in useEffect deps causes interval to clear/recreate every tick, causing timer drift.
- **Fix**: Remove `remaining` from deps, use ref for `onTimeUp`.

## HIGH BUGS

### H1. Daily progress is faked
- **File**: `src/routes/Dashboard.tsx:58`
- `minutesCompleted` is hardcoded to either 100% or 40% — no actual time tracking.

### H2. Streak freeze key mismatch
- `activate_streak_freeze` reads/writes `"streak_freezes"` but `get_gamification_state` reads `"streak_freezes_available"`. Freeze activation has no visible effect.
- **Fix**: Standardize on one key name.

### H3. System theme doesn't react to OS changes
- `useSettings.ts:146-158` checks `matchMedia` once but never adds a `change` listener.

### H4. SessionSuggestion triggers double navigation
- `SessionSuggestion.tsx:85-88` calls both `onStart()` and `navigate("/lesson")`.

### H5. TopBar makes redundant `getCurriculumState` call on every page

### H6. `setSetting` coerces all values to strings, losing types
- `ipc.ts:19-23` — `setSetting("daily_goal", 30)` stores `"30"`.

### H7. Lesson XP farmable — no guard on repeated "Ready for quiz" clicks
- `src/routes/Lesson.tsx:60-64` awards 25 XP every time with no guard.
- **Fix**: Add `hasAwarded` ref.

### H8. Quiz XP awarded twice — `handleComplete` fires from both last answer and "Done" button
- `src/routes/Quiz.tsx:24-32` — `onComplete` called from `handleContinue` AND "Done" button.
- **Fix**: Add `xpAwarded` ref guard.

## MEDIUM BUGS

### M1. Memory leak: `URL.createObjectURL` never revoked (FIXED in this PR)

### M2. ProjectPrompt shows double dots (`.pdf` → `..pdf`)
- `ProjectPrompt.tsx:60` renders `.{fmt}` but `fmt` already includes the dot.

### M3. BrowserRouter incompatible with Tauri file protocol
- `src/main.tsx:13` — Should use `HashRouter` for Tauri.

### M4. `useGamification` refresh has store in deps, causing unnecessary effect runs

### M5. Offline banner doesn't disable AI-dependent operations

### M6. Project polling never stops if evaluation gets stuck

### M7. Quiz `totalScore` may miss last feedback due to stale closure

### M8. Export filename says "astrolabe" while app is named "Etta"

## LOW BUGS

- L1: `FeedbackDisplay` accepts unused `icon` prop
- L2: `handleInsertSymbol` stale closure on rapid inserts
- L3: TopBar hardcodes "algebra" domain as fallback
- L4: localStorage duplicates theme persistence with old branding
- L5: QuizFeedback "reasoning model" label off by one
- L6: `check_badges` never called from frontend
- L7: Dashboard retry doesn't use cancelled flag
- L8: QuizShell ignores prop updates after initial render
