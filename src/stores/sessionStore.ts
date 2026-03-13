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
  /** Non-null when user is in a reinforcement loop for a struggled concept */
  reinforcementConceptId: string | null;
  /** Which reinforcement attempt we're on (drives explanation strategy escalation) */
  reinforcementAttempt: number;

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
  /** Enter reinforcement loop for a struggled concept */
  enterReinforcement: (conceptId: string) => void;
  /** Increment the reinforcement attempt counter */
  incrementReinforcementAttempt: () => void;
  /** Exit reinforcement loop */
  exitReinforcement: () => void;
  /** Insert concepts into the session queue right after the current concept */
  insertConceptsAfterCurrent: (concepts: Concept[]) => void;
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
  reinforcementConceptId: null,
  reinforcementAttempt: 0,

  setActiveSession: (id) => set({ activeSessionId: id }),
  setCurrentConcept: (concept) => set({ currentConcept: concept }),
  setQuizSession: (session) => set({ quizSession: session }),
  setLessonContent: (content) => set({ lessonContent: content }),
  incrementExplanationAttempt: () =>
    set((s) => ({ explanationAttempt: s.explanationAttempt + 1 })),
  resetExplanationAttempt: () => set({ explanationAttempt: 0 }),
  setSessionConcepts: (concepts) => set({ sessionConcepts: concepts }),
  enterReinforcement: (conceptId) =>
    set({ reinforcementConceptId: conceptId, reinforcementAttempt: 0 }),
  incrementReinforcementAttempt: () =>
    set((s) => ({ reinforcementAttempt: s.reinforcementAttempt + 1 })),
  exitReinforcement: () =>
    set({ reinforcementConceptId: null, reinforcementAttempt: 0 }),
  insertConceptsAfterCurrent: (concepts) => {
    const { currentConcept, sessionConcepts } = get();
    if (!currentConcept || concepts.length === 0) return;
    const idx = sessionConcepts.findIndex((c) => c.id === currentConcept.id);
    if (idx < 0) return;
    const updated = [...sessionConcepts];
    // Filter out duplicates already in the queue
    const toInsert = concepts.filter(
      (c) => !sessionConcepts.some((s) => s.id === c.id)
    );
    updated.splice(idx + 1, 0, ...toInsert);
    set({ sessionConcepts: updated });
  },
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
      reinforcementConceptId: null,
      reinforcementAttempt: 0,
    }),
}));
