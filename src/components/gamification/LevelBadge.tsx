import type { Level } from "@/types/gamification";

interface LevelBadgeProps {
  level: Level;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LevelBadge({
  level,
  size = "md",
  className = "",
}: LevelBadgeProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };

  const titleSize = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 font-bold text-white shadow-sm ${sizeClasses[size]}`}
      >
        {level.current}
      </div>
      <div>
        <p className={`font-semibold text-warm-800 dark:text-warm-200 ${titleSize[size]}`}>
          {level.title}
        </p>
        <p className="text-[10px] text-warm-400 dark:text-warm-500">
          Level {level.current}
        </p>
      </div>
    </div>
  );
}
