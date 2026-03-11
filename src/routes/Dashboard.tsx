import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SkillTree } from "@/components/dashboard/SkillTree";
import { DailyGoalRing } from "@/components/dashboard/DailyGoalRing";
import { StreakDisplay } from "@/components/dashboard/StreakDisplay";
import { XPBar } from "@/components/dashboard/XPBar";
import { SessionSuggestion } from "@/components/dashboard/SessionSuggestion";
import { SkeletonCard } from "@/components/shared/SkeletonLoader";
import { useGamification } from "@/hooks/useGamification";
import { useSession } from "@/hooks/useSession";
import { useSettings } from "@/hooks/useSettings";
import type { CurriculumState } from "@/types/concept";
import * as ipc from "@/lib/ipc";

export default function Dashboard() {
  const { xp, level, streak } = useGamification();
  const { dailyGoal } = useSettings();
  const { startSession, sessionConcepts } = useSession();
  const [curriculum, setCurriculum] = useState<CurriculumState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await ipc.getCurriculumState();
        if (!cancelled && state) setCurriculum(state);
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mock daily progress (in a real app, tracked from session durations)
  const minutesCompleted = streak.todayCompleted ? dailyGoal : Math.round(dailyGoal * 0.4);
  const dailyProgress = minutesCompleted / dailyGoal;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DailyGoalRing
          progress={dailyProgress}
          goalMinutes={dailyGoal}
          minutesCompleted={minutesCompleted}
        />
        <StreakDisplay streak={streak} />
        <XPBar xp={xp} level={level} />
      </div>

      {/* Main content: Skill tree + session suggestion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <SkeletonCard className="min-h-[400px]" />
          ) : (
            <SkillTree
              concepts={curriculum?.concepts ?? []}
              className="min-h-[400px]"
            />
          )}
        </div>

        <div>
          {loading ? (
            <SkeletonCard />
          ) : (
            <SessionSuggestion
              concepts={
                sessionConcepts.length > 0
                  ? sessionConcepts
                  : curriculum?.concepts.filter(
                      (c) =>
                        c.state === "unlocked" || c.state === "in_progress"
                    ) ?? []
              }
              onStart={() => void startSession()}
            />
          )}
        </div>
      </div>

      {/* Curriculum summary */}
      {curriculum && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-500 dark:text-warm-400">
                Overall Progress
              </p>
              <p className="text-2xl font-bold text-warm-900 dark:text-warm-100">
                {Math.round(curriculum.totalMastery * 100)}%
              </p>
            </div>
            <p className="text-sm text-warm-400 dark:text-warm-500">
              {curriculum.conceptsCompleted} / {curriculum.conceptsTotal} concepts
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-success-500"
              initial={{ width: 0 }}
              animate={{
                width: `${curriculum.totalMastery * 100}%`,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
