import { motion } from "framer-motion";
import type { Feedback } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";

interface QuizFeedbackProps {
  feedback: Feedback;
  onContinue: () => void;
  className?: string;
}

export function QuizFeedback({
  feedback,
  onContinue,
  className = "",
}: QuizFeedbackProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-2xl border p-5 ${
        feedback.isCorrect
          ? "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-950/30"
          : "border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-950/30"
      } ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {feedback.isCorrect ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100 dark:bg-success-900"
          >
            <svg
              className="h-5 w-5 text-success-600 dark:text-success-400"
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
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900"
          >
            <svg
              className="h-5 w-5 text-accent-600 dark:text-accent-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </motion.div>
        )}

        <div>
          <p
            className={`font-semibold ${
              feedback.isCorrect
                ? "text-success-700 dark:text-success-300"
                : "text-accent-700 dark:text-accent-300"
            }`}
          >
            {feedback.encouragement}
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="mb-4 text-sm leading-relaxed text-warm-700 dark:text-warm-300">
        <RichText text={feedback.explanation} />
      </div>

      {/* Hint for next attempt */}
      {feedback.nextHint && (
        <div className="mb-4 rounded-xl bg-white/60 px-4 py-3 text-sm text-warm-600 dark:bg-warm-800/60 dark:text-warm-400">
          <span className="font-medium">Hint: </span>
          <RichText text={feedback.nextHint} />
        </div>
      )}

      <button onClick={onContinue} className="btn-primary">
        Continue
      </button>
    </motion.div>
  );
}
