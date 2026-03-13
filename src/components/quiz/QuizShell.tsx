import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuizSession, Answer, Feedback, StruggleAlert } from "@/types/quiz";
import { MultipleChoice } from "@/components/quiz/MultipleChoice";
import { FreeResponse } from "@/components/quiz/FreeResponse";
import { FillInBlank } from "@/components/quiz/FillInBlank";
import { QuizFeedback } from "@/components/quiz/QuizFeedback";
import { QuizTimer } from "@/components/quiz/QuizTimer";
import { formatXP } from "@/lib/format";
import { classifyError } from "@/hooks/useInvoke";
import { RichText } from "@/components/lesson/LessonContent";
import * as ipc from "@/lib/ipc";

interface QuizShellProps {
  session: QuizSession;
  /** Whether to show a timer */
  timed?: boolean;
  /** Seconds per question if timed */
  secondsPerQuestion?: number;
  onComplete: (session: QuizSession) => void;
  /** Called when the user wants to retry the quiz after a low score */
  onRetry?: () => void;
  /** Called when the user wants to review the lesson after a low score */
  onReviewLesson?: () => void;
  /** Called when the user should enter a reinforcement loop (adapted lesson + fresh quiz) */
  onReinforce?: (struggleAlert: StruggleAlert | null) => void;
  className?: string;
}

