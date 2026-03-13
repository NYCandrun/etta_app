import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QuizShell } from "@/components/quiz/QuizShell";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { useSession } from "@/hooks/useSession";
import { useGamification } from "@/hooks/useGamification";
import * as ipc from "@/lib/ipc";
import type { QuizSession, StruggleAlert, MistakeDetail } from "@/types/quiz";

export default function Quiz() {
  const navigate = useNavigate();
  const {
    currentConcept,
    quizSession,
    loadQuiz,
    setQuizSession,
    setLessonContent,
    sessionConcepts,
    selectConcept,
    reinforcementConceptId,
    reinforcementAttempt,
    reinforcementMistakes,
    enterReinforcement,
    incrementReinforcementAttempt,
    exitReinforcement,
    insertConceptsAfterCurrent,
  } = useSession();
  const { refresh: refreshGamification } = useGamification();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchQuiz = useCallback(async () => {
    if (!currentConcept) return;
    setLoading(true);
    setLoadError(null);
    try {
      // During reinforcement, pass the student's mistakes so the quiz targets them
      let mistakesContext: string | undefined;
      if (reinforcementConceptId && reinforcementMistakes.length > 0) {
        mistakesContext = reinforcementMistakes
          .map(
            (m, i) =>
              `Mistake ${i + 1}:\n  Question: ${m.questionPrompt}\n  Student answered: ${m.userAnswer}\n  Correct answer: ${m.correctAnswer}\n  Why wrong: ${m.explanation}`
          )
          .join("\n\n");
      }
      const quiz = await loadQuiz(currentConcept.id, mistakesContext);
      if (!quiz || quiz.questions.length === 0) {
        setLoadError("No quiz questions were generated.");
      }
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, [currentConcept, loadQuiz, reinforcementConceptId, reinforcementMistakes]);

  useEffect(() => {
    if (currentConcept && !quizSession) {
      void fetchQuiz();
    }
  }, [currentConcept, quizSession, fetchQuiz]);

  // Pre-generate the next concept's lesson in the background while the user
  // takes this quiz. Only for normal progression — skip during reinforcement.
  useEffect(() => {
    if (!currentConcept || !quizSession || reinforcementConceptId) return;
    const idx = sessionConcepts.findIndex((c) => c.id === currentConcept.id);
    const nextConcept = idx >= 0 ? sessionConcepts[idx + 1] : undefined;
    if (nextConcept) {
      void ipc.prefetchLesson(nextConcept.id);
    }
  }, [currentConcept, quizSession, reinforcementConceptId, sessionConcepts]);

  // Detect empty quiz that was "loaded" but has no questions
  const quizIsEmpty = quizSession !== null && quizSession.questions.length === 0;

  const [quizFinished, setQuizFinished] = useState(false);

  const advanceToNextConcept = useCallback(() => {
    if (!currentConcept) {
      navigate("/");
      return;
    }

    // If we're in a reinforcement loop and just finished a prerequisite review,
    // route back to the reinforcement concept's lesson (not the next in queue).
    if (reinforcementConceptId && currentConcept.id !== reinforcementConceptId) {
      const reinforcementConcept = sessionConcepts.find(
        (c) => c.id === reinforcementConceptId
      );
      if (reinforcementConcept) {
        selectConcept(reinforcementConcept);
        navigate("/lesson");
        return;
      }
    }

    // If we just completed the reinforcement concept's re-quiz successfully,
    // exit reinforcement and continue normally.
    if (reinforcementConceptId && currentConcept.id === reinforcementConceptId) {
      exitReinforcement();
    }

    const idx = sessionConcepts.findIndex((c) => c.id === currentConcept.id);
    const next = idx >= 0 ? sessionConcepts[idx + 1] : undefined;
    if (next) {
      selectConcept(next);
      navigate("/lesson");
    } else {
      navigate("/");
    }
  }, [currentConcept, sessionConcepts, selectConcept, navigate, reinforcementConceptId, exitReinforcement]);

  const handleReinforce = useCallback(
    async (struggleAlert: StruggleAlert | null, mistakes: MistakeDetail[] = []) => {
      if (!currentConcept) return;

      // Enter reinforcement mode for this concept, passing specific mistakes
      if (!reinforcementConceptId) {
        enterReinforcement(currentConcept.id, mistakes);
      } else {
        incrementReinforcementAttempt();
      }

      // Find weak prerequisites to revisit.
      // Use the backend struggle alert if available, otherwise check ourselves
      // against the curriculum (any prerequisite with mastery < 0.8).
      try {
        let prereqIds = struggleAlert?.revisitPrerequisites ?? [];
        const hasPrereqs = currentConcept.prerequisites.length > 0;

        if ((prereqIds.length > 0 || hasPrereqs)) {
          const curriculum = await ipc.getCurriculumState();
          if (curriculum) {
            // If backend didn't flag specific prereqs, check them ourselves
            if (prereqIds.length === 0 && hasPrereqs) {
              prereqIds = currentConcept.prerequisites.filter((pid) => {
                const prereq = curriculum.concepts.find((c) => c.id === pid);
                return prereq && prereq.masteryScore < 0.8;
              });
            }

            if (prereqIds.length > 0) {
              const prereqConcepts = prereqIds
                .map((id) => curriculum.concepts.find((c) => c.id === id))
                .filter((c): c is NonNullable<typeof c> => c != null);
              const firstPrereq = prereqConcepts[0];
              if (firstPrereq) {
                insertConceptsAfterCurrent(prereqConcepts);
                selectConcept(firstPrereq);
                navigate("/lesson");
                return;
              }
            }
          }
        }
      } catch {
        // If curriculum fetch fails, just re-do current concept
      }

      // No prerequisites to review — go straight to adapted lesson for current concept
      await ipc.invalidateQuizCache(currentConcept.id);
      setQuizSession(null);
      setLessonContent(null);
      navigate("/lesson");
    },
    [currentConcept, reinforcementConceptId, enterReinforcement, incrementReinforcementAttempt, insertConceptsAfterCurrent, selectConcept, setQuizSession, setLessonContent, navigate]
  );

  const handleComplete = async (completedSession: QuizSession) => {
    setQuizSession(completedSession);
    await refreshGamification();
    // If reinforcement cap was reached, exit reinforcement mode on any completion
    if (reinforcementConceptId && reinforcementAttempt >= 2) {
      exitReinforcement();
    }
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
          onReinforce={reinforcementAttempt < 2 ? (alert, mistakes) => void handleReinforce(alert, mistakes) : undefined}
          onRetry={() => {
            setQuizSession(null);
            setQuizFinished(false);
            // Invalidate cached quiz so the backend generates fresh questions
            const doRetry = async () => {
              if (currentConcept) {
                await ipc.invalidateQuizCache(currentConcept.id);
              }
              await fetchQuiz();
            };
            void doRetry();
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
