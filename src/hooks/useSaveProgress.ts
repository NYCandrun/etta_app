import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useSessionStore } from "@/stores/sessionStore";
import * as ipc from "@/lib/ipc";

/**
 * Serializable snapshot of the user's current screen position.
 * Stored as JSON in the settings table under key "saved_progress".
 */
export interface SavedProgress {
  route: string;
  conceptId: string | null;
  domainId: string | null;
  scrollY: number;
  savedAt: string;
}

const SAVE_KEY = "saved_progress";

/**
 * Hook for manually saving and restoring the user's exact screen position.
 * This is a manual "bookmark" that complements automatic state persistence.
 */
export function useSaveProgress() {
  const location = useLocation();
  const store = useSessionStore();

  const save = useCallback(async (): Promise<boolean> => {
    const progress: SavedProgress = {
      route: location.pathname,
      conceptId: store.currentConcept?.id ?? null,
      domainId: store.currentConcept?.domain?.id ?? null,
      scrollY: document.querySelector("main")?.scrollTop ?? 0,
      savedAt: new Date().toISOString(),
    };
    try {
      await ipc.setSetting(SAVE_KEY, JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  }, [location.pathname, store.currentConcept]);

  const load = useCallback(async (): Promise<SavedProgress | null> => {
    try {
      const raw = await ipc.getSetting<string>(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SavedProgress;
    } catch {
      return null;
    }
  }, []);

  return { save, load };
}
