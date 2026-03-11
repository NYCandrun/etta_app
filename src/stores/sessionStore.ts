import { create } from "zustand";
import type { Concept } from "@/types/concept";
import type { QuizSession } from "@/types/quiz";
import type { LessonContent } from "@/types/lesson";

interface SessionState {
  activeSessionId: string | null;
  currentConcept: Concept | null;
  quizSession: QuizSession | null;
  lessonContent: LessonContent | null;
  explanationAttempt: number;
  sessionConcepts: Concept[];

  setActiveSession: (id: string | null) => void;
  setCurrentConcept: (concept: Concept | null) => void;
  setQuizSession: (session: QuizSession | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  incrementExplanationAttempt: () => void;
  resetExplanationAttempt: () => void;
  setSessionConcepts: (concepts: Concept[]) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  currentConcept: null,
  quizSession: null,
  lessonContent: null,
  explanationAttempt: 0,
  sessionConcepts: [],

  setActiveSession: (id) => set({ activeSessionId: id }),
  setCurrentConcept: (concept) => set({ currentConcept: concept }),
  setQuizSession: (session) => set({ quizSession: session }),
  setLessonContent: (content) => set({ lessonContent: content }),
  incrementExplanationAttempt: () =>
    set((s) => ({ explanationAttempt: s.explanationAttempt + 1 })),
  resetExplanationAttempt: () => set({ explanationAttempt: 0 }),
  setSessionConcepts: (concepts) => set({ sessionConcepts: concepts }),
  reset: () =>
    set({
      activeSessionId: null,
      currentConcept: null,
      quizSession: null,
      lessonContent: null,
      explanationAttempt: 0,
      sessionConcepts: [],
    }),
}));
