import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import type { ThemeMode, DailyGoalMinutes } from "@/stores/settingsStore";
import * as ipc from "@/lib/ipc";

const DAILY_GOAL_OPTIONS: { value: DailyGoalMinutes; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
];

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function Settings() {
  const {
    theme, dailyGoal, apiKeySet,
    baseModel, escalationModel, availableModels,
    setTheme, setDailyGoal, setApiKeySet,
    setBaseModel, setEscalationModel,
  } = useSettings();

  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState(apiKeySet);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await ipc.storeApiKey(apiKey.trim());
      setApiKeySet(true);
      setApiKeyMasked(true);
      setApiKey("");
      setTestResult(null);
    } catch {
      // Silently fail in browser
      setApiKeySet(true);
      setApiKeyMasked(true);
      setApiKey("");
    } finally {
      setSaving(false);
    }
  }, [apiKey, setApiKeySet]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await ipc.testApiKey();
      setTestResult(result);
    } catch {
      setTestResult({
        valid: false,
        message: "Unable to test connection. Are you running inside Tauri?",
      });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await ipc.exportData();
      if (data) {
        // Create download in browser
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "astrolabe-export.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-2xl space-y-8"
    >
      {/* API Key */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          API Key
        </h2>
        <p className="text-sm text-warm-500 dark:text-warm-400">
          Your API key is stored securely on your device and never sent to any
          server other than the AI provider.
        </p>

        {apiKeyMasked ? (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="password"
                value="sk-••••••••••••••••••••••••"
                disabled
                className="input"
              />
            </div>
            <button
              onClick={() => {
                setApiKeyMasked(false);
                setApiKey("");
              }}
              className="btn-secondary"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="input font-mono text-sm"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveApiKey()}
                disabled={!apiKey.trim() || saving}
                className="btn-primary"
              >
                {saving ? "Saving..." : "Save Key"}
              </button>
              <button
                onClick={() => void handleTestConnection()}
                disabled={testing}
                className="btn-secondary"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </div>
        )}

        {testResult && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              testResult.valid
                ? "bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-300"
                : "bg-danger-50 text-danger-700 dark:bg-danger-950/30 dark:text-danger-300"
            }`}
          >
            {testResult.valid ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {testResult.message}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {testResult.message}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          Appearance
        </h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => void setTheme(opt.value)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-smooth ${
                theme === opt.value
                  ? "bg-primary-100 text-primary-700 ring-2 ring-primary-300 dark:bg-primary-900 dark:text-primary-300 dark:ring-primary-700"
                  : "bg-warm-100 text-warm-600 hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-400 dark:hover:bg-warm-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Daily Goal */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          Daily Learning Goal
        </h2>
        <p className="text-sm text-warm-500 dark:text-warm-400">
          How much time would you like to spend learning each day?
        </p>
        <div className="flex gap-2">
          {DAILY_GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => void setDailyGoal(opt.value)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-smooth ${
                dailyGoal === opt.value
                  ? "bg-primary-100 text-primary-700 ring-2 ring-primary-300 dark:bg-primary-900 dark:text-primary-300 dark:ring-primary-700"
                  : "bg-warm-100 text-warm-600 hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-400 dark:hover:bg-warm-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Model Selection */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          AI Models
        </h2>
        <p className="text-sm text-warm-500 dark:text-warm-400">
          Choose which Claude models to use. The base model handles lessons and quizzes.
          The escalation model is used for &quot;Explain my mistake,&quot; &quot;There are no right answers,&quot; and re-grading.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">Base Model (lessons &amp; quizzes)</label>
            <select
              value={baseModel}
              onChange={(e) => void setBaseModel(e.target.value)}
              className="input"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Escalation Model (explain mistake / re-grade / no right answer)
            </label>
            <select
              value={escalationModel}
              onChange={(e) => void setEscalationModel(e.target.value)}
              className="input"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-warm-400 dark:text-warm-500">
              A more capable model gives better explanations for complex problems but costs more.
            </p>
          </div>
        </div>
      </section>

      {/* Data Export */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          Data
        </h2>
        <p className="text-sm text-warm-500 dark:text-warm-400">
          Export all your learning data as a JSON file.
        </p>
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="btn-secondary"
        >
          {exporting ? "Exporting..." : "Export Data"}
        </button>
      </section>
    </motion.div>
  );
}
