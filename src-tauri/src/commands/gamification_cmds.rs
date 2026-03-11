use crate::db;
use crate::AppState;
use serde::Serialize;
use tauri::State;

/// Current gamification state for the learner.
#[derive(Debug, Serialize)]
pub struct GamificationState {
    pub total_xp: i64,
    pub level: i64,
    pub xp_to_next_level: i64,
    pub current_streak_days: i64,
    pub longest_streak_days: i64,
    pub badges: Vec<Badge>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Badge {
    pub id: String,
    pub name: String,
    pub description: String,
    pub earned: bool,
    pub earned_at: Option<String>,
}

/// XP thresholds per level: level N requires N * 100 XP.
fn xp_for_level(level: i64) -> i64 {
    level * 100
}

fn level_from_xp(xp: i64) -> i64 {
    let mut level = 1i64;
    let mut accumulated = 0i64;
    loop {
        let needed = xp_for_level(level);
        if accumulated + needed > xp {
            return level;
        }
        accumulated += needed;
        level += 1;
    }
}

fn xp_to_next(xp: i64) -> i64 {
    let level = level_from_xp(xp);
    let mut accumulated = 0i64;
    for l in 1..level {
        accumulated += xp_for_level(l);
    }
    let current_level_xp = xp - accumulated;
    xp_for_level(level) - current_level_xp
}

#[tauri::command]
pub fn get_gamification_state(state: State<'_, AppState>) -> Result<GamificationState, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let total_xp = db::settings::get_setting(&conn, "total_xp")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let current_streak = db::settings::get_setting(&conn, "current_streak_days")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let longest_streak = db::settings::get_setting(&conn, "longest_streak_days")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let badges_json = db::settings::get_setting(&conn, "badges")
        .map_err(|e| format!("DB error: {e}"))?
        .unwrap_or_else(|| "[]".to_string());

    let badges: Vec<Badge> = serde_json::from_str(&badges_json).unwrap_or_default();

    let level = level_from_xp(total_xp);
    let xp_to_next_level = xp_to_next(total_xp);

    Ok(GamificationState {
        total_xp,
        level,
        xp_to_next_level,
        current_streak_days: current_streak,
        longest_streak_days: longest_streak,
        badges,
    })
}

#[tauri::command]
pub fn award_xp(state: State<'_, AppState>, amount: i64) -> Result<GamificationState, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let current_xp = db::settings::get_setting(&conn, "total_xp")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let new_xp = current_xp + amount;
    db::settings::set_setting(&conn, "total_xp", &new_xp.to_string())
        .map_err(|e| format!("DB error: {e}"))?;

    // Update streak.
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let last_active = db::settings::get_setting(&conn, "last_active_date")
        .map_err(|e| format!("DB error: {e}"))?;

    let current_streak = db::settings::get_setting(&conn, "current_streak_days")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let new_streak = match last_active.as_deref() {
        Some(last) if last == today => current_streak, // Already counted today.
        Some(last) => {
            // Check if yesterday.
            if let Ok(last_date) = chrono::NaiveDate::parse_from_str(last, "%Y-%m-%d") {
                let today_date = chrono::Local::now().date_naive();
                if (today_date - last_date).num_days() == 1 {
                    current_streak + 1
                } else {
                    1 // Streak broken.
                }
            } else {
                1
            }
        }
        None => 1,
    };

    db::settings::set_setting(&conn, "current_streak_days", &new_streak.to_string())
        .map_err(|e| format!("DB error: {e}"))?;
    db::settings::set_setting(&conn, "last_active_date", &today)
        .map_err(|e| format!("DB error: {e}"))?;

    let longest_streak = db::settings::get_setting(&conn, "longest_streak_days")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    if new_streak > longest_streak {
        db::settings::set_setting(&conn, "longest_streak_days", &new_streak.to_string())
            .map_err(|e| format!("DB error: {e}"))?;
    }

    // Drop conn before recursive-style call to avoid deadlock. Build result manually.
    let level = level_from_xp(new_xp);
    let xp_to_next_level = xp_to_next(new_xp);

    let badges_json = db::settings::get_setting(&conn, "badges")
        .map_err(|e| format!("DB error: {e}"))?
        .unwrap_or_else(|| "[]".to_string());
    let badges: Vec<Badge> = serde_json::from_str(&badges_json).unwrap_or_default();

    Ok(GamificationState {
        total_xp: new_xp,
        level,
        xp_to_next_level,
        current_streak_days: new_streak,
        longest_streak_days: longest_streak.max(new_streak),
        badges,
    })
}

#[tauri::command]
pub fn check_badges(state: State<'_, AppState>) -> Result<Vec<Badge>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let total_xp = db::settings::get_setting(&conn, "total_xp")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let longest_streak = db::settings::get_setting(&conn, "longest_streak_days")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let all_concepts =
        db::concepts::get_all_concepts(&conn).map_err(|e| format!("DB error: {e}"))?;
    let mastered_count = all_concepts
        .iter()
        .filter(|c| c.mastery_score >= 0.8)
        .count();
    let total_attempts: i64 = all_concepts.iter().map(|c| c.attempt_count).sum();

    let now = chrono::Utc::now().to_rfc3339();

    // Load existing badges.
    let badges_json = db::settings::get_setting(&conn, "badges")
        .map_err(|e| format!("DB error: {e}"))?
        .unwrap_or_else(|| "[]".to_string());
    let mut badges: Vec<Badge> = serde_json::from_str(&badges_json).unwrap_or_default();

    // Define badge conditions and check each.
    let badge_defs: Vec<(&str, &str, &str, bool)> = vec![
        ("first_step", "First Step", "Complete your first quiz", total_attempts >= 1),
        ("streak_3", "Three-Day Streak", "Study for 3 days in a row", longest_streak >= 3),
        ("streak_7", "Week Warrior", "Study for 7 days in a row", longest_streak >= 7),
        ("streak_30", "Monthly Marathon", "Study for 30 days in a row", longest_streak >= 30),
        ("xp_100", "Century Club", "Earn 100 XP", total_xp >= 100),
        ("xp_1000", "XP Master", "Earn 1000 XP", total_xp >= 1000),
        ("mastery_1", "First Mastery", "Master your first concept", mastered_count >= 1),
        ("mastery_10", "Decathlon", "Master 10 concepts", mastered_count >= 10),
        ("mastery_50", "Half Century", "Master 50 concepts", mastered_count >= 50),
        ("attempts_100", "Persistent Learner", "Complete 100 quiz attempts", total_attempts >= 100),
    ];

    let mut changed = false;
    for (id, name, desc, condition) in badge_defs {
        let existing = badges.iter_mut().find(|b| b.id == id);
        match existing {
            Some(badge) => {
                if condition && !badge.earned {
                    badge.earned = true;
                    badge.earned_at = Some(now.clone());
                    changed = true;
                }
            }
            None => {
                badges.push(Badge {
                    id: id.to_string(),
                    name: name.to_string(),
                    description: desc.to_string(),
                    earned: condition,
                    earned_at: if condition { Some(now.clone()) } else { None },
                });
                changed = true;
            }
        }
    }

    if changed {
        let json = serde_json::to_string(&badges).unwrap_or_else(|_| "[]".to_string());
        db::settings::set_setting(&conn, "badges", &json)
            .map_err(|e| format!("DB error: {e}"))?;
    }

    Ok(badges)
}
