import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Question, MultipleChoiceOption } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";
import * as ipc from "@/lib/ipc";

interface MultipleChoiceProps {
  question: Question;
  onSubmit: (optionId: string) => void;
  submitted: boolean;
  correctOptionId?: string;
  className?: string;
}

export function MultipleChoice({
  question,
  onSubmit,
  submitted,
  correctOptionId,
  className = "",
}: MultipleChoiceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noRightAnswerState, setNoRightAnswerState] = useState<
    "idle" | "checking" | "confirmed" | "denied"
  >("idle");

  const options = question.options ?? [];

  const getOptionStyle = (option: MultipleChoiceOption) => {
    if (!submitted) {
      if (option.id === selectedId) {
        return "border-primary-400 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-500 dark:bg-primary-950 dark:ring-primary-800";
      }
      return "border-warm-200 bg-white hover:border-warm-300 hover:bg-warm-50 dark:border-warm-700 dark:bg-warm-850 dark:hover:border-warm-600 dark:hover:bg-warm-800";
    }

    if (option.id === correctOptionId) {
      return "border-success-400 bg-success-50 dark:border-success-600 dark:bg-success-950/30";
    }
    if (option.id === selectedId && option.id !== correctOptionId) {
      return "border-danger-400 bg-danger-50 dark:border-danger-600 dark:bg-danger-950/30";
    }
    return "border-warm-200 bg-warm-50 opacity-50 dark:border-warm-700 dark:bg-warm-850";
  };

  const handleNoRightAnswers = async () => {
    setNoRightAnswerState("checking");

    try {
      const result = await ipc.verifyNoRightAnswer(
        question.prompt,
        options.map((o) => o.text)
      );

      if (result.confirmed) {
        setNoRightAnswerState("confirmed");
        // Auto-advance after a moment
        setTimeout(() => {
          onSubmit("__no_correct_answer__");
        }, 1500);
      } else {
        setNoRightAnswerState("denied");
        // Reset after showing the popup
        setTimeout(() => {
          setNoRightAnswerState("idle");
        }, 4000);
      }
    } catch {
      // Fallback: check locally if the question has a correct answer marked
      const hasCorrectAnswer = options.some((o) => o.isCorrect);
      if (!hasCorrectAnswer) {
        setNoRightAnswerState("confirmed");
        setTimeout(() => {
          onSubmit("__no_correct_answer__");
        }, 1500);
      } else {
        setNoRightAnswerState("denied");
        setTimeout(() => {
          setNoRightAnswerState("idle");
        }, 4000);
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Question prompt */}
      <div className="text-lg font-medium text-warm-900 dark:text-warm-100">
        <RichText text={question.prompt} />
      </div>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option, i) => (
          <motion.button
            key={option.id}
            onClick={() => {
              if (!submitted) setSelectedId(option.id);
            }}
            disabled={submitted}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all
              focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
              ${getOptionStyle(option)}`}
            whileHover={!submitted ? { scale: 1.01 } : {}}
            whileTap={!submitted ? { scale: 0.99 } : {}}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold
              ${
                selectedId === option.id && !submitted
                  ? "border-primary-500 bg-primary-500 text-white"
                  : submitted && option.id === correctOptionId
                    ? "border-success-500 bg-success-500 text-white"
                    : submitted && option.id === selectedId
                      ? "border-danger-500 bg-danger-500 text-white"
                      : "border-warm-300 text-warm-500 dark:border-warm-600 dark:text-warm-400"
              }`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-sm text-warm-700 dark:text-warm-300">
              <RichText text={option.text} />
            </span>

            {/* Check / X icons after submit */}
            {submitted && option.id === correctOptionId && (
              <svg
                className="h-5 w-5 shrink-0 text-success-500"
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
            )}
            {submitted &&
              option.id === selectedId &&
              option.id !== correctOptionId && (
                <svg
                  className="h-5 w-5 shrink-0 text-danger-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
          </motion.button>
        ))}
      </div>

      {/* Action buttons */}
      {!submitted && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedId) onSubmit(selectedId);
            }}
            disabled={!selectedId}
            className="btn-primary mt-4"
          >
            Check Answer
          </button>

          {/* "No right answers" button — MC only */}
          <button
            onClick={() => void handleNoRightAnswers()}
            disabled={noRightAnswerState === "checking"}
            className="mt-4 flex items-center gap-2 rounded-xl border border-warm-300 px-4 py-2.5 text-sm font-medium text-warm-600 transition-all hover:border-warm-400 hover:bg-warm-50 disabled:opacity-60 dark:border-warm-600 dark:text-warm-400 dark:hover:border-warm-500 dark:hover:bg-warm-800"
          >
            {noRightAnswerState === "checking" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-warm-300 border-t-primary-500" />
                Checking...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                There are no right answers
              </>
            )}
          </button>
        </div>
      )}

      {/* "No right answers" confirmation popup */}
      <AnimatePresence>
        {noRightAnswerState === "confirmed" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-800 dark:bg-success-950/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-100 dark:bg-success-900">
                <svg className="h-4 w-4 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-success-700 dark:text-success-300">
                Confirmed! The AI reasoning model agrees there is no correct answer. Moving on...
              </p>
            </div>
          </motion.div>
        )}
        {noRightAnswerState === "denied" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-800 dark:bg-accent-950/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900">
                <svg className="h-4 w-4 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-accent-700 dark:text-accent-300">
                I've checked with an AI reasoning model and it says there is a right answer. AIs can make mistakes, but please try your best!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
