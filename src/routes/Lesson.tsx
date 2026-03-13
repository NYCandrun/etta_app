import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LessonContent } from "@/components/lesson/LessonContent";
import { ExplainButton } from "@/components/lesson/ExplainButton";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { RichText } from "@/components/lesson/LessonContent";
import { useSession } from "@/hooks/useSession";
import * as ipc from "@/lib/ipc";
import type { ExplanationResponse } from "@/types/lesson";

export default function Lesson() {
  const navigate = useNavigate();
  const {
    currentConcept,
    lessonContent,
    loadLesson,
    loadQuiz,
    quizSession,
    explanationAttempt,
    incrementExplanationAttempt,
    reinforcementConceptId,
  } = useSession();

  const isReinforcing = reinforcementConceptId !== null;
  const isPrereqReview =
    isReinforcing && currentConcept?.id !== reinforcementConceptId;

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [extraExplanation, setExtraExplanation] =
    useState<ExplanationResponse | null>(null);

  // Load lesson when concept changes
  useEffect(() => {
    if (currentConcept && !lessonContent) {
      setLoading(true);
      setLoadError(null);
      loadLesson(currentConcept.id)
        .catch((err) => {
          setLoadError(String(err));
        })
        .finally(() => setLoading(false));
    }
  }, [currentConcept, lessonContent, loadLesson]);

  const handleRetryLesson = () => {
    if (!currentConcept) return;
    setLoading(true);
    setLoadError(null);
    loadLesson(currentConcept.id)
      .catch((err) => {
        setLoadError(String(err));
      })
      .finally(() => setLoading(false));
  };

  // Pre-fetch quiz in the background once the lesson is loaded
  useEffect(() => {
    if (currentConcept && lessonContent && !quizSession) {
      loadQuiz(currentConcept.id).catch(() => { /* prefetch — errors handled when quiz page loads */ });
    }
  }, [currentConcept, lessonContent, quizSession, loadQuiz]);

  const handleExplainRequest = async () => {
    if (!currentConcept || !lessonContent) return;
    setExplanationLoading(true);
    incrementExplanationAttempt();
    try {
      const response = await ipc.requestExplanation(
        currentConcept.id,
        lessonContent.id,
        explanationAttempt + 1
      );
      setExtraExplanation(response);
    } catch {
      setExtraExplanation({
        content:
          "I'm having trouble generating a new explanation right now. Try re-reading the material above, or come back later when you're online.",
        strategy: "default",
        nextStrategy: null,
      });
    } finally {
      setExplanationLoading(false);
    }
  };

  const handleReadyForQuiz = () => {
    if (currentConcept) {
      navigate("/quiz");
    }
  };

  if (!currentConcept) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20"
      >
        <svg
          className="mb-4 h-16 w-16 text-warm-300 dark:text-warm-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-warm-700 dark:text-warm-300">
          No concept selected
        </h2>
        <p className="mb-4 text-warm-400 dark:text-warm-500">
          Head to the Dashboard to pick a concept or start a session.
        </p>
        <button onClick={() => navigate("/")} className="btn-primary">
          Go to Dashboard
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary-500">
          {currentConcept.domain.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-warm-900 dark:text-warm-100">
          {currentConcept.name}
        </h1>
      </div>

      {/* Reinforcement banner */}
      {isReinforcing && (
        <div className="rounded-xl border border-accent-200 bg-accent-50/50 px-4 py-3 dark:border-accent-800 dark:bg-accent-950/20">
          <p className="text-sm font-medium text-accent-700 dark:text-accent-300">
            {isPrereqReview
              ? "Strengthening a prerequisite before moving forward"
              : "Reviewing this topic with a fresh perspective"}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card">
          <SkeletonLoader lines={8} />
        </div>
      ) : lessonContent ? (
        <>
          <LessonContent lesson={lessonContent} />

          {/* Extra explanation */}
          {extraExplanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card border-l-4 border-primary-400"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
                Another way to think about it
              </p>
              <div className="text-sm leading-relaxed text-warm-700 dark:text-warm-300">
                <RichText text={extraExplanation.content} />
              </div>
            </motion.div>
          )}

          {/* Bottom actions */}
          <div className="flex items-center justify-between border-t border-warm-200 pt-6 dark:border-warm-800">
            <ExplainButton
              attempt={explanationAttempt}
              loading={explanationLoading}
              onRequest={() => void handleExplainRequest()}
            />
            <button
              onClick={handleReadyForQuiz}
              className="btn-primary"
            >
              {isReinforcing ? "Continue" : "I'm ready for the quiz"}
            </button>
          </div>
        </>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-warm-400 dark:text-warm-500">
            Unable to load lesson content.
          </p>
          {loadError && (
            <p className="mt-2 text-xs text-warm-400 dark:text-warm-600">
              {loadError}
            </p>
          )}
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={handleRetryLesson} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate("/")} className="btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
