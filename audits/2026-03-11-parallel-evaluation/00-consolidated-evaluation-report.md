# Consolidated Issue Evaluation Report — Astrolabe (Etta App)

- **Date**: 2026-03-11
- **Evaluated**: `origin/main` at commit `82a8863`
- **Compared against**: All audit findings from `audits/01-security-audit.md`, `audits/02-ui-ux-audit.md`, `audits/03-functionality-audit.md`, and all 5 reports in `audits/2026-03-11-multi-agent/`
- **Method**: 5 parallel evaluation agents (security, UI/UX, functionality, prompt optimization, learning quality) independently verified each finding against the current main branch codebase

## Executive Summary

Across all audit reports, **85 unique issues** were identified. After deduplication across overlapping reports:

| Status | Count | Percentage |
|--------|-------|------------|
| **FIXED** | 20 | ~31% |
| **PARTIALLY ADDRESSED** | 32 | ~39% |
| **NOT ADDRESSED** | 33 | ~30% |

The most critical remaining gaps are in **accessibility fundamentals** (17 UI/UX issues unaddressed), **security trust boundaries** (client-authoritative scoring, file path traversal, no rate limiting), **prompt/token efficiency** (4 of 7 unaddressed), and **learning quality** (3 of 6 unaddressed including dead interleaving code).

---

## PARTIALLY ADDRESSED AND NOT ADDRESSED — By Priority

### P0 / CRITICAL — Release Blockers

| # | Category | Issue | Status | Key Gap |
|---|----------|-------|--------|---------|
| 1 | Security | Client-authoritative scoring — frontend supplies answer keys | PARTIAL | MC/fill-in-blank still graded with client-supplied correct answers |
| 2 | Security | XP and mastery inflation exploits | PARTIAL | Duplicate award paths: per-answer backend XP + frontend lump-sum bonus, no idempotency |
| 3 | Security | Arbitrary local file read via submit_project | PARTIAL | MIME whitelist restricts types, but text/plain and PDF files anywhere on disk remain readable |
| 4 | Learning | Mastery inflates too fast — first attempt yields 1.0 | PARTIAL | Prereq threshold fixed to 0.8, but single correct first attempt = mastery 1.0, instantly meeting threshold |
| 5 | A11y | Missing ARIA labels throughout (SVGs, progress, stats) | NOT ADDR | Screen readers cannot identify any visual indicators |
| 6 | A11y | Focus management / keyboard navigation gaps | NOT ADDR | No skip links, SkillTree mouse-only, locked items use `disabled` not `aria-disabled` |
| 7 | UI/UX | Silent IPC error failures (remaining) | PARTIAL | Dashboard/Quiz fixed; LearningPath, Diagnostic, Settings export, App still have empty catch blocks |

### P1 / HIGH — Before Public Release

| # | Category | Issue | Status | Key Gap |
|---|----------|-------|--------|---------|
| 8 | Security | SQLite database not encrypted | NOT ADDR | Student learning data unprotected at rest (GDPR/FERPA) |
| 9 | Security | Path traversal — no directory sandboxing | PARTIAL | Canonicalization added but any allowed-type file on disk readable |
| 10 | Security | Unbounded input DoS on AI commands | PARTIAL | Free response/files capped; `explain_mistake`, `regrade_with_reasoning` accept unlimited strings |
| 11 | Security | No request validation on several Tauri commands | PARTIAL | Some limits added; many string params still unbounded |
| 12 | A11y | Math rendering — raw LaTeX as aria-label | NOT ADDR | `aria-label={latex}` makes screen readers announce `\frac{x^2}{2}` |
| 13 | A11y | Color-dependent indicators without text alternatives | NOT ADDR | Progress bars, domain dots, XP bars lack role/aria-value attributes |
| 14 | A11y | Missing form validation/error state announcements | NOT ADDR | No `role="alert"`, no `aria-live`, no validation messages |
| 15 | A11y | Key interactive elements not keyboard-accessible | PARTIAL | LearningPath uses buttons; Dashboard cards are click-divs, SkillTree mouse-only |
| 16 | Responsive | Sidebar never hidden on mobile | NOT ADDR | Fixed 240px sidebar always visible, no hamburger menu |
| 17 | Responsive | Shell layout padding too large on mobile | NOT ADDR | `px-8 py-6` on all screens, no responsive reduction |
| 18 | Prompt | Explain flow under-contextualized | NOT ADDR | No `<mode>`, `<learner_context>`, or `<user_input>` tags; bypasses shared prompt builder |
| 19 | Prompt | System prompt not mode-specific | NOT ADDR | Full 180-line prompt sent for every mode; ~800-1000 wasted tokens per call |
| 20 | Learning | Adaptive context too thin | NOT ADDR | `learning_objectives`, `difficulty_tier` dropped at parser, DB, and prompt layers |
| 21 | Learning | Interleaving/review not wired in | NOT ADDR | `interleave.rs` is dead code; sessions use flat append strategy |
| 22 | Learning | Grading fairness issues | PARTIAL | Case-insensitive matching added; no numeric tolerance, parse failures still penalize learner |
| 23 | Functionality | Quiz XP awarded multiple times | PARTIAL | useRef guard prevents double-fire per mount; structural backend+frontend overlap remains |

