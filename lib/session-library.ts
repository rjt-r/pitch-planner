// ── Session Library — localStorage persistence ────────────────────────────
// Whole sessions saved from the Session page, so the Week forecaster can
// plan days from real drill-by-drill GPS totals instead of generic
// benchmarks. Mirrors drill-library.ts: the storage layer is isolated so
// migrating to a database later is a one-file change.

import type { GPSEstimate } from "@/lib/gps-targets";
import type { Drill } from "@/components/SessionPlanner";

export type SavedSession = {
  id: string;
  name: string;
  drills: Drill[];
  savedAt: string; // ISO date string
};

/** A session resolved into the numbers the Week forecaster needs. */
export type ResolvedSession = {
  id: string;
  name: string;
  gps: GPSEstimate;
  durationMins: number;
  avgRpe: number;
  drillCount: number;
};

const STORAGE_KEY = "pitch-planner-session-library";

/** Special id for the live, unsaved session on the Session page. */
export const CURRENT_SESSION_ID = "current";
const CURRENT_DRILLS_KEY = "pitch-planner-session-drills";

function readRaw(): SavedSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSession[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(sessions: SavedSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

/** Return all saved sessions, newest first. */
export function getSessionLibrary(): SavedSession[] {
  return readRaw().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

/** Save (upsert) a session. Matches on id. */
export function saveSessionToLibrary(session: SavedSession): void {
  const existing = readRaw();
  const idx = existing.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    existing[idx] = session;
  } else {
    existing.push(session);
  }
  writeRaw(existing);
}

/** Remove a session by id. */
export function removeSessionFromLibrary(id: string): void {
  writeRaw(readRaw().filter((s) => s.id !== id));
}

// ── Totals helpers ─────────────────────────────────────────────────────────
export function sessionGPS(drills: Drill[]): GPSEstimate {
  return drills.reduce(
    (acc, d) => ({
      distance: acc.distance + d.gps.distance,
      hsr:      acc.hsr      + d.gps.hsr,
      sprint:   acc.sprint   + d.gps.sprint,
      accels:   acc.accels   + d.gps.accels,
      decels:   acc.decels   + d.gps.decels,
    }),
    { distance: 0, hsr: 0, sprint: 0, accels: 0, decels: 0 }
  );
}

function resolve(id: string, name: string, drills: Drill[]): ResolvedSession {
  const durationMins = drills.reduce((s, d) => s + d.durationMins, 0);
  const avgRpe =
    Math.round((drills.reduce((s, d) => s + d.rpe, 0) / drills.length) * 10) / 10;
  return { id, name, gps: sessionGPS(drills), durationMins, avgRpe, drillCount: drills.length };
}

/**
 * Resolve a planned-session id into forecast numbers.
 * CURRENT_SESSION_ID reads the live session from the Session page, so a
 * week day linked to it updates as the coach edits their session.
 * Returns null when the session is missing or has no drills.
 */
export function resolvePlannedSession(id: string): ResolvedSession | null {
  if (typeof window === "undefined") return null;

  if (id === CURRENT_SESSION_ID) {
    try {
      const raw = localStorage.getItem(CURRENT_DRILLS_KEY);
      const drills = raw ? (JSON.parse(raw) as Drill[]) : [];
      if (!Array.isArray(drills) || drills.length === 0) return null;
      return resolve(id, "Current session", drills);
    } catch {
      return null;
    }
  }

  const session = readRaw().find((s) => s.id === id);
  if (!session || session.drills.length === 0) return null;
  return resolve(session.id, session.name, session.drills);
}
