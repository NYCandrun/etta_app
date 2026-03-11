import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkedExample as WorkedExampleType } from "@/types/lesson";
import { RichText } from "@/components/lesson/LessonContent";

interface WorkedExampleProps {
  example: WorkedExampleType;
}

export function WorkedExample({ example }: WorkedExampleProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState(0);

  const handleToggle = () => {
    if (!expanded) {
      setExpanded(true);
      setRevealedSteps(1);
    } else {
      setExpanded(false);
      setRevealedSteps(0);
    }
  };

  const revealNext = () => {
    setRevealedSteps((prev) => Math.min(prev + 1, example.steps.length));
  };

  const allRevealed = revealedSteps >= example.steps.length;

  return (
    <div className="rounded-2xl border border-warm-200 bg-warm-50 dark:border-warm-700 dark:bg-warm-850">
      {/* Header toggle */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className="font-medium text-warm-800 dark:text-warm-200">
          {example.title}
        </span>
        <motion.svg
          className="h-5 w-5 text-warm-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </motion.svg>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-warm-200 px-5 py-4 dark:border-warm-700">
              {example.steps.slice(0, revealedSteps).map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="flex gap-3"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="mb-1 text-xs font-medium text-warm-500 dark:text-warm-400">
                      {step.label}
                    </p>
                    <div className="text-sm leading-relaxed text-warm-700 dark:text-warm-300">
                      <RichText text={step.content} />
                    </div>
                  </div>
                </motion.div>
              ))}

              {!allRevealed && (
                <button
                  onClick={revealNext}
                  className="btn-secondary mt-2 text-sm"
                >
                  Show next step
                </button>
              )}

              {allRevealed && (
                <p className="mt-2 text-center text-xs text-success-600 dark:text-success-400">
                  All steps revealed
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
