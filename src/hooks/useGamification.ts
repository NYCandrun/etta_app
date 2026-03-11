import { useCallback, useEffect, useRef } from "react";
import { useGamificationStore } from "@/stores/gamificationStore";
import type { XPEvent, XPSource } from "@/types/gamification";
import * as ipc from "@/lib/ipc";

/**
 * Hook for XP, streak, level, and badge state.
 * Syncs with the Tauri backend on mount.
 */
export function useGamification() {
  const store = useGamificationStore();
  const hasFetched = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const state = await ipc.getGamificationState();
      if (state) {
        store.hydrate(state);
      }
    } catch {
      // Silently fail in browser mode
    }
  }, [store]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      void refresh();
    }
  }, [refresh]);

  const awardXP = useCallback(
    async (amount: number, source: XPSource, description: string) => {
      const event: XPEvent = {
        id: crypto.randomUUID(),
        amount,
        source,
        description,
        timestamp: new Date().toISOString(),
      };
      store.addXPEvent(event);
      store.showPopup(event);
      try {
        await ipc.awardXp(amount, source, description);
        // Refresh to get updated level info from backend
        await refresh();
      } catch {
        // XP was already added to local state
      }
    },
    [store, refresh]
  );

  return {
    xp: store.xp,
    level: store.level,
    streak: store.streak,
    badges: store.badges,
    recentXpEvents: store.recentXpEvents,
    pendingPopup: store.pendingPopup,
    dismissPopup: store.dismissPopup,
    awardXP,
    refresh,
  };
}
