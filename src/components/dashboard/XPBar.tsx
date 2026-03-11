import { motion } from "framer-motion";
import type { Level } from "@/types/gamification";
import { formatXP } from "@/lib/format";

interface XPBarProps {
  xp: number;
  level: Level;
  className?: string;
}

export function XPBar({ xp, level, className = "" }: XPBarProps) {
  const progressPercent = Math.min(100, level.progress * 100);

  return (
    <div className={`card ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            {level.current}
          </span>
          <span className="text-sm font-semibold text-warm-900 dark:text-warm-100">
            {level.title}
          </span>
        </div>
        <span className="text-xs text-warm-400 dark:text-warm-500">
          {formatXP(xp)} / {formatXP(level.xpForNext)} XP
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="mt-1.5 text-xs text-warm-400 dark:text-warm-500">
        {formatXP(level.xpForNext - xp)} XP to Level {level.current + 1}
      </p>
    </div>
  );
}
