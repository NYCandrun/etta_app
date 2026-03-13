export interface GamificationState {
  xp: number;
  level: Level;
  streak: StreakInfo;
  badges: Badge[];
  recentXpEvents: XPEvent[];
}

export interface Level {
  current: number;
  title: string;
  xpForCurrent: number;
  xpForNext: number;
  progress: number; // 0–1 within current level
}

export interface StreakInfo {
  currentDays: number;
  longestDays: number;
  todayCompleted: boolean;
  freezesAvailable: number;
  freezeActive: boolean;
  lastActiveDate: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconName: string;
  earned: boolean;
  earnedAt: string | null;
  requirement: string;
  category: BadgeCategory;
}

export type BadgeCategory =
  | "mastery"
  | "streak"
  | "exploration"
  | "project"
  | "special";

export interface XPEvent {
  id: string;
  amount: number;
  source: XPSource;
  description: string;
  timestamp: string;
}

export type XPSource =
  | "concept_started"
  | "concept_mastered"
  | "module_completed"
  | "domain_completed"
  | "project_pass"
  | "streak_bonus"
  | "badge_earned"
  | "daily_goal";

export interface CurriculumRewardResult {
  rewardsGranted: GrantedReward[];
  totalXpAwarded: number;
}

export interface GrantedReward {
  rewardType: string;
  entityId: string;
  label: string;
  xp: number;
}

export const LEVEL_TITLES: Record<number, string> = {
  1: "Curious Novice",
  2: "Eager Learner",
  3: "Knowledge Seeker",
  4: "Rising Scholar",
  5: "Diligent Student",
  6: "Sharp Mind",
  7: "Dedicated Thinker",
  8: "Skilled Analyst",
  9: "Expert Explorer",
  10: "Brilliant Sage",
  11: "Master Scientist",
  12: "Astrolabe Virtuoso",
};
