-- Astrolabe database schema
-- Applied automatically on first launch via db::init::initialize_database()

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS concepts (
    id              TEXT PRIMARY KEY,
    domain          TEXT NOT NULL,
    module          TEXT NOT NULL,
    title           TEXT NOT NULL,
    prerequisites   TEXT NOT NULL DEFAULT '[]',   -- JSON array of concept IDs
    mastery_score   REAL NOT NULL DEFAULT 0.0 CHECK(mastery_score >= 0.0 AND mastery_score <= 1.0),
    ease_factor     REAL NOT NULL DEFAULT 2.5 CHECK(ease_factor >= 1.3 AND ease_factor <= 3.5),
    interval_days   INTEGER NOT NULL DEFAULT 1 CHECK(interval_days >= 1 AND interval_days <= 180),
    next_review     TEXT,                          -- ISO 8601 date (YYYY-MM-DD)
    last_correct    TEXT,                          -- ISO 8601 date of last correct answer
    last_latency_ms INTEGER CHECK(last_latency_ms IS NULL OR last_latency_ms >= 0),
    attempt_count   INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
    streak_correct  INTEGER NOT NULL DEFAULT 0 CHECK(streak_correct >= 0)
);

CREATE TABLE IF NOT EXISTS submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id      TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    project_id      TEXT,
    file_path       TEXT,
    mime_type       TEXT,
    feedback_json   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'rejected')),
    submitted_at    TEXT NOT NULL                      -- ISO 8601 datetime
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id      TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    content_type    TEXT NOT NULL CHECK(content_type IN ('lesson', 'quiz', 'explain', 'review')),
    payload_json    TEXT NOT NULL,           -- the cached content
    model_version   TEXT,                    -- Claude model version used
    created_at      TEXT NOT NULL,           -- ISO 8601 datetime
    content_hash    TEXT                     -- HMAC-SHA256 integrity hash
);

CREATE TABLE IF NOT EXISTS xp_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    amount          INTEGER NOT NULL CHECK(amount >= 0 AND amount <= 100),
    source          TEXT NOT NULL,         -- lesson_complete, quiz_perfect, etc.
    description     TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL           -- ISO 8601 datetime
);

CREATE TABLE IF NOT EXISTS mastery_snapshots (
    date            TEXT NOT NULL,              -- YYYY-MM-DD
    domain          TEXT NOT NULL,
    score           REAL NOT NULL DEFAULT 0.0 CHECK(score >= 0.0 AND score <= 1.0),
    PRIMARY KEY (date, domain)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_concepts_next_review ON concepts(next_review);
CREATE INDEX IF NOT EXISTS idx_concepts_domain ON concepts(domain);
CREATE INDEX IF NOT EXISTS idx_submissions_concept ON submissions(concept_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_cache_concept_type ON content_cache(concept_id, content_type);
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_date ON mastery_snapshots(date);
