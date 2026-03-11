-- Astrolabe database schema
-- Applied automatically on first launch via db::init::initialize_database()

PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS concepts (
    id              TEXT PRIMARY KEY,
    domain          TEXT NOT NULL,
    module          TEXT NOT NULL,
    title           TEXT NOT NULL,
    prerequisites   TEXT NOT NULL DEFAULT '[]',   -- JSON array of concept IDs
    mastery_score   REAL NOT NULL DEFAULT 0.0,    -- 0.0 to 1.0
    ease_factor     REAL NOT NULL DEFAULT 2.5,    -- SM-2 ease factor (floor 1.3)
    interval_days   INTEGER NOT NULL DEFAULT 1,   -- days until next review
    next_review     TEXT,                          -- ISO 8601 date (YYYY-MM-DD)
    last_correct    TEXT,                          -- ISO 8601 date of last correct answer
    last_latency_ms INTEGER,                      -- response time in milliseconds
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    streak_correct  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id      TEXT NOT NULL,
    project_id      TEXT,
    file_path       TEXT,
    mime_type       TEXT,
    feedback_json   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending, reviewed, rejected
    submitted_at    TEXT NOT NULL                      -- ISO 8601 datetime
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id      TEXT NOT NULL,
    content_type    TEXT NOT NULL,           -- lesson, quiz, explain, review
    payload_json    TEXT NOT NULL,           -- the cached content
    model_version   TEXT,                    -- Claude model version used
    created_at      TEXT NOT NULL            -- ISO 8601 datetime
);

CREATE TABLE IF NOT EXISTS xp_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    amount          INTEGER NOT NULL,
    source          TEXT NOT NULL,         -- lesson_complete, quiz_perfect, etc.
    description     TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL           -- ISO 8601 datetime
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_concepts_next_review ON concepts(next_review);
CREATE INDEX IF NOT EXISTS idx_concepts_domain ON concepts(domain);
CREATE INDEX IF NOT EXISTS idx_submissions_concept ON submissions(concept_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_cache_concept_type ON content_cache(concept_id, content_type);
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at);