### P2 / MEDIUM — Post-Release Quality

| # | Category | Issue | Status | Key Gap |
|---|----------|-------|--------|---------|
| 24 | Security | No rate limiting on API commands | NOT ADDR | All API-calling commands have zero throttling |
| 25 | Security | Insufficient security event logging | NOT ADDR | No structured audit trail |
| 26 | Security | Cache poisoning — no integrity checks | PARTIAL | Staleness/pruning added; no hash/HMAC verification |
| 27 | Security | Privacy leakage through export/read | PARTIAL | Sensitive settings filtered; `get_projects` still returns full file paths |
| 28 | Security | Weak DB constraints (no FK, CHECK) | NOT ADDR | Orphan/invalid records possible |
| 29 | A11y | Contrast risk — warm-400 (~2.64:1 on white) | NOT ADDR | Fails WCAG AA (4.5:1 required); used across dozens of components |
| 30 | A11y | Dynamic status updates not announced | NOT ADDR | Zero `aria-live` regions in entire codebase |
| 31 | A11y | Form semantics gaps in Settings | PARTIAL | Correct input types but missing labels, radiogroup roles, htmlFor |
| 32 | A11y | Icon-only buttons missing names | PARTIAL | Some have aria-label; back arrow and close buttons still missing |
| 33 | A11y | No reduced-motion support | NOT ADDR | No `prefers-reduced-motion` or `useReducedMotion` anywhere |
| 34 | Responsive | TopBar cramped on small screens | NOT ADDR | All badges in single flex row, no responsive collapse |
| 35 | Responsive | Dashboard grid inflexible on tablets | PARTIAL | Mixed — some grids have intermediate breakpoints, others jump 1→3 |
| 36 | UI/UX | No unsaved changes protection in quiz/lesson | NOT ADDR | No navigation guards; progress lost on route change |
| 37 | UI/UX | No question-by-question review on completion | NOT ADDR | Shows only summary score, no per-question breakdown |
| 38 | UI/UX | File uploads not displayed in feedback | NOT ADDR | Files discarded after submission, no preview in feedback |
| 39 | UI/UX | Daily progress hardcoded at 40% | NOT ADDR | No real time-tracking; `Dashboard.tsx:58` and `TopBar.tsx:92` use fixed 0.4 |
| 40 | UI/UX | Learning Path breadcrumb missing | NOT ADDR | Only back-arrow icon, no hierarchy trail |
| 41 | UI/UX | Inconsistent button labels across quiz types | NOT ADDR | Submit buttons consistent; action affordances vary without explanation |
| 42 | UI/UX | LaTeX parsing ambiguity with dollar signs | PARTIAL | Dollar delimiter may misfire on currency; bare commands treated as plain text |
| 43 | Prompt | Cache reuse bypasses personalization | PARTIAL | 7-day TTL added; no mastery-aware keys, invalidate_cache never called |
| 44 | Prompt | Cache invalidation underpowered | PARTIAL | Time-based only; no event-driven invalidation on mastery/settings changes |
| 45 | Prompt | Token budgets not per-mode, not instrumented | NOT ADDR | Single 4096 default; usage data never logged |
| 46 | Prompt | Attachment path causes token spikes | PARTIAL | 25MB cap added; no token estimation, regrade_with_reasoning uncapped |
| 47 | Prompt | Prompt logic duplication | NOT ADDR | 5+ callsites bypass shared builder; xml_escape duplicated |
| 48 | Functionality | Diagnostic race/failure gaps | PARTIAL | Race condition eliminated; empty catch block remains, 0-question intro confusing |
| 49 | Functionality | Synthetic/hardcoded reporting | PARTIAL | Real data sources exist; concept descriptions and estimates still hardcoded |
| 50 | Functionality | Data export incomplete | PARTIAL | Includes more data now; per-question answers and lesson views never stored |
| 51 | Functionality | Verification tooling broken | NOT ADDR | ESLint v9 flat config missing; cargo test blocked by system dependency |
| 52 | Learning | Diagnostic is self-reported only | NOT ADDR | Pure familiarity survey, no demonstrated ability testing |
| 53 | UI/UX | Inconsistent offline error messaging | PARTIAL | Some good messages; IPC layer can't distinguish network vs other errors |

