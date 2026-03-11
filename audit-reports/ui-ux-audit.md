# Etta App — UI/UX Audit Report

## 1. FreeResponse Component

**Issue 1.1: Textarea too small (FIXED)** — Increased rows to 6/8/10 with minHeight 8rem/12rem.

**Issue 1.2: MathKeyboard below Submit button (FIXED)** — Moved directly below textarea.

**Issue 1.3: File upload always visible (FIXED)** — Collapsed into `<details>` disclosure.

**Issue 1.4: No aria-label on textarea** — SKIPPED (accessibility, not priority per user).

**Issue 1.5: `alert()` for oversized files** — Native `alert()` is jarring, should use inline error. (Not fixed — minor UX)

**Issue 1.6: Memory leak in image preview** — `URL.createObjectURL(file)` called on every render, never revoked.

---

## 2. Quiz Flow Layout

**Issue 2.1: Quiz container too narrow (max-w-2xl = 672px)** — Should be max-w-3xl for FreeResponse questions.

**Issue 2.2: No card wrapper around question content** — Questions float without container while feedback has one.

**Issue 2.3: No keyboard shortcut for Continue after feedback** — SKIPPED (accessibility).

**Issue 2.4: Completion summary width mismatch** — max-w-lg vs max-w-2xl creates visual jump.

---

## 3. Responsive Design (SKIPPED per user — not priority)

- Sidebar has no mobile/collapsed state
- TopBar overflow on small screens
- MathKeyboard grid doesn't adapt well
- Dashboard grid lacks xl breakpoint

---

## 4. Accessibility (SKIPPED per user — not priority)

- SkillTree has no keyboard navigation
- Multiple buttons lack aria-labels
- Color-only status indication
- Diagnostic auto-advance timing
- Focus ring border-radius mismatch

---

## 5. Loading States

**Positive:** SkeletonLoader is well-implemented with role="status", aria-label, micro-messages.

**Issue 5.2: Quiz loading produces layout shift** — Skeleton in `card` wrapper doesn't match QuizShell.

**Issue 5.3: Inconsistent loading patterns** — LearningPath/Diagnostic use spinners, Dashboard/Quiz use SkeletonLoader.

---

## 6. Error States

**Positive:** ErrorBoundary is comprehensive.

**Issue 6.2: Silent error swallowing** — Settings handleExport, StreakFreeze activation, Project file selection all fail silently.

**Issue 6.3: Quiz fallback has no retry button** — "Unable to load quiz" only offers "Back to Lesson."

---

## 7. Navigation

**Issue 7.1: No back navigation in Quiz/Lesson pages** — LearningPath has back arrow but Quiz and Lesson don't.

**Issue 7.3: "Start Learning" button logic is non-obvious** — Navigates to different pages depending on state without indicating destination.

---

## 8. Visual Hierarchy & Typography

**Positive:** Consistent heading hierarchy across routes.

**Issue 8.2: `.prose-warm` class not defined** — Referenced in LessonContent.tsx and QuizFeedback.tsx but `@tailwindcss/typography` not installed. Class does nothing.

**Issue 8.3: `font-mono` on non-math free responses** — Monospace for prose explanations is wrong.

---

## 9. Feedback & Interaction

**Positive:** Button states (hover, focus-visible, active, disabled) well-defined.

**Issue 9.3: XPPopup could overlap quiz content** — `fixed bottom-24 right-8` may overlap submit area.

---

## 10. Math Rendering

**Positive:** AccessibleMath uses KaTeX with DOMPurify, role="math", aria-label, graceful fallback.

**Issue 10.2: MathKeyboard inserts Unicode, not LaTeX** — Unicode symbols can't round-trip through KaTeX rendering.

---

## 11. Dark Mode / Theming

**Issue 11.1: Theme CSS missing dark-mode overrides for semantic colors** — primary/accent/success/danger not overridden in dark mode CSS variables.

**Issue 11.2: StreakFreeze/StreakDisplay use Tailwind `blue-*` not in theme** — Should use `primary` palette.

---

## 12. Gamification UI

**Positive:** XPPopup is brief (1.5s), non-intrusive, pointer-events-none.
**Positive:** DailyGoalRing celebration particles well-implemented.

**Issue 12.3: Infinite streak flame animation** — Perpetual repaints on dashboard.
**Issue 12.4: Badge gallery uses emoji for icons** — Platform-inconsistent rendering.

---

## Priority Summary (excluding accessibility/mobile)

**High:**
1. `.prose-warm` class not defined (LessonContent.tsx, QuizFeedback.tsx)
2. `font-mono` applied to non-math free responses
3. Quiz container too narrow for FreeResponse
4. Completion summary width mismatch
5. Silent error swallowing in multiple components
6. Object URL memory leak in image previews

**Medium:**
7. No back navigation in Quiz/Lesson
8. Theme dark-mode variable gaps
9. Inconsistent `blue-*` colors in StreakFreeze/StreakDisplay
10. No retry on quiz load failure
11. Loading pattern inconsistency

**Low:**
12. XPPopup positioning overlap
13. Infinite streak flame animation
14. Emoji badge rendering
15. MathKeyboard Unicode vs LaTeX
