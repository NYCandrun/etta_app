import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuizSession, Answer, Feedback } from "@/types/quiz";
import { MultipleChoice } from "@/components/quiz/MultipleChoice";
import { FreeResponse } from "@/components/quiz/FreeResponse";
import { FillInBlank } from "@/components/quiz/FillInBlank";
import { QuizFeedback } from "@/components/quiz/QuizFeedback";
import { QuizTimer } from "@/components/quiz/QuizTimer";
import { formatXP } from "@/lib/format";
import * as ipc from "@/lib/ipc";

interface QuizShellProps {
  session: QuizSession;
  /** Whether to show a timer */
  timed?: boolean;
  /** Seconds per question if timed */
  secondsPerQuestion?: number;
  onComplete: (session: QuizSession) => void;
  className?: string;
}

export function QuizShell({
  session: initialSession,
  timed = false,
  secondsPerQuestion = 60,
  onComplete,
  className = "",
}: QuizShellProps) {
  const [session, setSession] = useState(initialSession);
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [hasFileUpload, setHasFileUpload] = useState(false);
  const [lastUserAnswer, setLastUserAnswer] = useState("");

  const currentQuestion = session.questions[session.currentIndex];
  const isLastQuestion =
    session.currentIndex >= session.questions.length - 1;
  const isComplete = session.completedAt !== null;

  const handleSubmitAnswer = useCallback(
    async (answer: Answer) => {
      setSubmitted(true);
      // Build question context for backend grading
      const q = session.questions[session.currentIndex];
      const questionCtx: ipc.QuestionContext = q
        ? {
            conceptId: session.conceptId,
            questionType: q.type,
            prompt: q.prompt,
            correctOptionId: q.options?.find((o: { isCorrect?: boolean; id?: string }) => o.isCorrect)?.id,
            expectedBlanks: q.blanks,
            rubric: q.rubric,
            explanation: q.explanation,
          }
        : { conceptId: session.conceptId, questionType: "multiple_choice", prompt: "" };
      try {
        const feedback = await ipc.submitAnswer(session.id, answer, questionCtx);
        setCurrentFeedback(feedback);
        setSession((prev) => ({
          ...prev,
          answers: [...prev.answers, answer],
          feedbacks: [...prev.feedbacks, feedback],
        }));
      } catch {
        // Offline fallback: generate local feedback
        const fallback: Feedback = {
          questionId: answer.questionId,
          isCorrect: false,
          score: 0,
          explanation: "Unable to evaluate right now. We'll check this when you're back online.",
          encouragement: "Keep going!",
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

  const handleContinue = useCallback(() => {
    if (isLastQuestion) {
      const totalScore =
        session.feedbacks.reduce((s, f) => s + f.score, 0) /
        Math.max(1, session.feedbacks.length);
      const completed: QuizSession = {
        ...session,
        completedAt: new Date().toISOString(),
        totalScore,
      };
      setSession(completed);
      // Send scores to backend for XP calculation
      void ipc.completeQuiz(session.id, session.feedbacks.map((f) => f.score));
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
        className={`card mx-auto max-w-2xl text-center ${className}`}
      >
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

        <button onClick={() => onComplete(session)} className="btn-primary w-full">
          Done
        </button>
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
