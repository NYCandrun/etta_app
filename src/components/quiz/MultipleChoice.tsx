import { useState } from "react";
import { motion } from "framer-motion";
import type { Question, MultipleChoiceOption } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";

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

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={() => {
            if (selectedId) onSubmit(selectedId);
          }}
          disabled={!selectedId}
          className="btn-primary mt-4"
        >
          Check Answer
        </button>
      )}
    </div>
  );
}
