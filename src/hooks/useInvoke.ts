import { useState, useCallback } from "react";

/**
 * Check if running inside Tauri runtime.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Dynamically import Tauri invoke to avoid errors in browser dev.
 */
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      `Tauri is not available. Cannot invoke "${cmd}" in browser mode.`
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface UseInvokeReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  invoke: (args?: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
}

/**
 * Typed wrapper around Tauri invoke() with loading/error states.
 * Gracefully handles the case where Tauri is not available (browser dev).
 */
export function useInvoke<T>(command: string): UseInvokeReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await tauriInvoke<T>(command, args);
        setData(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [command]
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, invoke, reset };
}

export { tauriInvoke, isTauri };
