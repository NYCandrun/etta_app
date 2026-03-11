# UI/UX and Usability Agent Report

- Agent: `019cdbab-8877-70b3-bfdf-b393d998b6bf`
- Scope: UI/UX, accessibility, usability, navigation, responsiveness, interaction quality
- Commit audited: `403e644`

## Code-Level Findings (Prioritized)

1. **Critical: Quiz completion can award XP repeatedly (exploit).**
   `onComplete` is called once when the last answer is submitted and again from the `Done` button on summary, re-triggering XP awarding logic in route state.
   Evidence: [QuizShell.tsx:131](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:131), [QuizShell.tsx:227](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizShell.tsx:227), [Quiz.tsx:24](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Quiz.tsx:24)

2. **High: Diagnostic can hard-fail to a blank screen when content load fails/returns empty.**
   Phase advances to intro even on fetch failure, and testing phase returns `null` if there is no current question.
   Evidence: [Diagnostic.tsx:125](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:125), [Diagnostic.tsx:137](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:137), [Diagnostic.tsx:335](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:335)

3. **High: Mobile responsiveness is structurally weak.**
   Fixed sidebar + dense top bar + desktop paddings are always on, with no breakpoint-driven mobile nav mode.
   Evidence: [Shell.tsx:11](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/layout/Shell.tsx:11), [Sidebar.tsx:73](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/layout/Sidebar.tsx:73), [TopBar.tsx:90](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/layout/TopBar.tsx:90)

4. **High: Key interactive learning elements are not keyboard-accessible.**
   Path cards use clickable `div` without semantic button/link behavior, and skill tree nodes are mouse-only D3 interactions.
   Evidence: [Dashboard.tsx:254](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:254), [Dashboard.tsx:256](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:256), [SkillTree.tsx:186](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/dashboard/SkillTree.tsx:186)

5. **High: API key save can show false success on failure.**
   Error path still sets key state to set/masked.
   Evidence: [Settings.tsx:47](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:47)

6. **Medium: Error feedback is frequently swallowed.**
   Creates empty-state masquerading as success/no data.
   Evidence: [Project.tsx:31](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Project.tsx:31), [Project.tsx:77](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Project.tsx:77), [Dashboard.tsx:30](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:30), [Diagnostic.tsx:134](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:134)

7. **Medium: Daily progress shown is hardcoded/faked (40% default).**
   Not derived from actual tracked minutes.
   Evidence: [Dashboard.tsx:44](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:44), [TopBar.tsx:80](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/layout/TopBar.tsx:80)

8. **Medium: Form semantics/accessibility gaps in Settings.**
   Password input lacks proper label; segmented controls miss pressed-state semantics; select labels are not programmatically associated.
   Evidence: [Settings.tsx:134](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:134), [Settings.tsx:193](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:193), [Settings.tsx:218](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:218), [Settings.tsx:247](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:247)

9. **Medium: Icon-only buttons are missing accessible names.**
   Evidence: [LearningPath.tsx:98](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/LearningPath.tsx:98), [QuizFeedback.tsx:202](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/quiz/QuizFeedback.tsx:202)

10. **Medium: Contrast risk for secondary text.**
    `warm-400` (`#a8a29e`) on white is ~2.52:1 and below WCAG AA for normal text.
    Evidence: [theme.css:75](/Users/jacobnikolau/Documents/Codex/etta_app/src/styles/theme.css:75), [Dashboard.tsx:77](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Dashboard.tsx:77)

11. **Medium: Dynamic status updates are not announced to assistive tech.**
    Evidence: [Settings.tsx:161](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Settings.tsx:161), [SubmissionStatus.tsx:17](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/project/SubmissionStatus.tsx:17)

12. **Medium: UI/a11y tooling guardrail is broken.**
    `npm run lint` fails because ESLint v9 flat config is missing.
    Evidence: [package.json:11](/Users/jacobnikolau/Documents/Codex/etta_app/package.json:11)

## Product-Level Usability Findings

1. IA mismatch: core routes (`/diagnostic`, `/path/:domainId`) are not all discoverable from main nav.
   Evidence: [App.tsx:39](/Users/jacobnikolau/Documents/Codex/etta_app/src/App.tsx:39), [Sidebar.tsx:11](/Users/jacobnikolau/Documents/Codex/etta_app/src/components/layout/Sidebar.tsx:11)

2. Diagnostic flow is high-friction: self-assessment wording, auto-advance, and no back/edit reduce placement confidence.
   Evidence: [Diagnostic.tsx:79](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:79), [Diagnostic.tsx:153](/Users/jacobnikolau/Documents/Codex/etta_app/src/routes/Diagnostic.tsx:153)

3. Feedback trust issue: several flows fail silently, so users cannot tell no-data from request-failure.

4. Performance risk: production bundle includes a large JS chunk (~1.19MB minified), which can degrade low-end/mobile responsiveness.

## Recommended Improvements (Priority Order)

1. Fix XP duplication and diagnostic blank-screen failures first.
2. Implement mobile navigation mode (collapsible sidebar, compact top bar, reduced default paddings).
3. Make interactive visuals keyboard-operable and semantic (`button`/`a`, `aria-*`, focus management).
4. Replace silent catches with explicit inline error states and retry actions.
5. Run a full accessibility pass: contrast tokens, labeled controls, live regions.
6. Restore linting with ESLint v9 flat config + `jsx-a11y` rules.
7. Improve performance via route/component code-splitting and chunk strategy.

Validation from this audit pass: `typecheck` passed, `build` passed (large chunk warning), `lint` failed due to missing ESLint flat config.
