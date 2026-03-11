import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type DailyGoalMinutes = 15 | 30 | 45 | 60;

/** Known Claude model entry discovered from the API */
export interface ModelOption {
  id: string;
  displayName: string;
}

/** Default models — updated at runtime via API discovery */
export const DEFAULT_BASE_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_ESCALATION_MODEL = "claude-opus-4-6";

interface SettingsState {
  theme: ThemeMode;
  dailyGoal: DailyGoalMinutes;
  apiKeySet: boolean;
  initialized: boolean;

  /** Model used for lessons, quizzes, and standard evaluation */
  baseModel: string;
  /** Model used for explain-my-mistake escalation, re-grading, and no-right-answer checks */
  escalationModel: string;
  /** Available models discovered from the API */
  availableModels: ModelOption[];

  setTheme: (theme: ThemeMode) => void;
  setDailyGoal: (goal: DailyGoalMinutes) => void;
  setApiKeySet: (set: boolean) => void;
  setInitialized: (init: boolean) => void;
  setBaseModel: (model: string) => void;
  setEscalationModel: (model: string) => void;
  setAvailableModels: (models: ModelOption[]) => void;
  hydrate: (partial: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "light",
  dailyGoal: 30,
  apiKeySet: false,
  initialized: false,
  baseModel: DEFAULT_BASE_MODEL,
  escalationModel: DEFAULT_ESCALATION_MODEL,
  availableModels: [],

  setTheme: (theme) => set({ theme }),
  setDailyGoal: (dailyGoal) => set({ dailyGoal }),
  setApiKeySet: (apiKeySet) => set({ apiKeySet }),
  setInitialized: (initialized) => set({ initialized }),
  setBaseModel: (baseModel) => set({ baseModel }),
  setEscalationModel: (escalationModel) => set({ escalationModel }),
  setAvailableModels: (availableModels) => set({ availableModels }),
  hydrate: (partial) => set(partial),
}));
