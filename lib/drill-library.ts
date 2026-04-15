// ── Drill Library — localStorage persistence ──────────────────────────────
// Drills saved here are independent from the current session. The storage
// layer is isolated so migrating to a database later is a one-file change.

import type { GPSEstimate } from "@/lib/gps-targets";

export type LibraryDrill = {
  id: string;           // preserved from original Drill.id at save time
  name: string;
  format: string;
  rpa: number;
  area: number;
  refLabel: string;
  durationMins: number; // coach's default — adjustable at load time
  rpe: number;
  gps: GPSEstimate;     // GPS at the saved duration
  savedAt: string;      // ISO date string
};

const STORAGE_KEY = "pitch-planner-drill-library";

function readRaw(): LibraryDrill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LibraryDrill[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(drills: LibraryDrill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drills));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/** Return all saved drills, newest first. */
export function getLibrary(): LibraryDrill[] {
  return readRaw().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

/** Save (upsert) a drill to the library. Matches on id. */
export function saveToLibrary(drill: LibraryDrill): void {
  const existing = readRaw();
  const idx = existing.findIndex((d) => d.id === drill.id);
  if (idx >= 0) {
    existing[idx] = drill;
  } else {
    existing.push(drill);
  }
  writeRaw(existing);
}

/** Remove a drill by id. */
export function removeFromLibrary(id: string): void {
  writeRaw(readRaw().filter((d) => d.id !== id));
}

/** Rename a drill in-place. */
export function renameInLibrary(id: string, name: string): void {
  const existing = readRaw();
  const drill = existing.find((d) => d.id === id);
  if (drill) {
    drill.name = name;
    writeRaw(existing);
  }
}

// ── Relative time helper ──────────────────────────────────────────────────
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);

  if (mins  < 2)  return "just now";
  if (mins  < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return days === 1 ? "yesterday" : `${days} days ago`;
  if (weeks < 8)  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  return new Date(isoString).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
