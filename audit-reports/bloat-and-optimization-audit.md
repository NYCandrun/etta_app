# Etta App — Bloat and Token Optimization Audit

## 1. PROMPT BLOAT — VERDICT: LOW RISK (well-designed)

The prompt construction in `src-tauri/src/api/prompt.rs` is **not unbounded**. Each API call sends:

- A static system prompt (~3,500 chars from `tutor_prompt.txt`)
- A structured user message containing only the **current concept metadata** and **current learner context** (5 numeric fields)

**Critically, no submission history, no past answers, and no conversation history are included in prompts.** Each API request is stateless and self-contained (line 129 of `tutor_prompt.txt` confirms: "Responses should be self-contained — do not reference previous conversations").

Estimated per-request token count:
- System prompt: ~1,000 tokens (fixed)
- User message: ~150-200 tokens (fixed)
- **Total input: ~1,200 tokens per request, regardless of how long the app has been used**

The `max_tokens` is appropriately sized per use case: 4096 for lessons, 2048 for explanations, 1024 for regrading, 512 for answer verification, 256 for grading. This is good practice.

**One minor optimization**: The `list_available_models` command at `src-tauri/src/commands/ai_cmds.rs` lines 248-262 calls `test_connection()` which sends a real API request (`"Reply with OK."`) every time it is invoked, just to return hardcoded models regardless of the result. This wastes tokens on every call.

## 2. DATABASE BLOAT — VERDICT: MODERATE RISK (3 unbounded tables)

### Tables that grow forever with NO pruning:

**a) `submissions` table** (`src-tauri/src/db/submissions.rs`)
- No pruning, no archiving, no TTL
- Each row: ~200-500 bytes + `feedback_json` (500-2000 bytes of AI-generated JSON)
- Estimate per submission: ~1 KB average
- **1 year at 2 submissions/week = ~100 KB.** Low concern for most users.
- **However**: `export_data` fetches the last 1000 submissions, and `get_submissions_for_concept` / `get_submissions_for_project` have NO LIMIT.

**b) `xp_events` table** (`src-tauri/src/db/xp_events.rs`)
- No pruning, no archiving
- Each row: ~100 bytes
- **1 year of daily use (~3 XP events/day) = ~110 KB.** Low absolute concern.
- `get_all_xp_events` queries with `LIMIT i64::MAX` — functionally unbounded.

**c) `mastery_snapshots` table** (`src-tauri/src/db/mastery_snapshots.rs`)
- Uses `INSERT OR REPLACE` with `PRIMARY KEY (date, domain)` — naturally bounded to 1 row per domain per day
- With ~12 domains and daily use: 12 rows/day = ~4,380 rows/year at ~50 bytes each = ~215 KB/year
- `get_all_snapshots` has no limit, returning ALL historical snapshots to the frontend
- **After 3 years: ~13,000 rows** sent on every mastery chart load.

### Table with pruning (well-managed):

**d) `content_cache` table** (`src-tauri/src/db/content_cache.rs`)
- **Two-layer pruning**: keeps only 3 most recent entries per concept+type, AND purges entries older than 30 days on app startup
- Each cached quiz/lesson: ~2-5 KB of AI-generated content
- **This is the best-designed table in the app.**

## 3. TOKEN OPTIMIZATION — SPECIFIC FINDINGS

### 3a. Duplicate XML escaping functions
Both `ai_cmds.rs` and `quiz_cmds.rs` define identical `xml_escape` functions. Should be extracted to a shared utility.

### 3b. System prompt sent in full on every request
The 3,500-character system prompt is sent with every single API call, including all 5 mode descriptions even though only 1 mode is used per request.

**Optimization opportunity**: Splitting the prompt into base + mode-specific sections would save ~300-400 input tokens per request.

### 3c. Wasteful `test_connection` in `list_available_models`
`list_available_models` calls `client.test_connection().await` which sends a real API request, but returns `known_models()` regardless of success or failure.

### 3d. No prompt caching headers used
The system prompt (identical across requests) is sent as a plain string with no cache control. Anthropic's prompt caching feature could significantly reduce costs.

### 3e. `ClaudeClient` is reconstructed per-request
Every command creates a new `ClaudeClient::new(&api_key)` which builds a new `reqwest::Client`. The HTTP client should be shared across the application lifetime.

## 4. PRUNING ASSESSMENT

| Data | Pruning | Assessment |
|------|---------|------------|
| `content_cache` | 3 per concept+type, 30-day TTL | **Appropriate** |
| `submissions` | None | **Needs pruning** — keep last N per concept |
| `xp_events` | None | **Needs pruning** — keep last 90 days |
| `mastery_snapshots` | Naturally bounded by date+domain PK | **Needs windowing** for queries |
| Prompts | No history included | **Appropriate** — stateless design is correct |

## 5. MEMORY PATTERNS — VERDICT: LOW RISK

- Zustand stores are appropriately scoped
- Event listeners properly clean up
- QuizShell arrays bounded by quiz length (5 questions)
- No detected event listener leaks

## 6. BUNDLE SIZE — SPECIFIC FINDINGS

- **d3** (~500 KB minified): Only used for pan/zoom in SkillTree. Could be replaced with ~5KB `panzoom` library, saving ~490 KB.
- **framer-motion** (~150 KB): Reasonable for the UX but heavy
- **katex** (~300 KB): Required for math rendering. No lighter alternative.
- **tokio with `features = ["full"]`**: Pulls in ALL features. App only needs `rt-multi-thread`, `time`, `macros`.

## 7. CONCRETE RECOMMENDATIONS (prioritized)

### High priority:
1. Add pruning for `xp_events` — keep last 1000 events
2. Window `mastery_snapshots` queries — default to 90 days
3. Add `LIMIT` to `get_submissions_for_concept` and `get_submissions_for_project`
4. Add staleness check to cache reads (skip entries older than 7 days)

### Medium priority:
5. Share `ClaudeClient` across requests via `AppState`
6. Remove API call from `list_available_models`
7. Replace d3 with lightweight pan/zoom library
8. Trim tokio features from `"full"` to specific features

### Low priority:
9. Extract shared `xml_escape` function
10. Add Anthropic prompt caching headers
11. Optimize `SseParser.feed()` buffer allocation
12. Add periodic `VACUUM` or `PRAGMA auto_vacuum = INCREMENTAL`

## SUMMARY

The app is **well-designed for prompt/token efficiency** — the stateless prompt architecture means AI costs stay flat regardless of usage duration. The main bloat risk is in the database: three tables grow without bounds. The absolute growth rate is slow (~500 KB/year for a daily user), so this won't cause problems for months, but will degrade query performance for `export_data` and `get_mastery_history` over multi-year timescales. The content cache is the standout — its pruning strategy is well-implemented. The biggest quick wins are replacing d3 (~490 KB bundle savings), sharing the HTTP client, and removing the wasteful `test_connection` call.
