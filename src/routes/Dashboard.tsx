import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import type { CurriculumState, Concept } from "@/types/concept";
import * as ipc from "@/lib/ipc";

export default function Dashboard() {
  const navigate = useNavigate();
  const { xp, level, streak } = useGamification();
  const { dailyGoal } = useSettings();
  const { startSession, startLearningPath, sessionConcepts, todayMinutes, currentConcept, quizSession } = useSession();
  const [curriculum, setCurriculum] = useState<CurriculumState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCurriculum = async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await ipc.getCurriculumState();
      if (state) setCurriculum(state);
    } catch {
      setError("Failed to load curriculum. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await ipc.getCurriculumState();
        if (!cancelled && state) setCurriculum(state);
      } catch {
        if (!cancelled) setError("Failed to load curriculum. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build learning paths from curriculum
  const learningPaths = curriculum ? buildLearningPaths(curriculum) : [];

  const minutesCompleted = streak.todayCompleted ? dailyGoal : Math.min(Math.round(todayMinutes), dailyGoal);
  const dailyProgress = dailyGoal > 0 ? Math.min(minutesCompleted / dailyGoal, 1) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <DailyGoalRing
          progress={dailyProgress}
          goalMinutes={dailyGoal}
          minutesCompleted={minutesCompleted}
        />
        <StreakDisplay streak={streak} />
        <XPBar xp={xp} level={level} />
      </div>

      {/* Error state */}
      {error && !curriculum && (
        <div className="card border border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-950/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            <button
              onClick={() => void loadCurriculum()}
              className="rounded-lg bg-danger-100 px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-200 dark:bg-danger-900 dark:text-danger-300 dark:hover:bg-danger-800"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Diagnostic test + quick actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/diagnostic")}
          className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 transition-all hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          Take Diagnostic Test
        </button>
        <p className="text-xs text-warm-400 dark:text-warm-500">
          Find out where to start based on what you already know
        </p>
      </div>

      {/* Learning Paths */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warm-500 dark:text-warm-400">
          Learning Paths
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} className="h-32" />
              ))
            : learningPaths.map((path) => (
                <LearningPathCard
                  key={path.domainId}
                  domainName={path.domainName}
                  color={path.color}
                  conceptCount={path.conceptCount}
                  progress={path.progress}
                  currentConceptName={path.currentConceptName}
                  hasStarted={path.hasStarted}
                  onOpen={() => navigate(`/path/${path.domainId}`)}
                  onStart={() => {
                    // If the user has an active quiz for the concept this path
                    // would resume, go straight back to the quiz instead of
                    // restarting from the lesson.
                    const resumeConcept = path.concepts.find(
                      (c) => c.state === "in_progress" || c.state === "unlocked"
                    ) ?? path.concepts[0];
                    const hasActiveQuiz =
                      resumeConcept &&
                      currentConcept?.id === resumeConcept.id &&
                      quizSession != null &&
                      quizSession.completedAt == null;

                    startLearningPath(path.concepts);
                    navigate(hasActiveQuiz ? "/quiz" : "/lesson");
                  }}
                />
              ))}
        </div>
      </div>

      {/* Main content: Skill tree + session suggestion */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-2">
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

// ─── Learning Path helpers ───────────────────────────────────

interface PathInfo {
  domainId: string;
  domainName: string;
  color: string;
  conceptCount: number;
  progress: number;
  currentConceptName: string | null;
  hasStarted: boolean;
  concepts: Concept[];
}

function buildLearningPaths(curriculum: CurriculumState): PathInfo[] {
  const domainMap = new Map<string, Concept[]>();
  for (const c of curriculum.concepts) {
    const arr = domainMap.get(c.domain.id) ?? [];
    arr.push(c);
    domainMap.set(c.domain.id, arr);
  }

  const paths: PathInfo[] = [];
  for (const [domainId, concepts] of domainMap) {
    const domain = concepts[0]?.domain;
    if (!domain) continue;

    const mastered = concepts.filter((c) => c.state === "mastered").length;
    const hasStarted = concepts.some(
      (c) => c.state === "mastered" || c.state === "in_progress"
    );
    const currentConcept = concepts.find(
      (c) => c.state === "in_progress" || c.state === "unlocked"
    );

    paths.push({
      domainId,
      domainName: domain.name,
      color: domain.color,
      conceptCount: concepts.length,
      progress: concepts.length > 0 ? mastered / concepts.length : 0,
      currentConceptName: currentConcept?.name ?? null,
      hasStarted,
      concepts,
    });
  }

  // Sort by curriculum progression order (left-to-right, top-to-bottom matches
  // the prerequisite chain so users naturally progress through the grid).
  const domainOrder: Record<string, number> = {
    "Algebra": 0,
    "Trigonometry": 1,
    "Precalculus": 2,
    "Single Variable Calculus": 3,
    "Multivariable Calculus": 4,
    "Linear Algebra": 5,
    "Differential Equations": 6,
    "Classical Mechanics": 7,
    "Electromagnetism": 8,
    "Thermodynamics": 9,
    "Quantum Mechanics": 10,
    "Astrophysics": 11,
  };
  paths.sort((a, b) => {
    const orderA = domainOrder[a.domainName] ?? 999;
    const orderB = domainOrder[b.domainName] ?? 999;
    return orderA - orderB;
  });

  return paths;
}

// ─── Learning Path Card ──────────────────────────────────────

interface LearningPathCardProps {
  domainName: string;
  color: string;
  conceptCount: number;
  progress: number;
  currentConceptName: string | null;
  hasStarted: boolean;
  onOpen: () => void;
  onStart: () => void;
}

function LearningPathCard({
  domainName,
  color,
  conceptCount,
  progress,
  currentConceptName,
  hasStarted,
  onOpen,
  onStart,
}: LearningPathCardProps) {
  return (
    <motion.div
      className="card cursor-pointer transition-shadow hover:shadow-md"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="text-sm font-semibold text-warm-900 dark:text-warm-100">
            {domainName}
          </h3>
        </div>
        <span className="text-xs text-warm-400">
          {conceptCount} concepts
        </span>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(progress * 100, hasStarted ? 2 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-warm-400 dark:text-warm-500">
          {hasStarted
            ? currentConceptName
              ? `Next: ${currentConceptName}`
              : `${Math.round(progress * 100)}% complete`
            : "Not started"}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className="rounded-lg px-3 py-1 text-xs font-medium transition-all"
          style={{
            backgroundColor: `${color}15`,
            color,
          }}
        >
          {hasStarted ? "Continue" : "Start"}
        </button>
      </div>
    </motion.div>
  );
}
