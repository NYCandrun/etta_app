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
  /** Accumulated learning minutes for today */
  todayMinutes: number;
  /** Timestamp when the current active segment started (null = not actively learning) */
  activeSegmentStart: number | null;

  setActiveSession: (id: string | null) => void;
  setCurrentConcept: (concept: Concept | null) => void;
  setQuizSession: (session: QuizSession | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  incrementExplanationAttempt: () => void;
  resetExplanationAttempt: () => void;
  setSessionConcepts: (concepts: Concept[]) => void;
  /** Start tracking active learning time */
  startTimeTracking: () => void;
  /** Stop tracking and accumulate elapsed time */
  stopTimeTracking: () => void;
  /** Get total minutes including any active segment */
  getTodayMinutes: () => number;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSessionId: null,
  currentConcept: null,
  quizSession: null,
  lessonContent: null,
  explanationAttempt: 0,
  sessionConcepts: [],
  todayMinutes: 0,
  activeSegmentStart: null,

  setActiveSession: (id) => set({ activeSessionId: id }),
  setCurrentConcept: (concept) => set({ currentConcept: concept }),
  setQuizSession: (session) => set({ quizSession: session }),
  setLessonContent: (content) => set({ lessonContent: content }),
  incrementExplanationAttempt: () =>
    set((s) => ({ explanationAttempt: s.explanationAttempt + 1 })),
  resetExplanationAttempt: () => set({ explanationAttempt: 0 }),
  setSessionConcepts: (concepts) => set({ sessionConcepts: concepts }),
  startTimeTracking: () => set({ activeSegmentStart: Date.now() }),
  stopTimeTracking: () => {
    const { activeSegmentStart, todayMinutes } = get();
    if (activeSegmentStart) {
      const elapsed = (Date.now() - activeSegmentStart) / 60_000;
      set({ todayMinutes: todayMinutes + elapsed, activeSegmentStart: null });
    }
  },
  getTodayMinutes: () => {
    const { todayMinutes, activeSegmentStart } = get();
    if (activeSegmentStart) {
      return todayMinutes + (Date.now() - activeSegmentStart) / 60_000;
    }
    return todayMinutes;
  },
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
