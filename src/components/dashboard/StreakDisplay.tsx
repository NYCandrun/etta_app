import { motion } from "framer-motion";
import type { StreakInfo } from "@/types/gamification";

interface StreakDisplayProps {
  streak: StreakInfo;
  className?: string;
}

export function StreakDisplay({ streak, className = "" }: StreakDisplayProps) {
  const hasStreak = streak.currentDays > 0;

  return (
    <div className={`card flex items-center gap-4 ${className}`}>
      {/* Flame icon */}
      <motion.div
        className="relative flex h-12 w-12 items-center justify-center"
        animate={hasStreak ? { scale: [1, 1.08, 1] } : {}}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut",
        }}
      >
        <svg
          className={`h-10 w-10 ${hasStreak ? "text-accent-500" : "text-warm-300 dark:text-warm-600"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12.75 2.25c.398 0 .72.322.72.72 0 3.476-1.012 5.46-2.206 7.045-.472.625-.98 1.17-1.454 1.711a32.52 32.52 0 00-.582.66c.274-.038.586-.026.922.05 1.162.267 2.234 1.07 2.857 2.702.398 1.04.525 2.392.184 4.074a.75.75 0 01-1.466-.306c.272-1.336.162-2.37-.12-3.11-.382-1.004-1.083-1.486-1.78-1.647-.832-.191-1.555.166-1.755.478a.75.75 0 01-1.313-.72c.16-.29.456-.68.839-1.13.494-.584 1.135-1.278 1.715-2.044C10.283 9.567 11.03 7.892 11.03 4.97c-2.117 1.572-4.281 4.636-4.281 9.28 0 3.07 1.3 5.136 3.066 6.367a.75.75 0 01-.867 1.225C6.767 20.293 5.25 17.695 5.25 14.25c0-5.77 3.12-9.583 5.84-11.37A.75.75 0 0112.75 2.25z" />
        </svg>
        {hasStreak && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)",
            }}
          />
        )}
      </motion.div>

      {/* Info */}
      <div className="flex-1">
        <p className="text-2xl font-bold text-warm-900 dark:text-warm-100">
          {streak.currentDays}{" "}
          <span className="text-sm font-medium text-warm-500 dark:text-warm-400">
            day{streak.currentDays !== 1 ? "s" : ""}
          </span>
        </p>
        <p className="text-xs text-warm-400 dark:text-warm-500">
          {streak.currentDays > 0
            ? `Best: ${streak.longestDays} days`
            : "Start a streak today!"}
        </p>
      </div>

      {/* Freeze indicator */}
      {streak.freezeActive && (
        <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636"
            />
          </svg>
          Freeze active
        </div>
      )}
    </div>
  );
}
