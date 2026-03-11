import { useCallback, useEffect } from "react";
import {
  useSettingsStore,
  type ThemeMode,
  type DailyGoalMinutes,
} from "@/stores/settingsStore";
import * as ipc from "@/lib/ipc";

/**
 * Hook for reading and updating application settings.
 * Syncs changes to the Tauri backend when available.
 */
export function useSettings() {
  const store = useSettingsStore();

  const initialize = useCallback(async () => {
    if (store.initialized) return;
    try {
      const [theme, dailyGoal, apiKeySet] = await Promise.all([
        ipc.getSetting<ThemeMode>("theme"),
        ipc.getSetting<DailyGoalMinutes>("daily_goal"),
        ipc.getSetting<boolean>("api_key_set"),
      ]);
      store.hydrate({
        theme: theme ?? "light",
        dailyGoal: dailyGoal ?? 30,
        apiKeySet: apiKeySet ?? false,
        initialized: true,
      });
    } catch {
      // In browser mode or on error, use defaults
      store.setInitialized(true);
    }
  }, [store]);

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      store.setTheme(theme);
      applyThemeToDocument(theme);
      try {
        await ipc.setSetting("theme", theme);
      } catch {
        // Silently fail in browser
      }
    },
    [store]
  );

  const setDailyGoal = useCallback(
    async (goal: DailyGoalMinutes) => {
      store.setDailyGoal(goal);
      try {
        await ipc.setSetting("daily_goal", goal);
      } catch {
        // Silently fail in browser
      }
    },
    [store]
  );

  const setApiKeySet = useCallback(
    (val: boolean) => {
      store.setApiKeySet(val);
    },
    [store]
  );

  useEffect(() => {
    applyThemeToDocument(store.theme);
  }, [store.theme]);

  return {
    theme: store.theme,
    dailyGoal: store.dailyGoal,
    apiKeySet: store.apiKeySet,
    initialized: store.initialized,
    initialize,
    setTheme,
    setDailyGoal,
    setApiKeySet,
  };
}

function applyThemeToDocument(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    root.classList.toggle("dark", prefersDark);
  }
  localStorage.setItem("astrolabe-theme", theme);
}
