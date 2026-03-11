import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DailyGoalRingProps {
  /** 0-1 progress toward daily goal */
  progress: number;
  /** Goal in minutes */
  goalMinutes: number;
  /** Minutes completed today */
  minutesCompleted: number;
  className?: string;
}

const RADIUS = 60;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DailyGoalRing({
  progress,
  goalMinutes,
  minutesCompleted,
  className = "",
}: DailyGoalRingProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clampedProgress);

  const isComplete = clampedProgress >= 1;

  useEffect(() => {
    if (isComplete) {
      setShowCelebration(true);
      const timeout = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [isComplete]);

  const strokeColor = isComplete
    ? "text-success-500"
    : clampedProgress > 0.5
      ? "text-primary-500"
      : "text-primary-300 dark:text-primary-600";

  return (
    <div className={`card flex flex-col items-center gap-3 ${className}`}>
      <h3 className="text-sm font-medium text-warm-500 dark:text-warm-400">
        Daily Goal
      </h3>

      <div className="relative">
        <svg
          className="-rotate-90"
          width={(RADIUS + STROKE_WIDTH) * 2}
          height={(RADIUS + STROKE_WIDTH) * 2}
          viewBox={`0 0 ${(RADIUS + STROKE_WIDTH) * 2} ${(RADIUS + STROKE_WIDTH) * 2}`}
        >
          {/* Track */}
          <circle
            cx={RADIUS + STROKE_WIDTH}
            cy={RADIUS + STROKE_WIDTH}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-warm-200 dark:text-warm-800"
          />
          {/* Progress */}
          <motion.circle
            cx={RADIUS + STROKE_WIDTH}
            cy={RADIUS + STROKE_WIDTH}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={strokeColor}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {isComplete ? (
              <motion.div
                key="complete"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <svg
                  className="h-8 w-8 text-success-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <span className="text-2xl font-bold text-warm-900 dark:text-warm-100">
                  {minutesCompleted}
                </span>
                <span className="block text-xs text-warm-400 dark:text-warm-500">
                  / {goalMinutes} min
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Celebration particles */}
        <AnimatePresence>
          {showCelebration &&
            Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-accent-400"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((i * Math.PI) / 4) * 50,
                  y: Math.sin((i * Math.PI) / 4) * 50,
                  opacity: 0,
                  scale: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ))}
        </AnimatePresence>
      </div>

      <p className="text-xs text-warm-400 dark:text-warm-500">
        {isComplete
          ? "Goal reached! Great work today."
          : `${goalMinutes - minutesCompleted} min to go`}
      </p>
    </div>
  );
}
