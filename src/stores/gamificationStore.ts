import { create } from "zustand";
import type {
  GamificationState,
  Level,
  StreakInfo,
  Badge,
  XPEvent,
} from "@/types/gamification";

interface GamificationStoreState extends GamificationState {
  pendingPopup: XPEvent | null;

  setXP: (xp: number) => void;
  setLevel: (level: Level) => void;
  setStreak: (streak: StreakInfo) => void;
  setBadges: (badges: Badge[]) => void;
  addXPEvent: (event: XPEvent) => void;
  showPopup: (event: XPEvent) => void;
  dismissPopup: () => void;
  hydrate: (state: GamificationState) => void;
}

const defaultLevel: Level = {
  current: 1,
  title: "Curious Novice",
  xpForCurrent: 0,
  xpForNext: 100,
  progress: 0,
};

const defaultStreak: StreakInfo = {
  currentDays: 0,
  longestDays: 0,
  todayCompleted: false,
  freezesAvailable: 0,
  freezeActive: false,
  lastActiveDate: "",
};

export const useGamificationStore = create<GamificationStoreState>((set) => ({
  xp: 0,
  level: defaultLevel,
  streak: defaultStreak,
  badges: [],
  recentXpEvents: [],
  pendingPopup: null,

  setXP: (xp) => set({ xp }),
  setLevel: (level) => set({ level }),
  setStreak: (streak) => set({ streak }),
  setBadges: (badges) => set({ badges }),
  addXPEvent: (event) =>
    set((s) => ({
      recentXpEvents: [event, ...s.recentXpEvents].slice(0, 20),
      xp: s.xp + event.amount,
    })),
  showPopup: (event) => set({ pendingPopup: event }),
  dismissPopup: () => set({ pendingPopup: null }),
  hydrate: (state) =>
    set({
      xp: state.xp,
      level: state.level,
      streak: state.streak,
      badges: state.badges,
      recentXpEvents: state.recentXpEvents,
    }),
}));
