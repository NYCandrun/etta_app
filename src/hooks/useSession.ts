import { useCallback } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import type { Concept } from "@/types/concept";
import type { QuizSession } from "@/types/quiz";
import type { LessonContent } from "@/types/lesson";
import * as ipc from "@/lib/ipc";

/**
 * Hook for managing the current learning session.
 */
export function useSession() {
  const store = useSessionStore();

  const startSession = useCallback(
    async (concepts?: Concept[]) => {
      try {
        const session = await ipc.getDailySession();
        if (session && session.concepts.length > 0) {
          store.setActiveSession(session.id);
          store.setSessionConcepts(session.concepts);
          store.setCurrentConcept(session.concepts[0] ?? null);
          return;
        }
      } catch {
        // Fall through to provided concepts
      }
      // Use provided concepts as fallback
      if (concepts && concepts.length > 0) {
        store.setSessionConcepts(concepts);
        store.setCurrentConcept(concepts[0] ?? null);
      }
    },
    [store]
  );

  /** Start a specific learning path from its first available concept. */
  const startLearningPath = useCallback(
    (concepts: Concept[]) => {
      if (concepts.length === 0) return;
      // Find the first non-mastered concept, or just the first one
      const current =
        concepts.find(
          (c) => c.state === "in_progress" || c.state === "unlocked"
        ) ?? concepts[0];
      store.setSessionConcepts(concepts);
      store.setCurrentConcept(current ?? null);
      store.setActiveSession(`path_${current?.domain?.id ?? "custom"}`);
    },
    [store]
  );

  const loadLesson = useCallback(
    async (conceptId: string) => {
      try {
        const lesson = await ipc.getLesson(conceptId);
        store.setLessonContent(lesson);
        store.resetExplanationAttempt();
        return lesson;
      } catch {
        return null;
      }
    },
    [store]
  );

  const loadQuiz = useCallback(
    async (conceptId: string) => {
      try {
        const quiz = await ipc.getQuiz(conceptId);
        store.setQuizSession(quiz);
        return quiz;
      } catch {
        return null;
      }
    },
    [store]
  );

  const selectConcept = useCallback(
    (concept: Concept) => {
      store.setCurrentConcept(concept);
      store.setLessonContent(null);
      store.setQuizSession(null);
      store.resetExplanationAttempt();
    },
    [store]
  );

  const endSession = useCallback(() => {
    store.reset();
  }, [store]);

  const setLessonContent = useCallback(
    (content: LessonContent | null) => {
      store.setLessonContent(content);
    },
    [store]
  );

  const setQuizSession = useCallback(
    (session: QuizSession | null) => {
      store.setQuizSession(session);
    },
    [store]
  );

  return {
    activeSessionId: store.activeSessionId,
    currentConcept: store.currentConcept,
    quizSession: store.quizSession,
    lessonContent: store.lessonContent,
    explanationAttempt: store.explanationAttempt,
    sessionConcepts: store.sessionConcepts,
    incrementExplanationAttempt: store.incrementExplanationAttempt,
    startSession,
    startLearningPath,
    loadLesson,
    loadQuiz,
    selectConcept,
    endSession,
    setLessonContent,
    setQuizSession,
  };
}
