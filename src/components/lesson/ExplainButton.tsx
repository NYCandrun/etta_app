import { motion, AnimatePresence } from "framer-motion";

const LABELS = [
  "I don't get it",
  "Try another way",
  "Show me visually",
  "Walk me through it",
  "Let's review the basics",
];

interface ExplainButtonProps {
  /** Current explanation attempt number (0-indexed) */
  attempt: number;
  /** Whether the backend is currently generating an explanation */
  loading?: boolean;
  /** Called when the user clicks for a re-explanation */
  onRequest: () => void;
  className?: string;
}

export function ExplainButton({
  attempt,
  loading = false,
  onRequest,
  className = "",
}: ExplainButtonProps) {
  const label = LABELS[Math.min(attempt, LABELS.length - 1)] ?? LABELS[0];

  return (
    <motion.button
      onClick={onRequest}
      disabled={loading}
      className={`group inline-flex items-center gap-2 rounded-xl border border-warm-200 bg-white
        px-4 py-2.5 text-sm font-medium text-warm-600 shadow-soft
        hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700
        focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50
        dark:border-warm-700 dark:bg-warm-800 dark:text-warm-300
        dark:hover:border-primary-600 dark:hover:bg-primary-950 dark:hover:text-primary-300
        ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 transition-transform group-hover:rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
          />
        </svg>
      )}

      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {loading ? "Thinking..." : label}
        </motion.span>
      </AnimatePresence>

      {attempt > 0 && !loading && (
        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-warm-200 text-xs text-warm-500 dark:bg-warm-700 dark:text-warm-400">
          {attempt}
        </span>
      )}
    </motion.button>
  );
}
