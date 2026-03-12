import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Feedback } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";
import * as ipc from "@/lib/ipc";

interface QuizFeedbackProps {
  feedback: Feedback;
  onContinue: () => void;
  /** The original question prompt for context */
  questionPrompt?: string;
  /** The user's submitted answer text */
  userAnswer?: string;
  /** Whether the user uploaded a file for this answer */
  hasFileUpload?: boolean;
  className?: string;
}

export function QuizFeedback({
  feedback,
  onContinue,
  questionPrompt = "",
  userAnswer = "",
  hasFileUpload = false,
  className = "",
}: QuizFeedbackProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explainAttempts, setExplainAttempts] = useState(0);
  const [regradeLoading, setRegradeLoading] = useState(false);
  const [regradeResult, setRegradeResult] = useState<{
    isCorrect: boolean;
    score: number;
    explanation: string;
  } | null>(null);

  const handleExplainMistake = useCallback(async () => {
    setExplanationLoading(true);
    setShowExplanation(true);
    const nextAttempts = explainAttempts + 1;
    setExplainAttempts(nextAttempts);
    // Escalate to reasoning model after 2 "Explain a Different Way" clicks
    const escalate = nextAttempts >= 3;

    try {
      const text = await ipc.explainMistake(
        questionPrompt,
        userAnswer,
        feedback.explanation,
        `The student answered incorrectly. Attempt #${nextAttempts} at explaining.`,
        escalate
      );
      setExplanationText(text);
    } catch {
      setExplanationText(
        "Unable to generate an explanation right now. Please try again later."
      );
    } finally {
      setExplanationLoading(false);
    }
  }, [questionPrompt, userAnswer, feedback.explanation, explainAttempts]);

  const handleRegrade = useCallback(async () => {
    setRegradeLoading(true);
    try {
      const result = await ipc.regradeWithReasoning(
        questionPrompt,
        userAnswer,
        feedback.explanation
      );
      setRegradeResult(result);
    } catch {
      setRegradeResult({
        isCorrect: false,
        score: 0,
        explanation: "Unable to re-grade right now.",
      });
    } finally {
      setRegradeLoading(false);
    }
  }, [questionPrompt, userAnswer, feedback.explanation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`card border ${
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
            <svg className="h-5 w-5 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900"
          >
            <svg className="h-5 w-5 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </motion.div>
        )}

        <div>
          <p className={`font-semibold ${
            feedback.isCorrect
              ? "text-success-700 dark:text-success-300"
              : "text-accent-700 dark:text-accent-300"
          }`}>
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

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onContinue} className="btn-primary">
          Continue
        </button>

        {/* Explain My Mistake — only shown when wrong */}
        {!feedback.isCorrect && (
          <button
            onClick={() => void handleExplainMistake()}
            disabled={explanationLoading}
            title="Get an AI-generated explanation of why your answer was incorrect and how to approach this problem"
            className="flex items-center gap-1.5 rounded-xl border border-accent-200 bg-white px-3 py-2 text-sm font-medium text-accent-700 transition-all hover:bg-accent-50 disabled:opacity-60 dark:border-accent-700 dark:bg-warm-800 dark:text-accent-300 dark:hover:bg-accent-950"
          >
            {explanationLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            )}
            {explainAttempts === 0 ? "Explain my mistake" : "Explain a different way"}
          </button>
        )}

        {/* Re-grade with reasoning model — shown when file was uploaded */}
        {hasFileUpload && !feedback.isCorrect && (
          <button
            onClick={() => void handleRegrade()}
            disabled={regradeLoading || regradeResult !== null}
            title="Submit your uploaded work to a more advanced reasoning model for a second opinion on grading"
            className="flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm font-medium text-primary-700 transition-all hover:bg-primary-50 disabled:opacity-60 dark:border-primary-700 dark:bg-warm-800 dark:text-primary-300 dark:hover:bg-primary-950"
          >
            {regradeLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181 3.183" />
              </svg>
            )}
            Have a reasoning model re-grade
          </button>
        )}
      </div>

      {/* Explanation popup */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 rounded-xl border border-warm-200 bg-white p-4 dark:border-warm-700 dark:bg-warm-850"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-500">
                {explainAttempts >= 3 ? "Reasoning Model Explanation" : "AI Explanation"}
              </p>
              <button
                onClick={() => setShowExplanation(false)}
                className="rounded-lg p-1 text-warm-400 hover:text-warm-600 dark:hover:text-warm-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {explanationLoading ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                <span className="text-sm text-warm-500">
                  {explainAttempts >= 3
                    ? "Asking a reasoning model to think this through..."
                    : "Generating explanation..."}
                </span>
              </div>
            ) : (
              <div className="prose-warm text-sm leading-relaxed text-warm-700 dark:text-warm-300">
                <RichText text={explanationText} />
              </div>
            )}

            {!explanationLoading && (
              <div className="mt-3 border-t border-warm-200 pt-3 dark:border-warm-700">
                <button
                  onClick={() => void handleExplainMistake()}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Explain a different way
                  {explainAttempts >= 2 && (
                    <span className="ml-1 text-warm-400">(uses reasoning model)</span>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Re-grade result */}
      <AnimatePresence>
        {regradeResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 rounded-xl border p-4 ${
              regradeResult.isCorrect
                ? "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-950/30"
                : "border-warm-200 bg-warm-50 dark:border-warm-700 dark:bg-warm-850"
            }`}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-500">
              Reasoning Model Re-grade
            </p>
            <p className="mb-2 text-sm font-medium text-warm-900 dark:text-warm-100">
              Score: {Math.round(regradeResult.score * 100)}%
              {regradeResult.isCorrect && (
                <span className="ml-2 text-success-600 dark:text-success-400">— Answer accepted</span>
              )}
            </p>
            <div className="text-sm leading-relaxed text-warm-700 dark:text-warm-300">
              <RichText text={regradeResult.explanation} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
