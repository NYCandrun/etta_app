import { useLocation, useNavigate } from "react-router-dom";
import { useGamification } from "@/hooks/useGamification";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "@/hooks/useSession";
import { useSaveProgress } from "@/hooks/useSaveProgress";
import { formatXP } from "@/lib/format";
import type { CurriculumState } from "@/types/concept";
import { useState, useEffect, useCallback } from "react";
import * as ipc from "@/lib/ipc";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/lesson": "Lesson",
  "/quiz": "Quiz",
  "/projects": "Projects",
  "/progress": "Progress",
  "/settings": "Settings",
  "/diagnostic": "Diagnostic",
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { xp, streak, level } = useGamification();
  const { dailyGoal } = useSettings();
  const { currentConcept, startLearningPath } = useSession();
  const { save } = useSaveProgress();
  const [curriculum, setCurriculum] = useState<CurriculumState | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    const ok = await save();
    setSaveStatus(ok ? "saved" : "idle");
    if (ok) {
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [save]);

  const title =
    location.pathname.startsWith("/path/")
      ? "Learning Path"
      : (ROUTE_TITLES[location.pathname] ?? "Astrolabe");

  useEffect(() => {
    (async () => {
      try {
        const state = await ipc.getCurriculumState();
        if (state) setCurriculum(state);
      } catch (err) {
        console.error("[TopBar] Failed to load curriculum state:", err);
      }
    })();
  }, []);

  const handleStartLearning = () => {
    if (currentConcept) {
      navigate("/lesson");
      return;
    }

    if (!curriculum) {
      navigate("/diagnostic");
      return;
    }

    // Find in-progress concept first
    const inProgress = curriculum.concepts.find(
      (c) => c.state === "in_progress"
    );

    if (inProgress) {
      const domainConcepts = curriculum.concepts.filter(
        (c) => c.domain.id === inProgress.domain.id
      );
      startLearningPath(domainConcepts);
      navigate("/lesson");
    } else {
      // Start at algebra (assumes no previous learning)
      const algebraConcepts = curriculum.concepts.filter(
        (c) => c.domain.id === "algebra"
      );
      if (algebraConcepts.length > 0) {
        startLearningPath(algebraConcepts);
        navigate("/lesson");
      } else {
        navigate("/diagnostic");
      }
    }
  };

  const dailyProgress = streak.todayCompleted ? 1 : 0.4;
  const circumference = 2 * Math.PI * 10;
  const dashOffset = circumference * (1 - dailyProgress);

  return (
    <header className="flex h-topbar items-center justify-between border-b border-warm-200 bg-white px-8 dark:border-warm-800 dark:bg-warm-900">
      <h1 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
        {title}
      </h1>

      <div className="flex items-center gap-4">
        {/* Start Learning button */}
        <button
          onClick={handleStartLearning}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          {currentConcept ? "Continue Learning" : "Start Learning"}
        </button>

        {/* Save Progress button */}
        <button
          onClick={() => void handleSave()}
          disabled={saveStatus === "saving"}
          title="Save your current position"
          className="flex items-center gap-1.5 rounded-lg border border-warm-200 px-3 py-1.5 text-xs font-medium text-warm-600 transition-all hover:bg-warm-100 active:scale-[0.97] dark:border-warm-700 dark:text-warm-400 dark:hover:bg-warm-800"
        >
          {saveStatus === "saving" ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-warm-300 border-t-primary-500" />
          ) : saveStatus === "saved" ? (
            <svg className="h-3.5 w-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          )}
          {saveStatus === "saved" ? "Saved!" : "Save Progress"}
        </button>

        <div className="h-5 w-px bg-warm-200 dark:bg-warm-700" />

        {/* XP Display */}
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
          </svg>
          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300">
            {formatXP(xp)} XP
          </span>
        </div>

        {/* Streak flame */}
        <div className="flex items-center gap-1.5">
          <svg
            className={`h-4 w-4 ${streak.currentDays > 0 ? "text-accent-500" : "text-warm-300 dark:text-warm-600"}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12.75 2.25c.398 0 .72.322.72.72 0 3.476-1.012 5.46-2.206 7.045-.472.625-.98 1.17-1.454 1.711a32.52 32.52 0 00-.582.66c.274-.038.586-.026.922.05 1.162.267 2.234 1.07 2.857 2.702.398 1.04.525 2.392.184 4.074a.75.75 0 01-1.466-.306c.272-1.336.162-2.37-.12-3.11-.382-1.004-1.083-1.486-1.78-1.647-.832-.191-1.555.166-1.755.478a.75.75 0 01-1.313-.72c.16-.29.456-.68.839-1.13.494-.584 1.135-1.278 1.715-2.044C10.283 9.567 11.03 7.892 11.03 4.97c-2.117 1.572-4.281 4.636-4.281 9.28 0 3.07 1.3 5.136 3.066 6.367a.75.75 0 01-.867 1.225C6.767 20.293 5.25 17.695 5.25 14.25c0-5.77 3.12-9.583 5.84-11.37A.75.75 0 0112.75 2.25z" />
          </svg>
          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300">
            {streak.currentDays}
          </span>
        </div>

        {/* Daily goal mini ring */}
        <div className="relative flex items-center" title={`Daily goal: ${dailyGoal} min`}>
          <svg className="h-7 w-7 -rotate-90" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warm-200 dark:text-warm-700" />
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" className={dailyProgress >= 1 ? "text-success-500" : "text-primary-500"} />
          </svg>
          {dailyProgress >= 1 && (
            <svg className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>

        {/* Level badge */}
        <div className="flex h-7 items-center gap-1 rounded-lg bg-primary-50 px-2 dark:bg-primary-950">
          <span className="text-xs font-bold text-primary-700 dark:text-primary-300">
            Lv. {level.current}
          </span>
        </div>
      </div>
    </header>
  );
}
