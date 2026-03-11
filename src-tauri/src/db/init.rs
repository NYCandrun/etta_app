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

    // Enable WAL mode.
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Create tables.
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS concepts (
            id              TEXT PRIMARY KEY,
            domain          TEXT NOT NULL,
            module          TEXT NOT NULL,
            title           TEXT NOT NULL,
            prerequisites   TEXT NOT NULL DEFAULT '[]',
            mastery_score   REAL NOT NULL DEFAULT 0.0,
            ease_factor     REAL NOT NULL DEFAULT 2.5,
            interval_days   INTEGER NOT NULL DEFAULT 1,
            next_review     TEXT,
            last_correct    TEXT,
            last_latency_ms INTEGER,
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
            status          TEXT NOT NULL DEFAULT 'pending',
            submitted_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS content_cache (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            concept_id      TEXT NOT NULL,
            content_type    TEXT NOT NULL,
            payload_json    TEXT NOT NULL,
            model_version   TEXT,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS xp_events (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            amount          INTEGER NOT NULL,
            source          TEXT NOT NULL,
            description     TEXT NOT NULL DEFAULT '',
            created_at      TEXT NOT NULL
        );
        ",
    )?;

    Ok(conn)
}
