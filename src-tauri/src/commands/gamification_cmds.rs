use crate::db;
use crate::AppState;
use serde::Serialize;
use tauri::State;

/// Level info — matches the TypeScript Level interface.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelInfo {
    pub current: i64,
    pub title: String,
    pub xp_for_current: i64,
    pub xp_for_next: i64,
    pub progress: f64, // 0.0–1.0 within current level
}

/// Streak info — matches the TypeScript StreakInfo interface.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfo {
    pub current_days: i64,
    pub longest_days: i64,
    pub today_completed: bool,
    pub freezes_available: i64,
    pub freeze_active: bool,
    pub last_active_date: String,
}

/// Badge — matches the TypeScript Badge interface.
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Badge {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default = "default_icon")]
    pub icon_name: String,
    pub earned: bool,
    pub earned_at: Option<String>,
    #[serde(default)]
    pub requirement: String,
    #[serde(default = "default_category")]
    pub category: String,
}

fn default_icon() -> String {
    "award".to_string()
}

fn default_category() -> String {
    "special".to_string()
}

/// Current gamification state — matches the TypeScript GamificationState interface.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GamificationState {
    pub xp: i64,
    pub level: LevelInfo,
    pub streak: StreakInfo,
    pub badges: Vec<Badge>,
    pub recent_xp_events: Vec<db::xp_events::XpEvent>,
}

