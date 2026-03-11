import { motion } from "framer-motion";
import type { Badge } from "@/types/gamification";
import { formatShortDate } from "@/lib/format";

interface BadgeGalleryProps {
  badges: Badge[];
  className?: string;
}

export function BadgeGallery({ badges, className = "" }: BadgeGalleryProps) {
  const earned = badges.filter((b) => b.earned);
  const unearned = badges.filter((b) => !b.earned);

  return (
    <div className={`card ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-warm-500 dark:text-warm-400">
          Badges
        </h3>
        <span className="text-xs text-warm-400 dark:text-warm-500">
          {earned.length} / {badges.length} earned
        </span>
      </div>

      {badges.length === 0 ? (
        <p className="py-4 text-center text-sm text-warm-400 dark:text-warm-500">
          Badges you earn will appear here.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
          {earned.map((badge) => (
            <motion.div
              key={badge.id}
              className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-warm-50 dark:hover:bg-warm-850"
              whileHover={{ scale: 1.05 }}
              title={badge.description}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 to-accent-400 text-xl shadow-sm dark:from-accent-700 dark:to-accent-500">
                {getBadgeEmoji(badge.iconName)}
              </div>
              <span className="text-center text-xs font-medium text-warm-700 dark:text-warm-300">
                {badge.name}
              </span>
              {badge.earnedAt && (
                <span className="text-[10px] text-warm-400 dark:text-warm-500">
                  {formatShortDate(badge.earnedAt)}
                </span>
              )}
            </motion.div>
          ))}

          {unearned.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center gap-1.5 rounded-xl p-3 opacity-40"
              title={badge.requirement}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-200 text-xl dark:bg-warm-700">
                <svg
                  className="h-6 w-6 text-warm-400 dark:text-warm-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <span className="text-center text-xs font-medium text-warm-400 dark:text-warm-500">
                {badge.name}
              </span>
              <span className="text-center text-[10px] text-warm-300 dark:text-warm-600">
                {badge.requirement}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBadgeEmoji(iconName: string): string {
  const map: Record<string, string> = {
    star: "\u2B50",
    fire: "\uD83D\uDD25",
    trophy: "\uD83C\uDFC6",
    rocket: "\uD83D\uDE80",
    brain: "\uD83E\uDDE0",
    books: "\uD83D\uDCDA",
    lightning: "\u26A1",
    medal: "\uD83C\uDFC5",
    crown: "\uD83D\uDC51",
    gem: "\uD83D\uDC8E",
    microscope: "\uD83D\uDD2C",
    dna: "\uD83E\uDDEC",
    atom: "\u269B\uFE0F",
    target: "\uD83C\uDFAF",
    sparkle: "\u2728",
  };
  return map[iconName] ?? "\uD83C\uDFC5";
}
