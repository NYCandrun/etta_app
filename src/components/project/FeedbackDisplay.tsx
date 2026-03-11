import { motion } from "framer-motion";
import type { FeedbackResult } from "@/types/submission";
import { RichText } from "@/components/lesson/LessonContent";
import { formatXP } from "@/lib/format";

interface FeedbackDisplayProps {
  feedback: FeedbackResult;
  className?: string;
}

export function FeedbackDisplay({
  feedback,
  className = "",
}: FeedbackDisplayProps) {
  const isPassing = feedback.verdict === "pass";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`card space-y-5 ${className}`}
    >
      {/* Verdict badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isPassing
                ? "bg-success-100 dark:bg-success-900"
                : "bg-accent-100 dark:bg-accent-900"
            }`}
          >
            {isPassing ? (
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
            ) : (
              <svg
                className="h-5 w-5 text-accent-600 dark:text-accent-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
            )}
          </div>
          <div>
            <p
              className={`font-semibold ${
                isPassing
                  ? "text-success-700 dark:text-success-300"
                  : "text-accent-700 dark:text-accent-300"
              }`}
            >
              {isPassing ? "Pass" : "Revise & Resubmit"}
            </p>
            <p className="text-xs text-warm-400 dark:text-warm-500">
              Score: {Math.round(feedback.overallScore * 100)}%
            </p>
          </div>
        </div>

        {feedback.xpEarned > 0 && (
          <span className="rounded-lg bg-accent-100 px-3 py-1 text-sm font-semibold text-accent-700 dark:bg-accent-900 dark:text-accent-300">
            +{formatXP(feedback.xpEarned)} XP
          </span>
        )}
      </div>

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <Section title="Strengths" icon="success">
          <ul className="space-y-1.5">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-warm-700 dark:text-warm-300">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Areas for improvement */}
      {feedback.areasForImprovement.length > 0 && (
        <Section title="Areas for Improvement" icon="improve">
          <ul className="space-y-1.5">
            {feedback.areasForImprovement.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-warm-700 dark:text-warm-300">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Next steps */}
      {feedback.nextSteps.length > 0 && (
        <Section title="Next Steps" icon="next">
          <ul className="space-y-1.5">
            {feedback.nextSteps.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-warm-700 dark:text-warm-300">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                </svg>
                {n}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Detailed comments */}
      {feedback.detailedComments && (
        <div className="rounded-xl bg-warm-50 p-4 text-sm leading-relaxed text-warm-700 dark:bg-warm-850 dark:text-warm-300">
          <RichText text={feedback.detailedComments} />
        </div>
      )}
    </motion.div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-warm-800 dark:text-warm-200">
        {title}
      </h4>
      {children}
    </div>
  );
}
