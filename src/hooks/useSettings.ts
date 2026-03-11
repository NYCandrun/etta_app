import { useCallback, useEffect } from "react";
import {
  useSettingsStore,
  type ThemeMode,
  type DailyGoalMinutes,
  type ModelOption,
  DEFAULT_BASE_MODEL,
  DEFAULT_ESCALATION_MODEL,
} from "@/stores/settingsStore";
import * as ipc from "@/lib/ipc";

/** Built-in model list as fallback when API discovery is unavailable */
function getBuiltInModels(): ModelOption[] {
  return [
    { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4" },
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
  ];
}

/**
 * Hook for reading and updating application settings.
 * Syncs changes to the Tauri backend when available.
 */
export function useSettings() {
  const store = useSettingsStore();

  const initialize = useCallback(async () => {
    if (store.initialized) return;
    try {
      const [theme, dailyGoal, apiKeySet, baseModel, escalationModel] = await Promise.all([
        ipc.getSetting<ThemeMode>("theme"),
        ipc.getSetting<DailyGoalMinutes>("daily_goal"),
        ipc.getSetting<boolean>("api_key_set"),
        ipc.getSetting<string>("base_model"),
        ipc.getSetting<string>("escalation_model"),
      ]);
      store.hydrate({
        theme: theme ?? "light",
        dailyGoal: dailyGoal ?? 30,
        apiKeySet: apiKeySet ?? false,
        baseModel: baseModel ?? DEFAULT_BASE_MODEL,
        escalationModel: escalationModel ?? DEFAULT_ESCALATION_MODEL,
        initialized: true,
      });
    } catch {
      store.setInitialized(true);
    }

    // Discover available models in the background
    void discoverModels();
  }, [store]);

  const discoverModels = useCallback(async () => {
    try {
      const models = await ipc.listAvailableModels();
      if (models && models.length > 0) {
        store.setAvailableModels(models);
      } else {
        store.setAvailableModels(getBuiltInModels());
      }
    } catch {
      store.setAvailableModels(getBuiltInModels());
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

  const setBaseModel = useCallback(
    async (model: string) => {
      store.setBaseModel(model);
      try {
        await ipc.setSetting("base_model", model);
      } catch {
        // Silently fail
      }
    },
    [store]
  );

  const setEscalationModel = useCallback(
    async (model: string) => {
      store.setEscalationModel(model);
      try {
        await ipc.setSetting("escalation_model", model);
      } catch {
        // Silently fail
      }
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
    baseModel: store.baseModel,
    escalationModel: store.escalationModel,
    availableModels: store.availableModels.length > 0 ? store.availableModels : getBuiltInModels(),
    initialize,
    discoverModels,
    setTheme,
    setDailyGoal,
    setApiKeySet,
    setBaseModel,
    setEscalationModel,
  };
}

function applyThemeToDocument(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    root.classList.toggle("dark", prefersDark);
  }
  localStorage.setItem("astrolabe-theme", theme);
}
