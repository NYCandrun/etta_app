use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

/// Returns the path to the application database file.
pub fn db_path() -> PathBuf {
    let base = dirs::data_dir().expect("Could not resolve platform data directory");
    let app_dir = base.join("com.astrolabe.app");
    fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    app_dir.join("astrolabe.db")
}

/// Open the SQLite database and create schema if needed.
/// Enables WAL mode for better concurrent read performance.
pub fn initialize_database() -> Result<Connection, Box<dyn std::error::Error>> {
    let path = db_path();
    let conn = Connection::open(&path)?;

    // Enable WAL mode and foreign key enforcement.
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // Create tables with CHECK constraints and foreign keys.
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS concepts (
            id              TEXT PRIMARY KEY,
            domain          TEXT NOT NULL,
            module          TEXT NOT NULL,
            title           TEXT NOT NULL,
            prerequisites   TEXT NOT NULL DEFAULT '[]',
            learning_objectives TEXT NOT NULL DEFAULT '[]',
            difficulty_tier INTEGER,
            error_patterns  TEXT NOT NULL DEFAULT '[]',
            mastery_score   REAL NOT NULL DEFAULT 0.0 CHECK(mastery_score >= 0.0 AND mastery_score <= 1.0),
            ease_factor     REAL NOT NULL DEFAULT 2.5 CHECK(ease_factor >= 1.3 AND ease_factor <= 3.5),
            interval_days   INTEGER NOT NULL DEFAULT 1 CHECK(interval_days >= 1 AND interval_days <= 180),
            next_review     TEXT,
            last_correct    TEXT,
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
            submitted_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS content_cache (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            concept_id      TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
            content_type    TEXT NOT NULL CHECK(content_type IN ('lesson', 'quiz', 'explain', 'review')),
            payload_json    TEXT NOT NULL,
            model_version   TEXT,
            created_at      TEXT NOT NULL,
            content_hash    TEXT
        );

        CREATE TABLE IF NOT EXISTS xp_events (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            amount          INTEGER NOT NULL CHECK(amount >= 0 AND amount <= 100),
            source          TEXT NOT NULL,
            description     TEXT NOT NULL DEFAULT '',
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mastery_snapshots (
            date            TEXT NOT NULL,
            domain          TEXT NOT NULL,
            score           REAL NOT NULL DEFAULT 0.0 CHECK(score >= 0.0 AND score <= 1.0),
            PRIMARY KEY (date, domain)
        );

        CREATE TABLE IF NOT EXISTS quiz_answers (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      TEXT NOT NULL,
            question_id     TEXT NOT NULL,
            concept_id      TEXT NOT NULL,
            question_type   TEXT NOT NULL,
            selected_option TEXT,
            free_text       TEXT,
            filled_blanks   TEXT,
            is_correct      INTEGER NOT NULL DEFAULT 0,
            score           REAL NOT NULL DEFAULT 0.0,
            time_spent_ms   INTEGER,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS curriculum_rewards (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            reward_type     TEXT NOT NULL,
            entity_id       TEXT NOT NULL,
            xp_awarded      INTEGER NOT NULL CHECK(xp_awarded >= 0),
            awarded_at      TEXT NOT NULL,
            UNIQUE(reward_type, entity_id)
        );

        CREATE TABLE IF NOT EXISTS lesson_views (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            concept_id      TEXT NOT NULL,
            lesson_id       TEXT NOT NULL DEFAULT '',
            viewed_at       TEXT NOT NULL
        );
        ",
    )?;

    // Migration: add content_hash column to existing content_cache tables.
    // ALTER TABLE ADD COLUMN is a no-op if the column already exists in SQLite
    // (we catch the error silently).
    let _ = conn.execute_batch("ALTER TABLE content_cache ADD COLUMN content_hash TEXT;");

    // Migration: add learning context columns to existing concepts tables.
    let _ = conn.execute_batch(
        "ALTER TABLE concepts ADD COLUMN learning_objectives TEXT NOT NULL DEFAULT '[]';",
    );
    let _ = conn.execute_batch("ALTER TABLE concepts ADD COLUMN difficulty_tier INTEGER;");
    let _ = conn.execute_batch(
        "ALTER TABLE concepts ADD COLUMN error_patterns TEXT NOT NULL DEFAULT '[]';",
    );

    Ok(conn)
}