/// Level titles matching the frontend LEVEL_TITLES map.
fn level_title(level: i64) -> String {
    match level {
        1 => "Curious Novice",
        2 => "Eager Learner",
        3 => "Knowledge Seeker",
        4 => "Rising Scholar",
        5 => "Diligent Student",
        6 => "Sharp Mind",
        7 => "Dedicated Thinker",
        8 => "Skilled Analyst",
        9 => "Expert Explorer",
        10 => "Brilliant Sage",
        11 => "Master Scientist",
        12 => "Astrolabe Virtuoso",
        _ if level > 12 => "Astrolabe Virtuoso",
        _ => "Curious Novice",
    }
    .to_string()
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

/// Cumulative XP required to reach the start of a given level.
fn xp_at_level_start(level: i64) -> i64 {
    let mut accumulated = 0i64;
    for l in 1..level {
        accumulated += xp_for_level(l);
    }
    accumulated
}

/// Build the full GamificationState from DB.
fn build_state(
    conn: &rusqlite::Connection,
    total_xp: i64,
    streak_days: i64,
    longest_streak: i64,
    badges: Vec<Badge>,
) -> Result<GamificationState, String> {
    let level = level_from_xp(total_xp);
    let level_start = xp_at_level_start(level);
    let level_size = xp_for_level(level);
    let xp_into_level = total_xp - level_start;
    let progress = if level_size > 0 {
        (xp_into_level as f64 / level_size as f64).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let last_active = db::settings::get_setting(conn, "last_active_date")
        .map_err(|e| format!("DB error: {e}"))?
        .unwrap_or_default();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_completed = last_active == today;

    let freeze_active = db::settings::get_setting(conn, "streak_freeze_active")
        .map_err(|e| format!("DB error: {e}"))?
        .map(|v| v == "true")
        .unwrap_or(false);

    let freezes_available = db::settings::get_setting(conn, "streak_freezes_available")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let recent_xp_events = db::xp_events::get_recent_xp_events(conn, 20)
        .map_err(|e| format!("DB error: {e}"))?;

    Ok(GamificationState {
        xp: total_xp,
        level: LevelInfo {
            current: level,
            title: level_title(level),
            xp_for_current: level_start,
            xp_for_next: level_start + level_size,
            progress,
        },
        streak: StreakInfo {
            current_days: streak_days,
            longest_days: longest_streak,
            today_completed,
            freezes_available,
            freeze_active,
            last_active_date: last_active,
        },
        badges,
        recent_xp_events,
    })
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

    build_state(&conn, total_xp, current_streak, longest_streak, badges)
}

/// Maximum XP that can be awarded in a single call.
const MAX_XP_PER_AWARD: i64 = 100;

#[tauri::command]
pub fn award_xp(
    state: State<'_, AppState>,
    amount: i64,
    source: Option<String>,
    description: Option<String>,
) -> Result<GamificationState, String> {
    // Validate XP amount to prevent abuse
    if amount <= 0 || amount > MAX_XP_PER_AWARD {
        return Err(format!(
            "XP amount must be between 1 and {}.",
            MAX_XP_PER_AWARD
        ));
    }

    // Reject frontend XP awards for quiz answers/completions — these are already
    // awarded server-side in submit_answer to prevent double-counting.
    let src = source.as_deref().unwrap_or("unknown");
    if matches!(src, "quiz_answer" | "quiz_completion" | "quiz_complete" | "quiz_perfect" | "quiz_pass") {
        return Err(
            "Quiz XP is awarded server-side. Frontend award_xp for quiz sources is not allowed."
                .to_string(),
        );
    }

    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let current_xp = db::settings::get_setting(&conn, "total_xp")
        .map_err(|e| format!("DB error: {e}"))?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let new_xp = current_xp + amount;
    db::settings::set_setting(&conn, "total_xp", &new_xp.to_string())
        .map_err(|e| format!("DB error: {e}"))?;

    // Store the XP event for audit trail
    let event_source = source.as_deref().unwrap_or("unknown");
    let event_desc = description.as_deref().unwrap_or("");
    db::xp_events::insert_xp_event(&conn, amount, event_source, event_desc)
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

    let badges_json = db::settings::get_setting(&conn, "badges")
        .map_err(|e| format!("DB error: {e}"))?
        .unwrap_or_else(|| "[]".to_string());
    let badges: Vec<Badge> = serde_json::from_str(&badges_json).unwrap_or_default();

    build_state(&conn, new_xp, new_streak, longest_streak.max(new_streak), badges)
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

    // Check domain completions for curriculum badges
    let mut domains: std::collections::HashMap<&str, (usize, usize)> = std::collections::HashMap::new();
    for c in &all_concepts {
        let entry = domains.entry(c.domain.as_str()).or_insert((0, 0));
        entry.0 += 1; // total
        if c.mastery_score >= 0.8 {
            entry.1 += 1; // mastered
        }
    }
    let algebra_complete = domains.get("algebra").map_or(false, |(t, m)| m >= t && *t > 0);
    let precalculus_complete = domains.get("precalculus").map_or(false, |(t, m)| m >= t && *t > 0);
    let trigonometry_complete = domains.get("trigonometry").map_or(false, |(t, m)| m >= t && *t > 0);

    // Count modules completed (all concepts in module mastered)
    let mut modules: std::collections::HashMap<(&str, &str), (usize, usize)> = std::collections::HashMap::new();
    for c in &all_concepts {
        let entry = modules.entry((c.domain.as_str(), c.module.as_str())).or_insert((0, 0));
        entry.0 += 1;
        if c.mastery_score >= 0.8 { entry.1 += 1; }
    }
    let modules_completed = modules.values().filter(|(t, m)| m >= t && *t > 0).count();

    // Define badge conditions and check each.
    let badge_defs: Vec<(&str, &str, &str, &str, &str, bool)> = vec![
        ("first_step", "First Step", "Complete your first quiz", "star", "special", total_attempts >= 1),
        ("streak_3", "Three-Day Streak", "Study for 3 days in a row", "flame", "streak", longest_streak >= 3),
        ("streak_7", "Week Warrior", "Study for 7 days in a row", "flame", "streak", longest_streak >= 7),
        ("streak_30", "Monthly Marathon", "Study for 30 days in a row", "flame", "streak", longest_streak >= 30),
        ("xp_100", "Century Club", "Earn 100 XP", "zap", "exploration", total_xp >= 100),
        ("xp_1000", "XP Master", "Earn 1000 XP", "zap", "exploration", total_xp >= 1000),
        ("mastery_1", "First Mastery", "Master your first concept", "trophy", "mastery", mastered_count >= 1),
        ("mastery_10", "Decathlon", "Master 10 concepts", "trophy", "mastery", mastered_count >= 10),
        ("mastery_50", "Half Century", "Master 50 concepts", "trophy", "mastery", mastered_count >= 50),
        ("attempts_100", "Persistent Learner", "Complete 100 quiz attempts", "target", "special", total_attempts >= 100),
        // Curriculum progress badges
        ("module_5", "Module Maven", "Complete 5 modules", "book-open", "mastery", modules_completed >= 5),
        ("module_15", "Curriculum Conqueror", "Complete 15 modules", "book-open", "mastery", modules_completed >= 15),
        ("domain_algebra", "Algebra Graduate", "Master all algebra concepts", "graduation-cap", "mastery", algebra_complete),
        ("domain_precalculus", "Precalculus Pro", "Master all precalculus concepts", "graduation-cap", "mastery", precalculus_complete),
        ("domain_trigonometry", "Trig Titan", "Master all trigonometry concepts", "graduation-cap", "mastery", trigonometry_complete),
    ];

    let mut changed = false;
    for (id, name, desc, icon, category, condition) in badge_defs {
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
                    icon_name: icon.to_string(),
                    earned: condition,
                    earned_at: if condition { Some(now.clone()) } else { None },
                    requirement: desc.to_string(),
                    category: category.to_string(),
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

// ── Curriculum milestone rewards ─────────────────────────────────────────────

/// XP awarded for each curriculum milestone type.
const XP_CONCEPT_STARTED: i64 = 1;
const XP_CONCEPT_MASTERED: i64 = 2;
const XP_MODULE_COMPLETED: i64 = 5;
const XP_DOMAIN_COMPLETED: i64 = 25;

/// Returned from check_curriculum_rewards so the frontend can show popups.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumRewardResult {
    pub rewards_granted: Vec<GrantedReward>,
    pub total_xp_awarded: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantedReward {
    pub reward_type: String,
    pub entity_id: String,
    pub label: String,
    pub xp: i64,
}

/// Check all curriculum milestones and award XP for any newly achieved ones.
/// This is called after mastery updates and lesson views. Each milestone is
/// only rewarded once (enforced by UNIQUE constraint in curriculum_rewards).
pub fn award_curriculum_milestones(conn: &rusqlite::Connection) -> Result<CurriculumRewardResult, String> {
    let all_concepts =
        db::concepts::get_all_concepts(conn).map_err(|e| format!("DB error: {e}"))?;

    let mut rewards_granted: Vec<GrantedReward> = Vec::new();
    let mut total_xp: i64 = 0;

    // 1. Concept started: first engagement (attempt_count > 0)
    for concept in &all_concepts {
        if concept.attempt_count > 0 {
            let entity = format!("concept:{}", concept.id);
            if let Ok(true) = db::curriculum_rewards::award_reward(
                conn, "concept_started", &entity, XP_CONCEPT_STARTED,
            ) {
                rewards_granted.push(GrantedReward {
                    reward_type: "concept_started".to_string(),
                    entity_id: entity,
                    label: format!("Started: {}", concept.title),
                    xp: XP_CONCEPT_STARTED,
                });
                total_xp += XP_CONCEPT_STARTED;
            }
        }
    }

    // 2. Concept mastered: mastery >= 0.8 for the first time
    for concept in &all_concepts {
        if concept.mastery_score >= 0.8 {
            let entity = format!("concept:{}", concept.id);
            if let Ok(true) = db::curriculum_rewards::award_reward(
                conn, "concept_mastered", &entity, XP_CONCEPT_MASTERED,
            ) {
                rewards_granted.push(GrantedReward {
                    reward_type: "concept_mastered".to_string(),
                    entity_id: entity,
                    label: format!("Mastered: {}", concept.title),
                    xp: XP_CONCEPT_MASTERED,
                });
                total_xp += XP_CONCEPT_MASTERED;
            }
        }
    }

    // 3. Module completed: all concepts in a module mastered
    // Group concepts by (domain, module)
    let mut modules: std::collections::HashMap<(String, String), Vec<&db::concepts::Concept>> =
        std::collections::HashMap::new();
    for concept in &all_concepts {
        modules
            .entry((concept.domain.clone(), concept.module.clone()))
            .or_default()
            .push(concept);
    }

    for ((domain, module), concepts) in &modules {
        let all_mastered = concepts.iter().all(|c| c.mastery_score >= 0.8);
        if all_mastered {
            let entity = format!("module:{}:{}", domain, module);
            if let Ok(true) = db::curriculum_rewards::award_reward(
                conn, "module_completed", &entity, XP_MODULE_COMPLETED,
            ) {
                rewards_granted.push(GrantedReward {
                    reward_type: "module_completed".to_string(),
                    entity_id: entity,
                    label: format!("Completed module: {}", module),
                    xp: XP_MODULE_COMPLETED,
                });
                total_xp += XP_MODULE_COMPLETED;
            }
        }
    }

    // 4. Domain completed: all concepts in a domain mastered
    let mut domains: std::collections::HashMap<String, Vec<&db::concepts::Concept>> =
        std::collections::HashMap::new();
    for concept in &all_concepts {
        domains
            .entry(concept.domain.clone())
            .or_default()
            .push(concept);
    }

    for (domain, concepts) in &domains {
        let all_mastered = concepts.iter().all(|c| c.mastery_score >= 0.8);
        if all_mastered {
            let entity = format!("domain:{}", domain);
            if let Ok(true) = db::curriculum_rewards::award_reward(
                conn, "domain_completed", &entity, XP_DOMAIN_COMPLETED,
            ) {
                rewards_granted.push(GrantedReward {
                    reward_type: "domain_completed".to_string(),
                    entity_id: entity,
                    label: format!("Completed curriculum: {}", domain),
                    xp: XP_DOMAIN_COMPLETED,
                });
                total_xp += XP_DOMAIN_COMPLETED;
            }
        }
    }

    // Add the total XP to the user's running total
    if total_xp > 0 {
        let current_xp = db::settings::get_setting(conn, "total_xp")
            .ok()
            .flatten()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0);
        let _ = db::settings::set_setting(conn, "total_xp", &(current_xp + total_xp).to_string());

        // Log each reward as an XP event for the audit trail
        for reward in &rewards_granted {
            let _ = db::xp_events::insert_xp_event(
                conn,
                reward.xp,
                &reward.reward_type,
                &reward.label,
            );
        }
    }

    Ok(CurriculumRewardResult {
        rewards_granted,
        total_xp_awarded: total_xp,
    })
}

/// Tauri command: check and award curriculum milestone rewards.
#[tauri::command]
pub fn check_curriculum_rewards(
    state: State<'_, AppState>,
) -> Result<CurriculumRewardResult, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    award_curriculum_milestones(&conn)
}
