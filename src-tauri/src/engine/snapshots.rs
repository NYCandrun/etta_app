use crate::db;
use rusqlite::Connection;
use std::collections::HashMap;

/// Record mastery snapshots for all domains based on current concept scores.
/// Safe to call frequently — uses upsert so only one row per (date, domain).
pub fn record_mastery_snapshots(conn: &Connection) -> Result<(), String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let concepts = db::concepts::get_all_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    let mut domain_scores: HashMap<String, Vec<f64>> = HashMap::new();
    for c in &concepts {
        domain_scores
            .entry(c.domain.clone())
            .or_default()
            .push(c.mastery_score);
    }

    for (domain, scores) in &domain_scores {
        let avg = scores.iter().sum::<f64>() / scores.len() as f64;
        db::mastery_snapshots::upsert_snapshot(conn, &today, domain, avg)
            .map_err(|e| format!("DB error: {e}"))?;
    }

    Ok(())
}
