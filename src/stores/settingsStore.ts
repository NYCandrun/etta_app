import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type DailyGoalMinutes = 15 | 30 | 45 | 60;

interface SettingsState {
  theme: ThemeMode;
  dailyGoal: DailyGoalMinutes;
  apiKeySet: boolean;
  initialized: boolean;

  setTheme: (theme: ThemeMode) => void;
  setDailyGoal: (goal: DailyGoalMinutes) => void;
  setApiKeySet: (set: boolean) => void;
  setInitialized: (init: boolean) => void;
  hydrate: (partial: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "light",
  dailyGoal: 30,
  apiKeySet: false,
  initialized: false,

  setTheme: (theme) => set({ theme }),
  setDailyGoal: (dailyGoal) => set({ dailyGoal }),
  setApiKeySet: (apiKeySet) => set({ apiKeySet }),
  setInitialized: (initialized) => set({ initialized }),
  hydrate: (partial) => set(partial),
}));
