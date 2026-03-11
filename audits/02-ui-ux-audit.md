# UI/UX Audit Report — Astrolabe

**Date**: 2026-03-11
**Scope**: Frontend React/TypeScript components, routes, accessibility, responsive design, math rendering

---

## 1. ACCESSIBILITY (a11y)

### CRITICAL

**1.1 Missing ARIA labels throughout the application**
- Files: `TopBar.tsx:105-146`, `DailyGoalRing.tsx:50-156`, `QuizTimer.tsx:51-87`, `StreakDisplay.tsx`, `LatexBlock.tsx`
- SVG icons, progress rings, streaks, and stats lack accessible names
- Screen readers cannot identify visual indicators (XP, level, daily goal progress)
- **Fix**: Add `aria-label`, `role="progressbar"`, `aria-valuenow` attributes

**1.2 Quiz input fields lack proper labels**
- Files: `FillInBlank.tsx:99-126`, `FreeResponse.tsx:70-82`
- FillInBlank inline inputs use placeholder + `aria-label` but no `<label>` element
- FreeResponse textarea has placeholder only, no associated label
- File upload button triggers hidden input with no label
- **Fix**: Use explicit `<label>` elements with `for` attributes

**1.3 Focus management and keyboard navigation gaps**
- Files: `MultipleChoice.tsx`, `Sidebar.tsx:89-104`, `LearningPath.tsx:156-230`
- No skip links in Shell layout
- Locked concepts use `disabled` but lack `aria-disabled` for semantic clarity
- Tab order not documented
- **Fix**: Add skip navigation, improve focus order, use `aria-disabled` for locked content

### HIGH

**1.4 Math rendering accessibility — raw LaTeX as aria-label**
- Files: `AccessibleMath.tsx:24-30`, `LessonContent.tsx:15-42`
- `aria-label={latex}` exposes raw LaTeX code (e.g., `\frac{a}{b}`) instead of spoken description
- Blind users hear raw LaTeX instead of "a over b"
- **Fix**: Use MathML-aware speech rule engine or provide human-readable descriptions

**1.5 Color-dependent indicators without text alternatives**
- Files: `Diagnostic.tsx:349`, `LearningPath.tsx:170-193`
- Progress bars use color alone to indicate state
- Domain color circles are purely decorative
- Mastery score shown in colored text relying on color distinction
- **Fix**: Add text labels alongside color (e.g., "Mastered" in green, not just green)

**1.6 Missing form validation and error state announcements**
- Files: `Settings.tsx:38-92`
- API Key input has no validation feedback
- Test result display uses animations but no ARIA live region
- **Fix**: Use `aria-live="polite"` for status, `aria-busy="true"` during async ops

---

## 2. RESPONSIVE DESIGN

### HIGH

**2.1 Sidebar never hidden on mobile**
- File: `Sidebar.tsx:73`
- Fixed 240px sidebar always visible — leaves ~80px on iPhone
- **Fix**: Add `hidden lg:flex` with hamburger menu on mobile

**2.2 Shell layout padding too large on small screens**
- File: `Shell.tsx:11-20`
- `px-8 py-6` = 32px horizontal padding on all screens
- Content overflows below 272px viewport
- **Fix**: Use `px-4 md:px-8`, reduce padding on mobile

### MEDIUM

**2.3 Dashboard grid inflexible on tablets**
- File: `Dashboard.tsx:56-64`
- `md:grid-cols-3` forces skill tree to dominate at 768px
- **Fix**: Adjust to `md:grid-cols-2` for medium screens

**2.4 TopBar cramped on small screens**
- File: `TopBar.tsx:90-147`
- Multiple badges (Start Learning + XP + Streak + Daily goal + Level) overflow on mobile
- **Fix**: Hide non-critical badges on mobile, show only essential actions

**2.5 Quiz content max-width not responsive**
- Files: `Quiz.tsx:73`, `Lesson.tsx:106`
- `max-w-2xl` (42rem) leaves tiny margins on 375px phones
- **Fix**: Add responsive padding `px-4 md:px-8`

---

## 3. LOADING STATES & ERROR HANDLING

### CRITICAL

**3.1 Silent IPC error failures**
- Files: `Dashboard.tsx:27-31`, `Quiz.tsx:17-22`, `Lesson.tsx:30-35`, `TopBar.tsx:33-42`
- Empty catch blocks swallow errors — user sees blank screen forever
- ```typescript
  try { const state = await ipc.getCurriculumState(); }
  catch { /* empty — silent failure! */ }
  ```
- **Fix**: Show error toast or inline message: "Failed to load. Please try again."

### MEDIUM

