import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { StreakInfo } from "@/types/gamification";
import * as ipc from "@/lib/ipc";

interface StreakFreezeProps {
  streak: StreakInfo;
  onActivated?: () => void;
  className?: string;
}

export function StreakFreeze({
  streak,
  onActivated,
  className = "",
}: StreakFreezeProps) {
  const [activating, setActivating] = useState(false);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    try {
      const success = await ipc.activateStreakFreeze();
      if (success) {
        onActivated?.();
      }
    } catch {
      // Silently fail
    } finally {
      setActivating(false);
    }
  }, [onActivated]);

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center gap-3">
        {/* Ice crystal icon */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            streak.freezeActive
              ? "bg-blue-100 dark:bg-blue-900"
              : "bg-warm-100 dark:bg-warm-800"
          }`}
        >
          <svg
            className={`h-5 w-5 ${
              streak.freezeActive
                ? "text-blue-500"
                : "text-warm-400 dark:text-warm-500"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v18m0 0l-4-4m4 4l4-4M12 3L8 7m4-4l4 4M3 12h18m0 0l-4-4m4 4l-4 4M3 12l4-4m-4 4l4 4"
            />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium text-warm-800 dark:text-warm-200">
            Streak Freeze
          </p>
          <p className="text-xs text-warm-400 dark:text-warm-500">
            {streak.freezeActive
              ? "Active — your streak is protected today"
              : `${streak.freezesAvailable} freeze${streak.freezesAvailable !== 1 ? "s" : ""} available`}
          </p>
        </div>

        {!streak.freezeActive && streak.freezesAvailable > 0 && (
          <motion.button
            onClick={handleActivate}
            disabled={activating}
            className="btn-secondary text-xs"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {activating ? "Activating..." : "Activate"}
          </motion.button>
        )}

        {streak.freezeActive && (
          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            Active
          </span>
        )}
      </div>
    </div>
  );
}