---

## Top 15 Actions — Ordered by Impact

### Immediate (Release-Blocking)

1. **Fix client-authoritative scoring**: Move MC/fill-in-blank answer keys to backend-only. Frontend should never supply `correctOptionId` or `expectedBlanks`.

2. **Fix mastery inflation on first attempt**: Add minimum attempt count (e.g., 3) before mastery can reach threshold, or cap first-attempt mastery.

3. **Eliminate XP duplication**: Choose single authoritative XP award path — either per-answer backend or completion bonus, not both.

4. **Add directory sandboxing for file reads**: Restrict `submit_project` file access to user-approved directories only, not arbitrary paths.

5. **Add ARIA labels and keyboard accessibility**: Add `aria-label`/`role` to all SVGs, progress indicators, and interactive elements. Add skip-to-content link. Make SkillTree keyboard-operable.

### High Priority (Pre-Public Release)

6. **Fix math aria-labels**: Replace `aria-label={latex}` with human-readable descriptions or allow MathML to serve as accessible name.

7. **Add responsive layout**: Hide sidebar on mobile with hamburger menu, reduce padding, add TopBar overflow handling.

8. **Encrypt SQLite database**: Integrate `sqlcipher` with password from OS keystore.

9. **Wire interleaving into session generation**: Connect `interleave.rs` to `session_builder.rs` for proper new/recent/review distribution.

10. **Split system prompt by mode**: Compose only mode-relevant prompt sections. Expected savings: ~800-1000 input tokens per call.

### Medium Priority (Quality Improvements)

11. **Add rate limiting**: Per-session throttling on all API-calling commands.

12. **Add `aria-live` regions**: For quiz feedback, timer, save confirmations, offline banner.

13. **Add event-driven cache invalidation**: Invalidate on mastery changes, model changes, settings updates.

14. **Fix ESLint v9 configuration**: Add flat config to restore linting CI gate.

15. **Add numeric tolerance to grading**: Handle equivalent representations ("1/2" = "0.5"), don't penalize parse failures in SM-2.

---

## Detailed Sub-Agent Reports

- `01-security-evaluation.md` — 10 fixed, 8 partial, 4 unaddressed
- `02-ui-ux-evaluation.md` — 2 fixed, 14 partial, 17 unaddressed
- `03-functionality-evaluation.md` — 7 fixed, 5 partial, 1 unaddressed
- `04-prompt-optimization-evaluation.md` — 0 fixed, 3 partial, 4 unaddressed
- `05-learning-quality-evaluation.md` — 1 fixed, 2 partial, 3 unaddressed
