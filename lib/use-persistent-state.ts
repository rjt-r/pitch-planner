"use client";

// ── usePersistentState — useState + localStorage ───────────────────────────
// Loads after mount (avoids SSR hydration mismatches on prerendered pages)
// and saves on every subsequent change. The first post-mount save is skipped
// so the default value never clobbers stored data before it has loaded.
// Fails silently when storage is unavailable (private mode, quota).

import { useEffect, useRef, useState } from "react";

export function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const skipSave = useRef(true);

  // Load once after mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setState(JSON.parse(raw) as T);
    } catch {
      // corrupted or unavailable — keep the default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on change — skip the mount-time run (see note above)
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage full or unavailable — fail silently
    }
  }, [key, state]);

  // Re-arm the skip if the effect cycle restarts (React StrictMode remount)
  useEffect(() => {
    return () => {
      skipSave.current = true;
    };
  }, []);

  return [state, setState] as const;
}
