import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QuizShell } from "@/components/quiz/QuizShell";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { useSession } from "@/hooks/useSession";
import { useGamification } from "@/hooks/useGamification";
import type { QuizSession } from "@/types/quiz";

export default function Quiz() {
  const navigate = useNavigate();
  const {
    currentConcept,
    quizSession,
    loadQuiz,
    setQuizSession,
    sessionConcepts,
    selectConcept,
  } = useSession();
  const { refresh: refreshGamification } = useGamification();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchQuiz = useCallback(async () => {
    if (!currentConcept) return;
    setLoading(true);
    setLoadError(null);
    try {
      const quiz = await loadQuiz(currentConcept.id);
      if (!quiz || quiz.questions.length === 0) {
        setLoadError("No quiz questions were generated.");
      }
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, [currentConcept, loadQuiz]);

  useEffect(() => {
    if (currentConcept && !quizSession) {
      void fetchQuiz();
    }
  }, [currentConcept, quizSession, fetchQuiz]);

  // Detect empty quiz that was "loaded" but has no questions
  const quizIsEmpty = quizSession !== null && quizSession.questions.length === 0;

  const [quizFinished, setQuizFinished] = useState(false);

  const advanceToNextConcept = useCallback(() => {
    if (!currentConcept) {
      navigate("/");
      return;
    }
    const idx = sessionConcepts.findIndex((c) => c.id === currentConcept.id);
    const next = idx >= 0 ? sessionConcepts[idx + 1] : undefined;
    if (next) {
      // Move to the next concept's lesson
      selectConcept(next);
      navigate("/lesson");
    } else {
      // No more concepts — return to dashboard
      navigate("/");
    }
  }, [currentConcept, sessionConcepts, selectConcept, navigate]);

  const handleComplete = async (completedSession: QuizSession) => {
    setQuizSession(completedSession);
    // XP is awarded per-answer on the backend. Refresh gamification state
    // to reflect the updated total — no frontend lump-sum award needed.
    await refreshGamification();
    // If the quiz was already marked complete and the user clicks "Done",
    // advance to the next concept in the session.
    if (quizFinished) {
      advanceToNextConcept();
      return;
    }
    setQuizFinished(true);
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
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-warm-700 dark:text-warm-300">
          No quiz available
        </h2>
        <p className="mb-4 text-warm-400 dark:text-warm-500">
          Complete a lesson first, then come back to test your knowledge.
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
          Quiz — {currentConcept.domain.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-warm-900 dark:text-warm-100">
          {currentConcept.name}
        </h1>
      </div>

      {/* Quiz content */}
      {loading ? (
        <div className="card">
          <SkeletonLoader lines={6} />
        </div>
      ) : (loadError || quizIsEmpty) ? (
        <div className="card py-12 text-center">
          <p className="text-warm-400 dark:text-warm-500">
            Unable to load quiz. Please try again.
          </p>
          {loadError && (
            <p className="mt-2 text-xs text-warm-400 dark:text-warm-600">
              {loadError}
            </p>
          )}
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => {
                setQuizSession(null);
                void fetchQuiz();
              }}
              className="btn-primary"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/lesson")}
              className="btn-secondary"
            >
              Back to Lesson
            </button>
          </div>
        </div>
      ) : quizSession ? (
        <QuizShell
          session={quizSession}
          onComplete={(s) => void handleComplete(s)}
          onRetry={() => {
            setQuizSession(null);
            setQuizFinished(false);
            void fetchQuiz();
          }}
          onReviewLesson={() => navigate("/lesson")}
        />
      ) : (
        <div className="card py-12 text-center">
          <p className="text-warm-400 dark:text-warm-500">
            Unable to load quiz. Please try again.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => void fetchQuiz()}
              className="btn-primary"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/lesson")}
              className="btn-secondary"
            >
              Back to Lesson
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