**3.2 Inconsistent offline error messaging**
- QuizShell: "Unable to evaluate right now. We'll check this when you're back online."
- Lesson: "I'm having trouble generating a new explanation right now..."
- No unified offline error handling
- **Fix**: Create shared `useOfflineError()` hook or error constants

**3.3 Missing loading indicators**
- Settings: No loading indicator when saving API key (only button disabled)
- File upload: No spinner during processing
- **Fix**: Add loading spinners for async operations

---

## 4. NAVIGATION

### MEDIUM

**4.1 No back button or unsaved changes protection in quiz/lesson**
- Files: `QuizShell.tsx`, `Quiz.tsx`, `Lesson.tsx`
- Users lose progress if they navigate away mid-quiz
- No confirmation dialog
- **Fix**: Add `beforeunload` handler or confirmation dialog

**4.2 Learning Path breadcrumb missing**
- File: `LearningPath.tsx:96-125`
- Back button exists but no breadcrumb (Dashboard > Learning Path > [Domain])
- **Fix**: Add breadcrumb or update TopBar to show domain name

---

## 5. VISUAL CONSISTENCY

### MEDIUM

**5.1 Inconsistent button labels across quiz types**
- MultipleChoice: "Check Answer"
- FreeResponse: "Submit Answer"
- FillInBlank: "Check Answer"
- **Fix**: Standardize to "Check Answer" for all types

**5.2 Card styling variations**
- Some cards have borders, others don't
- Inconsistent padding, shadows, max-width
- **Fix**: Enforce consistent card variants (elevated, outlined)

**5.3 Dark mode edge cases**
- `darkMode: "class"` in tailwind config
- Most components use `dark:` prefixes but no comprehensive testing
- **Fix**: Test dark mode across all routes

---

## 6. ANIMATION & PERFORMANCE

### MEDIUM

**6.1 No reduced-motion support**
- File: `MultipleChoice.tsx:95-106`
- Framer Motion `whileHover/whileTap` on every option with no `prefers-reduced-motion` check
- **Fix**: Use `useReducedMotion()` hook from Framer Motion

### LOW

**6.2 SVG progress circles re-render unnecessarily**
- Files: `DailyGoalRing.tsx`, `QuizTimer.tsx`, `TopBar.tsx`
- No `useMemo` for SVG rendering
- **Fix**: Memoize circle components

**6.3 Inconsistent animation durations**
- QuizShell progress: 0.3s; Dashboard progress: 1s
- **Fix**: Standardize in design tokens

---

## 7. QUIZ UX FLOW

### MEDIUM

**7.1 No question-by-question review on completion**
- File: `QuizShell.tsx:159-231`
- Shows final score + XP but no breakdown of which questions were correct
- **Fix**: Add expandable "Review Answers" section

**7.2 File uploads feel lost**
- Files uploaded during free response aren't displayed in feedback
- Re-grade button appears but result not prominent
- **Fix**: Show uploaded file in feedback, display re-grade result clearly

### LOW

**7.3 No skip/flag mechanism for questions**
- Users forced to answer sequentially with no "come back later" option
- **Fix**: Consider adding "Flag for Review" button

---

## 8. MATH RENDERING

### CRITICAL

**8.1 Bare LaTeX parsing ambiguity**
- File: `katex-utils.ts:31-47`
- Patterns match `\sqrt{...}`, `\frac{...}{...}` without delimiters
- Ambiguity: is `\sqrt{2}` LaTeX or plain text?
- **Fix**: Require explicit `$...$` or `\(...\)` delimiters, reject bare commands

### HIGH

**8.2 LaTeX error fallback shows raw code**
- File: `AccessibleMath.tsx:37-46`
- Failed KaTeX parsing shows raw LaTeX in `<code>` block
- **Fix**: Show "Math display error" message, log details to console

### MEDIUM

**8.3 Display math spacing/centering**
- `my-4` (1rem) may be insufficient; no explicit centering
- **Fix**: Add `text-center` and increase vertical margin

---

## PRIORITY SUMMARY

| Priority | Category | Count |
|----------|----------|-------|
| CRITICAL | Accessibility, Error Handling, Math Rendering | 5 |
| HIGH | Accessibility, Responsive Design, Math Rendering | 5 |
| MEDIUM | All categories | 14 |
| LOW | Animation, Quiz UX | 3 |

### Top 8 Actions
1. Add ARIA labels and form accessibility (CRITICAL)
2. Fix silent IPC error handling (CRITICAL)
3. Resolve bare LaTeX parsing ambiguity (CRITICAL)
4. Hide sidebar on mobile with hamburger menu (HIGH)
5. Replace raw LaTeX error fallback (HIGH)
6. Add accessible math descriptions for screen readers (HIGH)
7. Add quiz question review on completion (MEDIUM)
8. Standardize button labels and card styling (MEDIUM)
