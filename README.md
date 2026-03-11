# Astrolabe — Product Requirements Document

**From Algebra to Astrophysics: An Adaptive, Gamified Desktop Learning Application for macOS**

Version 1.1 (Minimal Surface Area Revision) | March 2026 | Prepared for Jacob Nikolau

---

## 1. Executive Summary

Astrolabe is a native macOS desktop application that takes a self-motivated adult learner from foundational algebra through calculus, physics, and into university-level astrophysics. It uses the Claude API as its sole content and tutoring engine, a local SQLite database for all state, and a Tauri shell (leveraging macOS's built-in WebKit) to keep the installed footprint under 15 MB with zero bundled runtimes. The pedagogy is grounded in current learning science: spaced repetition for long-term retention, mastery-based progression so nothing is skipped, retrieval practice through varied question formats, interleaved topic sequencing to deepen transfer, and Duolingo-style gamification to sustain motivation day after day.

The application runs entirely on the user's Mac with no backend services, no user accounts, no cloud sync, and no Node.js runtime. All progress, scheduling data, and submitted work live in a single local database file. The only network dependency is the Claude API for generating and evaluating content. File uploads (PDF, DOCX, PNG, JPG, plaintext) are sent directly to the Claude API's native document and vision capabilities — no intermediate parsing libraries are required.

---

## 2. Problem Statement

An aspiring astrophysicist who never took calculus faces a daunting prerequisite chain: algebra, trigonometry, pre-calculus, single-variable calculus, multivariable calculus, differential equations, linear algebra, classical mechanics, electromagnetism, thermodynamics, quantum mechanics, and finally astrophysics. Existing resources are either passive (textbook PDFs, recorded lectures) or fragmented (separate apps for math drill, physics simulations, and spaced repetition). None provide a single, adaptive, gamified path from start to finish that also leverages modern AI tutoring.

Astrolabe closes that gap with a single desktop application that acts as tutor, coach, quizmaster, and progress tracker — powered by a state-of-the-art LLM and designed to make the learner feel confident and supported at every step.

---

## 3. Learning Science Foundations

The design of Astrolabe is grounded in six evidence-based principles drawn from current cognitive science and educational technology research. These are not optional features; they are the structural pillars of every interaction the learner has with the app.

### 3.1 Spaced Repetition

Research consistently shows that reviewing material at expanding intervals moves knowledge from short-term to long-term memory, improving retention by roughly 25–40% over massed study. Astrolabe implements a modified SM-2 algorithm (the same family used by Anki) that adjusts review intervals per-concept based on the learner's accuracy and response latency. A concept rated "easy" is surfaced again in 7 days, then 21, then 60. A concept rated "hard" reappears the next day. The schedule is stored locally and survives app restarts.

### 3.2 Mastery-Based Progression

Astrolabe never advances a learner past a topic they have not mastered. Each concept has a mastery score (0–100) computed from recent quiz accuracy, response consistency, and successful application in mixed-problem sets. A threshold of 80 is required before dependent topics unlock. This prevents the accumulation of knowledge gaps that derail learners later in the curriculum.

### 3.3 Retrieval Practice

Passive re-reading is the least effective study strategy. Astrolabe foregrounds retrieval: every session begins with a recall quiz on recent material before introducing anything new. Questions are generated dynamically by the Claude API in varied formats (multiple choice, free response, fill-in-the-blank, diagram labeling) so the learner cannot memorize patterns.

### 3.4 Interleaved Practice

Blocking practice on a single topic creates an illusion of mastery. Astrolabe interleaves problems from multiple recent and past topics within a single practice session. A set of ten problems might include two from today's new lesson, three from the previous week, and five from topics due for spaced review. This forces the learner to discriminate between problem types and strengthens transfer.

### 3.5 Adaptive Difficulty and Multimodal Explanation

When a learner answers incorrectly or flags confusion, the app does not simply repeat the same explanation. It uses the Claude API to generate an alternative approach: a visual analogy, a worked numerical example, a real-world application, or a Socratic chain of questions. The tone is always positive and affirming, never punitive. If three consecutive attempts on the same concept fail, the app automatically scaffolds down to a simpler prerequisite and works back up.

### 3.6 Gamification That Rewards Retention

Research from the University of Colorado found that gamification alone increases engagement by 60% but retention by only 9%. When combined with spaced repetition, retention gains compound to roughly 300% versus traditional methods. Astrolabe's gamification layer is therefore designed to reward long-term recall, not just completion. XP bonuses are largest for 7-day and 30-day review recalls, not for first-time answers. Streaks, levels, and badges are tied to sustained daily practice, not cram sessions.

---

## 4. Curriculum Structure

The curriculum is organized into twelve sequential domains, each divided into modules, each divided into concepts. A concept is the atomic unit of learning.

| Phase | Domain | Est. Modules | Prerequisites |
|---|---|---|---|
| 1 – Foundations | Algebra | 12 | None |
| 1 – Foundations | Trigonometry | 8 | Algebra |
| 1 – Foundations | Pre-Calculus | 6 | Trigonometry |
| 2 – Calculus | Single-Variable Calculus | 14 | Pre-Calculus |
| 2 – Calculus | Multivariable Calculus | 10 | Single-Var Calculus |
| 2 – Calculus | Differential Equations | 8 | Multivariable Calculus |
| 2 – Calculus | Linear Algebra | 10 | Single-Var Calculus |
| 3 – Physics | Classical Mechanics | 12 | Calculus, Linear Algebra |
| 3 – Physics | Electromagnetism | 10 | Classical Mechanics, Diff Eq |
| 3 – Physics | Thermodynamics & Stat Mech | 8 | Classical Mechanics |
| 3 – Physics | Quantum Mechanics | 10 | Linear Algebra, E&M |
| 4 – Astro | Astrophysics | 14 | All of Phase 3 |

Module and concept content is generated dynamically by the Claude API using a structured curriculum graph stored in the app's configuration. The graph defines prerequisite relationships, learning objectives, and concept metadata. The Claude API produces lesson text, worked examples, quiz questions, and project prompts on demand, seeded by this graph.

---

## 5. Architecture

### 5.1 Design Philosophy: Minimal Surface Area

The guiding constraint is to minimize moving parts. There is no backend server, no microservice mesh, no message queue, no Redis cache, and no bundled browser engine. The entire application is a Tauri process (a thin Rust binary + macOS's built-in WebKit webview) that talks to exactly one external service: the Claude API over HTTPS. The installed app is under 15 MB.

### 5.2 Component Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Shell | Tauri 2.x (macOS) | Window management, native file dialogs, menu bar, notifications, auto-update. Uses system WebKit — no bundled Chromium. |
| UI | React + Tailwind CSS | All views: dashboard, lessons, quizzes, projects, settings, progress charts |
| Backend | Rust (Tauri commands) | SQLite access, file I/O, macOS Keychain integration, Claude API HTTP calls |
| State | SQLite (via rusqlite) | All persistent data: progress, concept mastery, submissions, settings, content cache |
| AI Engine | Claude API (claude-sonnet-4-6) | Content generation, answer evaluation, adaptive explanations, project feedback, document/image parsing |

**Zero processing libraries.** PDF, DOCX, and image uploads are read as raw bytes by Rust and sent directly to the Claude API, which handles document parsing and vision natively. No pdf-parse, no mammoth.js, no sharp, no Node.js runtime.

### 5.3 Claude API Integration: Single Unified Prompt

Rather than maintaining a library of separate versioned system prompts for lessons, quizzes, explanations, and evaluation, Astrolabe uses a single "tutor" system prompt with a structured `mode` parameter. The system prompt contains the full voice guidelines, curriculum context, and learner history. The mode parameter tells Claude which output shape to produce:

| Mode | Output | Token Budget |
|---|---|---|
| `lesson` | Explanatory content with LaTeX, worked examples, diagrams | 4,000 |
| `quiz` | Array of questions with answers, hints, and explanations | 1,500 |
| `explain` | Alternative explanation using a specified strategy (analogy, Socratic, scaffold-down) | 2,000 |
| `evaluate` | Rubric-based feedback on a submitted file | 6,000 |
| `review` | Spaced-repetition recall questions for due concepts | 1,500 |

One prompt to maintain. One API calling pattern. The mode and learner context (mastery scores, attempt history, current concept) are injected as structured parameters in the user message.

### 5.4 Data Flow

All data flows are synchronous from the user's perspective: the learner clicks, the Rust backend queries SQLite for state, calls the Claude API if new content is needed, writes the result back to SQLite, and returns the data to the React UI over Tauri's IPC bridge. There is no pub/sub, no websocket, no background worker. Long API calls show a skeleton loader with an encouraging micro-message (e.g., "Crafting your next challenge...").

### 5.5 Offline Behavior

If the network is unreachable, the app falls back to a "review-only" mode: it serves spaced-repetition quizzes from its local cache of previously generated questions. New lessons and project feedback are unavailable until connectivity returns. A subtle banner indicates offline status without alarm.

### 5.6 Data Storage Schema (Flattened)

The schema is consolidated from seven tables down to four by merging quiz history and SR scheduling into a single concept progress table, and folding gamification fields into settings.

| Table | Key Fields | Purpose |
|---|---|---|
| concepts | id, domain, module, title, prerequisites, mastery_score, ease_factor, interval_days, next_review, last_correct, last_latency_ms, attempt_count, streak_correct | Curriculum graph + per-concept SR state + performance history (replaces separate sr_schedule and quiz_history tables) |
| submissions | concept_id, project_id, file_path, mime_type, feedback_json, status, submitted_at | Project uploads and AI feedback |
| settings | key, value | API key (reference to Keychain), theme, daily goal, notification prefs, xp, level, streak_days, streak_start, badges_json |
| content_cache | concept_id, content_type, payload_json, model_version, created_at | Cached lessons/questions for offline mode |

Four tables. One file. No migrations framework — schema is created on first launch via a bundled SQL init script.

---

## 6. User Experience

### 6.1 Core Screens

- **Dashboard:** Shows current streak, XP, level, today's suggested session (a mix of new material and reviews), and a skill-tree map of the full curriculum with completed/locked/in-progress states.

- **Lesson View:** Presents AI-generated explanatory content with LaTeX-rendered equations, diagrams, and interactive worked examples. A "I don't get it" button triggers an alternative explanation in a different modality.

- **Quiz View:** Timed or untimed questions in varied formats. Immediate, positive feedback after each answer. Wrong answers show a gentle explanation and queue the concept for earlier review.

- **Project View:** Describes a hands-on challenge (e.g., "Calculate the orbital period of a satellite at altitude h"). The learner uploads their work as a PDF, DOCX, PNG, JPG, or plaintext file. The Claude API evaluates the submission and returns detailed, encouraging feedback.

- **Progress View:** Charts of mastery scores over time per domain, review forecast calendar, badge gallery, and a "science journal" log of completed projects.

- **Settings:** Claude API key entry, daily session goal (minutes), notification preferences, theme (light/dark), data export.

### 6.2 Tone and Voice

Every piece of text the learner sees — whether generated by the app's templates or by the Claude API — must follow these voice principles:

- **Always positive:** Never say "wrong." Say "not quite — let's look at this another way."
- **Always affirming:** Celebrate small wins. "Nice work! You just proved you can differentiate polynomials."
- **Always adaptive:** If the learner struggles, shift approach immediately. "Let me try a different angle — imagine you're on a roller coaster..."
- **Never condescending:** No "this is easy" or "as you should know." Treat every question as legitimate.

### 6.3 Gamification Mechanics

| Mechanic | Description | Retention Alignment |
|---|---|---|
| XP | Earned for completing lessons, quizzes, and reviews. Bonus XP for correct answers on 7-day and 30-day reviews. | Rewards long-term memory, not cramming |
| Streak | Consecutive days with at least one completed session. Streak freeze available once per week. | Builds daily habit |
| Levels | XP thresholds unlock cosmetic titles (e.g., "Newtonian Novice," "Kepler's Apprentice," "Hubble Explorer"). | Sense of progression |
| Badges | Awarded for milestones: first domain complete, 30-day streak, first project submitted, perfect quiz score. | Recognizes achievement |
| Leaderboard | Personal-only (no social). Compare today's XP to your own 7-day average. | Self-competition without anxiety |
| Daily Goal | Configurable target (15/30/45/60 min). Visual progress ring on dashboard. | Micro-commitment |

---

## 7. Adaptive Learning Engine

### 7.1 Mastery Scoring

Each concept's mastery score is a weighted rolling average of the learner's last N interactions with that concept:

- **Quiz accuracy (weight 0.50):** Percentage of correct answers in the last 10 attempts.
- **Response consistency (weight 0.25):** Standard deviation of accuracy across sessions. Lower variance = higher score.
- **Transfer success (weight 0.25):** Accuracy on interleaved problems that require this concept alongside others.

A concept is "mastered" at a score of 80 or above. It remains in the spaced-repetition rotation indefinitely; mastery can decay if reviews are missed.

### 7.2 Spaced Repetition Algorithm

Astrolabe uses a modified SM-2 algorithm with the following parameters per concept:

- **ease_factor:** Starts at 2.5. Increases by 0.1 on easy recall, decreases by 0.2 on hard recall, floored at 1.3.
- **interval_days:** Starts at 1. After each successful review: `new_interval = old_interval × ease_factor`.
- After a failed review: interval resets to 1 day and ease_factor decreases.

The daily session builder queries `sr_schedule` for all concepts where `next_review <= today` and prioritizes them before new material.

### 7.3 Adaptive Explanation Pipeline

When a learner answers incorrectly or clicks "I don't get it," the app escalates through explanation strategies in sequence:

1. **Attempt 1:** Standard textbook-style re-explanation with a different worked example.
2. **Attempt 2:** Visual/analogical approach (e.g., "think of the integral as the area under a curve on a hiking trail").
3. **Attempt 3:** Socratic questioning that walks the learner backward to the specific point of confusion.
4. **Attempt 4:** Scaffold down to the prerequisite concept and re-teach it before returning.

Each attempt is a Claude API call using the unified tutor prompt in `explain` mode, with a `strategy` parameter specifying the approach (textbook, analogy, socratic, or scaffold-down) and the learner's full history with this concept injected as context.

---

## 8. Project-Based Learning

### 8.1 Project Types

Each domain includes 2–4 projects that require the learner to apply multiple concepts in a realistic context. Projects are scaffolded by phase:

- **Phase 1 (Foundations):** Problem sets and proofs submitted as plaintext or PDF. Example: "Prove the quadratic formula from completing the square."
- **Phase 2 (Calculus):** Multi-step derivations and applied problems. Example: "Model the trajectory of a thrown ball and find maximum height."
- **Phase 3 (Physics):** Lab-style writeups with data analysis. Example: "Estimate the mass of Jupiter from the orbital periods of its Galilean moons."
- **Phase 4 (Astrophysics):** Research mini-papers. Example: "Compare two methods for measuring the distance to the Andromeda galaxy."

### 8.2 Submission and Evaluation

Learners upload their work through a native file dialog. Supported formats:

| Format | MIME Type | Processing |
|---|---|---|
| PDF | application/pdf | Read as raw bytes by Rust, sent directly to Claude API (native PDF support) |
| DOCX | application/vnd.openxmlformats... | Read as raw bytes by Rust, sent directly to Claude API (native document support) |
| PNG / JPG | image/png, image/jpeg | Read as raw bytes by Rust, sent directly to Claude Vision for handwriting/diagram analysis |
| Plaintext | text/plain | Read by Rust, sent directly as string |

No intermediate parsing libraries are involved. The Rust backend reads the file from disk and attaches it to the Claude API request as a base64-encoded content block. Claude handles all text extraction, OCR, and image analysis natively.

The Claude API evaluates the submission against a rubric generated from the project's learning objectives. Feedback is always constructive: it identifies what the learner did well, where the reasoning diverged, and suggests a specific next step. No letter grades — only qualitative feedback and a pass/revise status.

---

## 9. Technical Specifications

### 9.1 Platform and Distribution

- **OS:** macOS 13 (Ventura) and later. Universal binary (Apple Silicon + Intel).
- **Framework:** Tauri 2.x. Uses macOS's built-in WebKit — no bundled browser engine.
- **Packaging:** Tauri's built-in bundler producing a signed, notarized .dmg. Auto-update via Tauri's updater plugin from a static file host (S3 or GitHub Releases).
- **Size target:** < 15 MB installed. No bundled runtimes, no LLM weights; all AI is via API.
- **Dependencies:** Rust (compiled to native binary), React + Tailwind (bundled as static assets), rusqlite (statically linked). Zero npm runtime dependencies.

### 9.2 Claude API Integration

- **Model:** claude-sonnet-4-6 for all interactions. Configurable to allow future model upgrades.
- **Authentication:** User provides their own API key in Settings. Stored in macOS Keychain via Tauri's native Keychain plugin, never in SQLite.
- **Rate management:** Client-side token budgeting per mode (see Section 5.3).
- **System prompt:** A single unified tutor prompt bundled in the app binary. Mode, learner context, and concept metadata are injected per-request as structured parameters. One prompt to version and maintain.
- **Caching:** Generated content is cached in `content_cache` table keyed by `(concept_id, content_type, model_version)`. Cache is invalidated when the curriculum graph changes or the model version is updated.

### 9.3 Performance Targets

| Metric | Target |
|---|---|
| Cold launch to dashboard | < 1.5 seconds (Tauri launches faster than Electron) |
| Lesson load (cached) | < 100 ms |
| Lesson load (API) | < 8 seconds (with streaming) |
| Quiz question generation | < 4 seconds |
| Project feedback | < 20 seconds |
| SQLite query (any) | < 10 ms (rusqlite is native, not N-API bridged) |
| Memory footprint (idle) | < 80 MB (no Chromium process) |
| Installed size | < 15 MB |

---

## 10. Long-Term Reinforcement System

The reinforcement system ensures that concepts learned months ago are periodically resurfaced. This is distinct from the day-to-day spaced repetition; it operates on a longer timescale.

### 10.1 Monthly Milestone Reviews

At the end of each calendar month, the app generates a "Milestone Review": a 20-question mixed quiz sampling concepts from every domain the learner has touched, weighted toward older material. Performance on this review directly adjusts `ease_factor` for each concept tested, potentially shortening or lengthening its review interval.

### 10.2 Concept Resurfacing Rules

- Any concept not reviewed in 60 days is automatically scheduled for the next session, regardless of its ease_factor.
- Concepts whose mastery score drops below 60 (due to missed reviews) are re-entered into the active learning queue as if partially new.
- Project feedback references earlier concepts by name, prompting the learner to recall them in context.

### 10.3 Decay Model

Mastery scores decay over time using an exponential forgetting curve calibrated to the concept's ease_factor. A well-learned concept (ease_factor 3.0) decays slowly; a weakly-learned one (ease_factor 1.5) decays quickly. This creates natural urgency to review without artificial pressure.

---

## 11. Non-Functional Requirements

### 11.1 Security

- API key stored in macOS Keychain via Tauri's native Keychain plugin, not on disk or in SQLite.
- No user data ever leaves the machine except as Claude API requests (subject to Anthropic's data retention policies).
- Tauri's security model: no Node.js runtime, no `nodeIntegration` concern. The Rust backend exposes only explicitly defined IPC commands to the webview.
- Content Security Policy restricts all external resource loading except the Claude API endpoint.

### 11.2 Privacy

- No telemetry, no analytics, no crash reporting sent to any server.
- All learner data is local-only. Backup is via manual file copy of the SQLite database.
- Users can export all their data as JSON from Settings at any time.

### 11.3 Accessibility

- Full keyboard navigation.
- VoiceOver support for all interactive elements.
- LaTeX equations rendered as accessible MathML with alt-text.
- Color scheme passes WCAG AA contrast ratios in both light and dark themes.

### 11.4 Reliability

- SQLite WAL mode for crash-safe writes.
- Automatic daily backup of the database to a timestamped file in `~/Library/Application Support/Astrolabe/backups/`.
- Graceful degradation to offline review mode on network failure.

---

## 12. Development Roadmap

| Milestone | Scope | Duration |
|---|---|---|
| M0: Skeleton | Tauri shell, Rust backend with rusqlite, SQLite schema (4 tables), settings screen, API key → Keychain, single hardcoded lesson rendering | 3 weeks |
| M1: Core Loop | Curriculum graph for Algebra, unified tutor prompt, lesson + quiz mode generation, mastery scoring, basic SR scheduling | 5 weeks |
| M2: Gamification | XP, streaks, levels, badges, dashboard with skill tree, daily goal ring | 3 weeks |
| M3: Adaptive Engine | Multi-strategy explanation pipeline (explain mode), scaffold-down logic, interleaved problem sets | 4 weeks |
| M4: Projects | Project prompts, native file dialog upload, raw-bytes-to-Claude evaluation (evaluate mode), feedback rendering | 3 weeks |
| M5: Full Curriculum | Extend curriculum graph through all 12 domains. Automated testing of generated content quality. | 6 weeks |
| M6: Polish | Offline mode, accessibility audit, VoiceOver, Tauri auto-updater, .dmg packaging, notarization | 3 weeks |
| M7: Beta | Closed beta with 10–20 testers. Iterate on pacing, difficulty curves, and gamification balance. | 4 weeks |

Total estimated timeline: approximately 31 weeks from kickoff to beta, assuming a solo developer or small team. The reduction from 34 weeks reflects the simpler architecture: no Node.js runtime to configure, no document-parsing libraries to integrate and debug, and fewer database tables to manage.

---

## 13. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Daily Active Use | ≥ 5 days/week average | Local session log |
| 30-Day Retention | ≥ 70% of concepts at mastery | SR schedule + mastery scores |
| Session Duration | 15–45 min median | Local session log |
| Streak Length | ≥ 21 days median | Gamification table |
| Project Completion | ≥ 80% of available projects attempted | Submissions table |
| Curriculum Progress | Algebra → Astrophysics in 18–24 months | Domain mastery timestamps |
| Explanation Escalation | < 15% of concepts reach Attempt 4 | Quiz history + explanation logs |

---

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude API content accuracy | Medium | High | All generated content includes a verification prompt. Physics/math content cross-checked against known formulas. User can flag errors. |
| API cost at scale | Medium | Medium | Aggressive caching. Sonnet-tier model for routine tasks. Token budgets per interaction type. User sees estimated cost per session. |
| Learner burnout | Medium | High | Configurable daily goals. Streak freezes. Encouraging tone. Auto-suggest breaks after 60 min. Weekly "fun fact" interludes. |
| Curriculum pacing too fast/slow | High | Medium | Beta testing with real learners. Adjustable mastery thresholds in Settings. Monthly review recalibrates ease factors. |
| Rust learning curve | Medium | Low | Tauri's IPC layer is straightforward. The Rust backend is thin (SQLite + HTTP + file I/O). No complex concurrency needed. |
| Offline mode limitations | Low | Medium | Cache last 50 generated questions per domain. Clearly communicate that new content requires connectivity. |

---

## 15. Appendix: Learning Science References

The pedagogical design of Astrolabe draws on the following bodies of research:

- Spaced repetition and the forgetting curve: Ebbinghaus (1885), Pimsleur (1967), Wozniak & Gorzelanczyk SM-2 algorithm (1990).
- Retrieval practice: Roediger & Karpicke (2006), "Test-Enhanced Learning."
- Interleaving: Rohrer & Taylor (2007), "The shuffling of mathematics problems improves learning."
- Mastery learning: Bloom (1968), "Learning for Mastery."
- Gamification and retention: University of Colorado (2012), gamification + spaced repetition compounding effect.
- Expertise reversal effect: Kalyuga et al. (2003) — scaffolding must decrease as expertise grows.
- AI-adaptive learning systems: Springer Nature systematic review (2025), "Artificial intelligence in adaptive education."
- Gamification gap: eLearning Industry (2025), "The Learning Retention Formula: Spaced Repetition with Gamification."

---

*End of document.*