export function QuizShell({
  session: initialSession,
  timed = false,
  secondsPerQuestion = 60,
  onComplete,
  onRetry,
  onReviewLesson,
  onReinforce,
  className = "",
}: QuizShellProps) {
  const [session, setSession] = useState(initialSession);
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [hasFileUpload, setHasFileUpload] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState("");
  const [lastStruggleAlert, setLastStruggleAlert] = useState<StruggleAlert | null>(null);

  const currentQuestion = session.questions[session.currentIndex];
  const isLastQuestion =
    session.currentIndex >= session.questions.length - 1;
  const isComplete = session.completedAt !== null;

  const handleSubmitAnswer = useCallback(
    async (answer: Answer) => {
      setSubmitted(true);
      // Build question context for backend grading
      const q = session.questions[session.currentIndex];
      if (!q) {
        // Guard: question must exist — skip submission to avoid meaningless grade
        console.warn("[QuizShell] No question at index", session.currentIndex);
        const fallback: Feedback = {
          questionId: answer.questionId,
          isCorrect: false,
          score: 0,
          explanation: "Question data is missing. Please retry the quiz.",
          encouragement: "This looks like a bug — try loading the quiz again.",
        };
        setCurrentFeedback(fallback);
        setSession((prev) => ({
          ...prev,
          answers: [...prev.answers, answer],
          feedbacks: [...prev.feedbacks, fallback],
        }));
        return;
      }
      const questionCtx: ipc.QuestionContext = {
        conceptId: session.conceptId,
        questionType: q.type,
        prompt: q.prompt,
        correctOptionId: q.options?.find((o: { isCorrect?: boolean; id?: string }) => o.isCorrect)?.id,
        expectedBlanks: q.blanks,
        rubric: q.rubric,
        explanation: q.explanation,
      };
      try {
        const feedback = await ipc.submitAnswer(session.id, answer, questionCtx);
        setCurrentFeedback(feedback);
        if (feedback.struggleAlert?.isStruggling) {
          setLastStruggleAlert(feedback.struggleAlert);
        }
        setSession((prev) => ({
          ...prev,
          answers: [...prev.answers, answer],
          feedbacks: [...prev.feedbacks, feedback],
        }));
      } catch (err) {
        // Distinguish network vs app errors for clearer messaging
        const errorType = classifyError(err);
        const fallback: Feedback = {
          questionId: answer.questionId,
          isCorrect: false,
          score: 0,
          explanation: errorType === "network"
            ? "You appear to be offline. We'll check this answer when you're back online."
            : "Something went wrong evaluating your answer. Please try again.",
          encouragement: session.currentIndex === 0
            ? "Don't worry — let's keep going!"
            : session.feedbacks.filter((f) => f.isCorrect).length > 0
              ? "You've been doing well — keep it up!"
              : "Every attempt helps you learn. Keep going!",
        };
        setCurrentFeedback(fallback);
        setSession((prev) => ({
          ...prev,
          answers: [...prev.answers, answer],
          feedbacks: [...prev.feedbacks, fallback],
        }));
      }
    },
    [session.id, session.conceptId, session.currentIndex, session.questions]
  );

  const handleMultipleChoiceSubmit = useCallback(
    (optionId: string) => {
      if (!currentQuestion) return;
      const selected = currentQuestion.options?.find((o) => o.id === optionId);
      setLastUserAnswer(selected?.text ?? optionId);
      setHasFileUpload(false);
      const answer: Answer = {
        questionId: currentQuestion.id,
        selectedOptionId: optionId,
        timeSpentMs: Date.now() - questionStartTime,
      };
      void handleSubmitAnswer(answer);
    },
    [currentQuestion, questionStartTime, handleSubmitAnswer]
  );

  const handleFreeResponseSubmit = useCallback(
    (text: string, files?: File[]) => {
      if (!currentQuestion) return;
      setLastUserAnswer(text);
      setHasFileUpload(!!files && files.length > 0);
      const answer: Answer = {
        questionId: currentQuestion.id,
        freeText: text,
        timeSpentMs: Date.now() - questionStartTime,
      };
      void handleSubmitAnswer(answer);
    },
    [currentQuestion, questionStartTime, handleSubmitAnswer]
  );

  const handleFillInBlankSubmit = useCallback(
    (blanks: string[]) => {
      if (!currentQuestion) return;
      setLastUserAnswer(blanks.join(", "));
      setHasFileUpload(false);
      const answer: Answer = {
        questionId: currentQuestion.id,
        filledBlanks: blanks,
        timeSpentMs: Date.now() - questionStartTime,
      };
      void handleSubmitAnswer(answer);
    },
    [currentQuestion, questionStartTime, handleSubmitAnswer]
  );

  const handleContinue = useCallback(async () => {
    if (isLastQuestion) {
      const totalScore =
        session.feedbacks.reduce((s, f) => s + f.score, 0) /
        Math.max(1, session.feedbacks.length);
      // Send scores to backend and get actual XP earned (awarded per-answer)
      let xpEarned = 0;
      try {
        const result = await ipc.completeQuiz(session.id, session.feedbacks.map((f) => f.score));
        xpEarned = result.xpEarned;
      } catch {
        // If completion call fails, still let the user proceed
        console.warn("[QuizShell] completeQuiz failed, proceeding with 0 XP");
      }
      const completed: QuizSession = {
        ...session,
        completedAt: new Date().toISOString(),
        totalScore,
        xpEarned,
      };
      setSession(completed);
      onComplete(completed);
    } else {
      setSession((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
      }));
      setCurrentFeedback(null);
      setSubmitted(false);
      setQuestionStartTime(Date.now());
      setHasFileUpload(false);
      setLastUserAnswer("");
    }
  }, [isLastQuestion, session, onComplete]);

  // Completion summary
  if (isComplete) {
    const score = Math.round(session.totalScore * 100);
    const correct = session.feedbacks.filter((f) => f.isCorrect).length;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`mx-auto max-w-2xl space-y-4 ${className}`}
      >
        {/* Summary card */}
        <div className="card text-center">
          <div className="mb-4">
            {score >= 80 ? (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900">
                <svg
                  className="h-8 w-8 text-success-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900">
                <svg
                  className="h-8 w-8 text-accent-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            )}
          </div>

          <h2 className="mb-1 text-2xl font-bold text-warm-900 dark:text-warm-100">
            {score >= 80 ? "Great work!" : "Keep practicing!"}
          </h2>
          <p className="mb-4 text-warm-500 dark:text-warm-400">
            You got {correct} out of {session.questions.length} correct
          </p>

          <div className="mb-6 flex items-center justify-center gap-6">
            <div>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {score}%
              </p>
              <p className="text-xs text-warm-400">Score</p>
            </div>
            <div className="h-10 w-px bg-warm-200 dark:bg-warm-700" />
            <div>
              <p className="text-3xl font-bold text-accent-600 dark:text-accent-400">
                +{formatXP(session.xpEarned)}
              </p>
              <p className="text-xs text-warm-400">XP earned</p>
            </div>
          </div>
        </div>

        {/* Per-question review */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warm-500 dark:text-warm-400">
            Question Review
          </h3>
          <div className="space-y-3">
            {session.questions.map((q, i) => {
              const fb = session.feedbacks[i];
              const answer = session.answers[i];
              const userAnswerText = answer?.selectedOptionId
                ? q.options?.find((o) => o.id === answer.selectedOptionId)?.text ?? answer.selectedOptionId
                : answer?.freeText
                  ? answer.freeText
                  : answer?.filledBlanks
                    ? answer.filledBlanks.join(", ")
                    : "No answer";

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-3 ${
                    fb?.isCorrect
                      ? "border-success-200 bg-success-50/50 dark:border-success-800 dark:bg-success-950/20"
                      : "border-accent-200 bg-accent-50/50 dark:border-accent-800 dark:bg-accent-950/20"
                  }`}
                >
                  <div className="mb-1 flex items-start gap-2">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      fb?.isCorrect ? "bg-success-500" : "bg-accent-500"
                    }`}>
                      {fb?.isCorrect ? "\u2713" : "\u2717"}
                    </span>
                    <div className="text-sm font-medium text-warm-900 dark:text-warm-100">
                      <RichText text={q.prompt} />
                    </div>
                  </div>
                  <div className="ml-7 space-y-1">
                    <p className="text-xs text-warm-500 dark:text-warm-400">
                      <span className="font-medium">Your answer:</span> {userAnswerText}
                    </p>
                    {!fb?.isCorrect && fb?.explanation && (
                      <div className="text-xs text-warm-500 dark:text-warm-400">
                        <RichText text={fb.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {score >= 80 ? (
          <button onClick={() => onComplete(session)} className="btn-primary w-full">
            Done
          </button>
        ) : onReinforce ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-warm-500 dark:text-warm-400">
              Let's review this topic with a fresh perspective
            </p>
            <button
              onClick={() => onReinforce(lastStruggleAlert)}
              className="btn-primary w-full"
            >
              Continue
            </button>
            <button
              onClick={() => onComplete(session)}
              className="mx-auto block text-xs text-warm-400 hover:text-warm-600 dark:text-warm-500 dark:hover:text-warm-300"
            >
              Skip
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {onRetry && (
              <button onClick={onRetry} className="btn-primary flex-1">
                Retry Quiz
              </button>
            )}
            {onReviewLesson && (
              <button onClick={onReviewLesson} className="btn-secondary flex-1">
                Review Lesson
              </button>
            )}
            <button
              onClick={() => onComplete(session)}
              className="btn-secondary flex-1"
            >
              Continue Anyway
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className={`max-w-3xl space-y-6 ${className}`}>
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-warm-400 dark:text-warm-500">
            <span>
              Question {session.currentIndex + 1} of{" "}
              {session.questions.length}
            </span>
            {timed && (
              <QuizTimer
                totalSeconds={secondsPerQuestion}
                running={!submitted}
                onTimeUp={() => {
                  if (!submitted) {
                    // Auto-submit empty on time up
                    const answer: Answer = {
                      questionId: currentQuestion.id,
                      timeSpentMs: secondsPerQuestion * 1000,
                    };
                    void handleSubmitAnswer(answer);
                  }
                }}
              />
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
            <motion.div
              className="h-full rounded-full bg-primary-500"
              animate={{
                width: `${((session.currentIndex + (submitted ? 1 : 0)) / session.questions.length) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Question content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {currentQuestion.type === "multiple_choice" && (
            <MultipleChoice
              question={currentQuestion}
              onSubmit={handleMultipleChoiceSubmit}
              submitted={submitted}
              correctOptionId={
                submitted
                  ? currentQuestion.options?.find((o) => o.isCorrect)?.id
                  : undefined
              }
            />
          )}

          {currentQuestion.type === "free_response" && (
            <FreeResponse
              question={currentQuestion}
              onSubmit={handleFreeResponseSubmit}
              submitted={submitted}
            />
          )}

          {currentQuestion.type === "fill_in_blank" && (
            <FillInBlank
              question={currentQuestion}
              onSubmit={handleFillInBlankSubmit}
              submitted={submitted}
              correctAnswers={submitted ? currentQuestion.blanks : undefined}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Feedback */}
      <AnimatePresence>
        {currentFeedback && (
          <QuizFeedback
            feedback={currentFeedback}
            onContinue={handleContinue}
            questionPrompt={currentQuestion?.prompt}
            userAnswer={lastUserAnswer}
            hasFileUpload={hasFileUpload}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
