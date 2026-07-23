"use client";

import { useEffect, useState } from "react";
import {
  SESSION_TYPES,
  POSITION_DATA,
  METRICS,
  type GPSEstimate,
} from "@/lib/gps-targets";
import { usePersistentState } from "@/lib/use-persistent-state";
import { loadBand, BAND_STYLES } from "@/lib/load-bands";
import {
  getSessionLibrary,
  removeSessionFromLibrary,
  resolvePlannedSession,
  CURRENT_SESSION_ID,
  type ResolvedSession,
} from "@/lib/session-library";

// ── Types ─────────────────────────────────────────────────────────────────
type DayType = "rest" | "training" | "match";
type SessionSource = "benchmark" | "planned";

interface WeekDayConfig {
  dayLabel: string;
  type: DayType;
  sessionType: string;   // key into SESSION_TYPES; preserved even on rest/match days
  durationMins: number;  // preserved on rest/match (restores when re-enabled)
  // "planned" days pull real GPS from a session built on the Session page;
  // absent (older saved weeks) means benchmark
  source?: SessionSource;
  plannedSessionId?: string; // CURRENT_SESSION_ID or a saved-session id
}

// ── Default week ──────────────────────────────────────────────────────────
const DEFAULT_WEEK: WeekDayConfig[] = [
  { dayLabel: "Mon", type: "rest",     sessionType: "intensive", durationMins: 60 },
  { dayLabel: "Tue", type: "training", sessionType: "intensive", durationMins: 60 },
  { dayLabel: "Wed", type: "training", sessionType: "extensive", durationMins: 75 },
  { dayLabel: "Thu", type: "training", sessionType: "md2",       durationMins: 45 },
  { dayLabel: "Fri", type: "training", sessionType: "md1",       durationMins: 60 },
  { dayLabel: "Sat", type: "match",    sessionType: "intensive", durationMins: 60 },
  { dayLabel: "Sun", type: "rest",     sessionType: "intensive", durationMins: 60 },
];

// ── GPS helpers ───────────────────────────────────────────────────────────
// Benchmark GPS values are defined at REF_DURATION minutes.
// Scaling linearly — a 45-min intensive ≠ a 90-min intensive.
const REF_DURATION = 60;

function scaleSessionGPS(sessionType: string, durationMins: number): GPSEstimate {
  const s = SESSION_TYPES[sessionType];
  const f = durationMins / REF_DURATION;
  return {
    distance: Math.round(s.distance * f),
    hsr:      Math.round(s.hsr      * f),
    sprint:   Math.round(s.sprint   * f),
    accels:   Math.round(s.accels   * f),
    decels:   Math.round(s.decels   * f),
  };
}

function computeWeekTarget(matchGPS: GPSEstimate, multiplier: number): GPSEstimate {
  return {
    distance: Math.round(matchGPS.distance * multiplier),
    hsr:      Math.round(matchGPS.hsr      * multiplier),
    sprint:   Math.round(matchGPS.sprint   * multiplier),
    accels:   Math.round(matchGPS.accels   * multiplier),
    decels:   Math.round(matchGPS.decels   * multiplier),
  };
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Copy to clipboard text ────────────────────────────────────────────────
function buildCopyText(
  week: WeekDayConfig[],
  weekGPS: GPSEstimate,
  weekTarget: GPSEstimate,
  effectiveMatchGPS: GPSEstimate,
  posLabel: string,
  multiplier: number,
  trainCount: number,
  totalMins: number,
  matchCount: number,
  avgRpe: number | null,
  resolveDay: (d: WeekDayConfig) => ResolvedSession | null
): string {
  const lines: string[] = [
    `WEEKLY LOAD FORECAST — ${formatDate()}`,
    `Position: ${posLabel}  |  Target: ${multiplier}× match load`,
    "",
  ];

  week.forEach((d) => {
    if (d.type === "rest") {
      lines.push(`${d.dayLabel}  Rest`);
    } else if (d.type === "match") {
      const g = effectiveMatchGPS;
      lines.push(
        `${d.dayLabel}  Match (${posLabel})  |  ~${g.distance.toLocaleString()}m · ~${g.hsr}m HSR · ~${g.sprint}m sprint · ~${g.accels} acc · ~${g.decels} dec`
      );
    } else {
      const resolved = resolveDay(d);
      const g = resolved ? resolved.gps : scaleSessionGPS(d.sessionType, d.durationMins);
      const label = resolved
        ? `Planned: ${resolved.name}`
        : SESSION_TYPES[d.sessionType].label;
      const mins = resolved ? resolved.durationMins : d.durationMins;
      const parts = [
        `~${g.distance.toLocaleString()}m`,
        g.hsr    > 0 ? `~${g.hsr}m HSR`       : null,
        g.sprint > 0 ? `~${g.sprint}m sprint`  : null,
        `~${g.accels} acc`,
        `~${g.decels} dec`,
      ].filter(Boolean).join(" · ");
      lines.push(`${d.dayLabel}  ${label} — ${mins} min  |  ${parts}`);
    }
  });

  lines.push("", "WEEKLY TOTALS");
  METRICS.forEach((m) => {
    const actual = weekGPS[m.key];
    const target = weekTarget[m.key];
    const band   = loadBand(actual, target, { flagUnder: true });
    const flag   = band.band !== "on" && band.label ? ` — ${band.label}` : "";
    const matchX = effectiveMatchGPS[m.key] > 0
      ? (actual / effectiveMatchGPS[m.key]).toFixed(1) + "× match"
      : "—";
    lines.push(
      `  ${m.label.padEnd(10)} ~${actual.toLocaleString()}${m.unit}  /  ${target.toLocaleString()}${m.unit} target  (${band.pct}%${flag})   ${matchX}`
    );
  });

  lines.push("");
  const summary = [
    `${trainCount} session${trainCount !== 1 ? "s" : ""}`,
    `${totalMins} min`,
    `${matchCount} match`,
    avgRpe !== null ? `Avg RPE ${avgRpe}` : null,
  ].filter(Boolean).join(" · ");
  lines.push(`  ${summary}`);
  lines.push("GPS values are research-based approximations (±15–40% variability)");

  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────
export default function ForecasterPage() {
  // Week plan and targets persist across visits — plan Monday, tweak Thursday
  const [week, setWeek]               = usePersistentState<WeekDayConfig[]>("pitch-planner-week", DEFAULT_WEEK);
  const [selectedDay, setSelectedDay] = useState<number | null>(1); // open Tue by default
  const [position, setPosition]       = usePersistentState("pitch-planner-week-position", "average");
  const [multiplier, setMultiplier]   = usePersistentState("pitch-planner-week-multiplier", 3.5);
  const [copied, setCopied]           = useState(false);

  // ── Editable match-day demands ────────────────────────────────────────
  // Shares a key with the Session planner — edit squad data once, applies everywhere
  const [customPositionOverrides, setCustomPositionOverrides] = usePersistentState<
    Record<string, Partial<GPSEstimate>>
  >("pitch-planner-position-overrides", {});
  const [editingPosition, setEditingPosition] = useState(false);

  const posBase = POSITION_DATA[position];
  const posOv   = customPositionOverrides[position] ?? {};

  // effectiveMatchGPS merges the squad's actual data (overrides) over the research defaults
  const effectiveMatchGPS: GPSEstimate = {
    distance: posOv.distance ?? posBase.distance,
    hsr:      posOv.hsr      ?? posBase.hsr,
    sprint:   posOv.sprint   ?? posBase.sprint,
    accels:   posOv.accels   ?? posBase.accels,
    decels:   posOv.decels   ?? posBase.decels,
  };

  const hasPosOverride = Object.keys(posOv).length > 0;

  // ── Planned sessions (from the Session page) ──────────────────────────
  // Loaded on mount: the live current session plus everything saved via
  // "Save session". Days linked to CURRENT_SESSION_ID update automatically
  // as the coach edits their session.
  const [sessionOptions, setSessionOptions] = useState<ResolvedSession[]>([]);

  useEffect(() => {
    refreshSessionOptions();
  }, []);

  function refreshSessionOptions() {
    const opts: ResolvedSession[] = [];
    const current = resolvePlannedSession(CURRENT_SESSION_ID);
    if (current) opts.push(current);
    for (const s of getSessionLibrary()) {
      const r = resolvePlannedSession(s.id);
      if (r) opts.push(r);
    }
    setSessionOptions(opts);
  }

  function handleDeleteSavedSession(id: string) {
    removeSessionFromLibrary(id);
    refreshSessionOptions();
  }

  /** Resolved planned session for a day, or null (benchmark / missing). */
  function resolvedFor(day: WeekDayConfig): ResolvedSession | null {
    if (day.type !== "training" || day.source !== "planned" || !day.plannedSessionId) {
      return null;
    }
    return sessionOptions.find((o) => o.id === day.plannedSessionId) ?? null;
  }

  /** Day GPS routed through planned sessions when linked, else benchmarks. */
  function dayGPS(day: WeekDayConfig): GPSEstimate | null {
    if (day.type === "rest") return null;
    if (day.type === "match") return { ...effectiveMatchGPS };
    const resolved = resolvedFor(day);
    return resolved ? resolved.gps : scaleSessionGPS(day.sessionType, day.durationMins);
  }

  function setPosOverride(k: keyof GPSEstimate, val: number) {
    setCustomPositionOverrides(prev => ({
      ...prev,
      [position]: { ...(prev[position] ?? {}), [k]: val },
    }));
  }

  function resetPosOverrides() {
    setCustomPositionOverrides(prev => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
  }

  // All GPS calculations use effectiveMatchGPS — overrides flow through
  // automatically; planned-session days contribute their real totals
  const zero: GPSEstimate = { distance: 0, hsr: 0, sprint: 0, accels: 0, decels: 0 };
  const weekGPS = week.reduce((acc, d) => {
    const gps = dayGPS(d);
    if (!gps) return acc;
    return {
      distance: acc.distance + gps.distance,
      hsr:      acc.hsr      + gps.hsr,
      sprint:   acc.sprint   + gps.sprint,
      accels:   acc.accels   + gps.accels,
      decels:   acc.decels   + gps.decels,
    };
  }, zero);
  const weekTarget = computeWeekTarget(effectiveMatchGPS, multiplier);

  // Derived summary stats — planned days use their real duration and RPE
  const trainDays  = week.filter(d => d.type === "training");
  const trainCount = trainDays.length;
  const matchCount = week.filter(d => d.type === "match").length;
  const totalMins  = trainDays.reduce(
    (s, d) => s + (resolvedFor(d)?.durationMins ?? d.durationMins), 0);
  const avgRpe = trainCount > 0
    ? Math.round((trainDays.reduce(
        (s, d) => s + (resolvedFor(d)?.avgRpe ?? SESSION_TYPES[d.sessionType].rpe), 0
      ) / trainCount) * 10) / 10
    : null;

  function updateDay(idx: number, patch: Partial<WeekDayConfig>) {
    setWeek(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }

  function handleCopy() {
    const text = buildCopyText(
      week, weekGPS, weekTarget, effectiveMatchGPS,
      posBase.label, multiplier, trainCount, totalMins, matchCount, avgRpe,
      resolvedFor
    );
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const selectedDayData = selectedDay !== null ? week[selectedDay] : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* ── Hero ── */}
        <div className="bg-gradient-to-br from-green-950/60 to-zinc-900/60 border border-green-900/40 rounded-xl p-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Weekly Load Forecaster</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Plan a full training week and forecast total GPS load. Click any day to set its type, session, and duration — weekly totals update instantly against your match-load target.
          </p>
        </div>

        {/* ── Controls: position + multiplier ── */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-5">

          {/* Position selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Position — drives match GPS &amp; weekly target
              </p>
              {/* Edit match-day values button */}
              <button
                onClick={() => setEditingPosition(v => !v)}
                title="Edit match-day GPS demands for your squad"
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
                  hasPosOverride
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : editingPosition
                    ? "border-green-700 bg-green-950/50 text-green-400"
                    : "border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500"
                }`}
              >
                ✎ {hasPosOverride ? "Edited" : "Edit values"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(POSITION_DATA).map(([key, pos]) => {
                const isCustomised = Object.keys(customPositionOverrides[key] ?? {}).length > 0;
                return (
                  <button
                    key={key}
                    onClick={() => { setPosition(key); setEditingPosition(false); }}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      position === key
                        ? "border-green-600 bg-green-950/50 text-green-300"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    {pos.label}
                    {isCustomised && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline position editor */}
          {editingPosition && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400 font-medium">
                  {posBase.label} match demands
                  <span className="text-zinc-600 font-normal ml-1">— edit for your squad&apos;s actual GPS data</span>
                </p>
                {hasPosOverride && (
                  <button
                    onClick={resetPosOverrides}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    Reset to defaults
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {METRICS.map(m => {
                  const defaultVal = posBase[m.key];
                  const currentVal = effectiveMatchGPS[m.key];
                  const isEdited   = currentVal !== defaultVal;
                  return (
                    <div key={m.key}>
                      <label className="text-xs text-zinc-500 block mb-1">
                        {m.label}{m.unit ? ` (${m.unit})` : ""}
                        {isEdited && <span className="ml-1 text-amber-500">✎</span>}
                      </label>
                      <input
                        type="number" min={0} value={currentVal}
                        onChange={e => setPosOverride(m.key, Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-green-600"
                      />
                      {isEdited && (
                        <p className="text-xs text-zinc-700 mt-0.5 font-mono">
                          default: {defaultVal.toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-700">
                Changes update the match-day GPS, weekly target bars, and match-equivalent multipliers. Amber dot on position button shows it has been customised.
              </p>
            </div>
          )}

          {/* Weekly multiplier */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Weekly target
              </p>
              <span className="text-sm font-bold text-white">
                {multiplier}× match load
                <span className="text-xs font-normal text-zinc-500 ml-2">
                  ({effectiveMatchGPS.distance.toLocaleString()}m × {multiplier} = {weekTarget.distance.toLocaleString()}m target)
                </span>
              </span>
            </div>
            <input
              type="range" min={2} max={5} step={0.5} value={multiplier}
              onChange={e => setMultiplier(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-zinc-700 mt-1">
              <span>2×  light week</span>
              <span>3.5×  typical</span>
              <span>5×  heavy</span>
            </div>
          </div>
        </div>

        {/* ── Week grid ── */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Week plan</p>
            <p className="text-xs text-zinc-600">Click a day to edit</p>
          </div>

          {/* 7-day cards */}
          <div className="grid grid-cols-7 gap-2">
            {week.map((day, idx) => {
              const isSelected = selectedDay === idx;
              const gps = dayGPS(day);
              const resolved = resolvedFor(day);

              let cardClass = "rounded-xl py-3 px-1.5 flex flex-col items-center text-center gap-1 cursor-pointer transition-all select-none ";
              if (day.type === "rest") {
                cardClass += "bg-zinc-800/50 border border-zinc-700/60 hover:border-zinc-600 ";
              } else if (day.type === "match") {
                cardClass += "bg-green-950/60 border border-green-700/50 hover:border-green-600 ";
              } else {
                cardClass += "bg-zinc-900 border border-zinc-700 hover:border-zinc-500 ";
              }
              if (isSelected) {
                cardClass += "ring-2 ring-green-500 ring-offset-1 ring-offset-zinc-950";
              }

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(idx === selectedDay ? null : idx)}
                  className={cardClass}
                >
                  <p className="text-xs font-mono uppercase text-zinc-500">{day.dayLabel}</p>

                  {day.type === "rest" && (
                    <p className="text-xs text-zinc-700 mt-0.5">Rest</p>
                  )}

                  {day.type === "match" && (
                    <>
                      <p className="text-xs font-bold text-green-400 mt-0.5">Match</p>
                      <p className="text-xs text-zinc-500 font-mono">
                        {(effectiveMatchGPS.distance / 1000).toFixed(1)}km
                      </p>
                    </>
                  )}

                  {day.type === "training" && (
                    <>
                      {resolved ? (
                        <p
                          className="text-xs font-bold text-green-300 mt-0.5 leading-tight max-w-full truncate"
                          title={resolved.name}
                        >
                          {resolved.name}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-white mt-0.5 leading-tight">
                          {SESSION_TYPES[day.sessionType].label.split(" ")[0]}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500">
                        {(resolved?.durationMins ?? day.durationMins)}′
                      </p>
                      {gps && (
                        <p className="text-xs font-mono text-zinc-400">
                          {(gps.distance / 1000).toFixed(1)}km
                        </p>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day editor panel */}
          {selectedDay !== null && selectedDayData && (
            <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  {selectedDayData.dayLabel}
                  {selectedDayData.type === "training" && (
                    <span className="text-xs font-normal text-zinc-500 ml-2">
                      — {SESSION_TYPES[selectedDayData.sessionType].label}
                    </span>
                  )}
                </p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Day type toggle */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">Day type</p>
                <div className="flex gap-2">
                  {(["rest", "training", "match"] as DayType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => updateDay(selectedDay, { type: t })}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors capitalize ${
                        selectedDayData.type === t
                          ? "bg-green-600 border-green-600 text-white"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Training: benchmark vs planned session */}
              {selectedDayData.type === "training" && (
                <>
                  {/* Source toggle */}
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Session source</p>
                    <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
                      <button
                        onClick={() => updateDay(selectedDay, { source: "benchmark" })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          selectedDayData.source !== "planned"
                            ? "bg-green-600 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Benchmark
                      </button>
                      <button
                        onClick={() =>
                          updateDay(selectedDay, {
                            source: "planned",
                            plannedSessionId:
                              selectedDayData.plannedSessionId ?? sessionOptions[0]?.id,
                          })
                        }
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          selectedDayData.source === "planned"
                            ? "bg-green-600 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        My planned sessions
                      </button>
                    </div>
                  </div>

                  {/* Planned-session picker */}
                  {selectedDayData.source === "planned" && (
                    <div className="space-y-3">
                      {sessionOptions.length === 0 ? (
                        <p className="text-xs text-zinc-500 border border-dashed border-zinc-700 rounded-lg p-3">
                          No planned sessions yet — build one on the{" "}
                          <a href="/" className="text-green-400 underline hover:text-green-300">
                            Session page
                          </a>{" "}
                          and click &ldquo;Save session&rdquo;, then assign it here.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sessionOptions.map((opt) => {
                              const isSel = selectedDayData.plannedSessionId === opt.id;
                              const isCurrent = opt.id === CURRENT_SESSION_ID;
                              return (
                                <div key={opt.id} className="relative">
                                  <button
                                    onClick={() =>
                                      updateDay(selectedDay, { plannedSessionId: opt.id })
                                    }
                                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                                      isSel
                                        ? "border-green-600 bg-green-950/50 text-green-300"
                                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                                    }`}
                                  >
                                    <span className="font-semibold block pr-6 truncate">
                                      {opt.name}
                                      {isCurrent && (
                                        <span className="ml-1.5 font-normal text-zinc-500">
                                          (live from Session page)
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-zinc-600 block mt-0.5">
                                      {opt.drillCount} drill{opt.drillCount !== 1 ? "s" : ""} ·{" "}
                                      {opt.durationMins} min · RPE {opt.avgRpe} ·{" "}
                                      ~{opt.gps.distance.toLocaleString()}m
                                    </span>
                                  </button>
                                  {!isCurrent && (
                                    <button
                                      onClick={() => handleDeleteSavedSession(opt.id)}
                                      title="Delete saved session"
                                      className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors text-xs"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Missing link — assigned session no longer exists */}
                          {selectedDayData.plannedSessionId &&
                            !sessionOptions.some(
                              (o) => o.id === selectedDayData.plannedSessionId
                            ) && (
                              <p className="text-xs text-amber-400">
                                The session linked to this day no longer exists — pick
                                another, or the day falls back to the{" "}
                                {SESSION_TYPES[selectedDayData.sessionType].label} benchmark.
                              </p>
                            )}

                          {/* Resolved GPS strip */}
                          {(() => {
                            const r = resolvedFor(selectedDayData);
                            if (!r) return null;
                            return (
                              <div>
                                <p className="text-xs text-zinc-500 mb-2">
                                  Planned GPS{" "}
                                  <span className="text-zinc-700">
                                    (from your actual drills — not a benchmark)
                                  </span>
                                </p>
                                <div className="grid grid-cols-5 gap-2">
                                  {METRICS.map((m) => (
                                    <div
                                      key={m.key}
                                      className="bg-zinc-900 border border-green-900/30 rounded-lg p-2 text-center"
                                    >
                                      <p className="text-xs text-zinc-500">{m.label}</p>
                                      <p className="text-xs font-mono font-semibold text-green-400 mt-0.5">
                                        ~{r.gps[m.key].toLocaleString()}{m.unit}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}

                  {/* Benchmark controls: session type + duration + estimate */}
                  {selectedDayData.source !== "planned" && (<>
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Session type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(SESSION_TYPES).map(([key, st]) => (
                        <button
                          key={key}
                          onClick={() => updateDay(selectedDay, { sessionType: key })}
                          className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                            selectedDayData.sessionType === key
                              ? "border-green-600 bg-green-950/50 text-green-300"
                              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                          }`}
                        >
                          <span className="font-semibold block">{st.label}</span>
                          <span className="text-zinc-600 text-xs">RPE {st.rpe}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-zinc-500">Duration</p>
                      <span className="text-sm font-semibold text-white">
                        {selectedDayData.durationMins} min
                      </span>
                    </div>
                    <input
                      type="range" min={15} max={120} step={5}
                      value={selectedDayData.durationMins}
                      onChange={e => updateDay(selectedDay, { durationMins: Number(e.target.value) })}
                      className="w-full accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-700 mt-1">
                      <span>15 min</span>
                      <span>60 min</span>
                      <span>120 min</span>
                    </div>
                  </div>

                  {/* GPS preview strip */}
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">
                      Estimated GPS{" "}
                      <span className="text-zinc-700">
                        (scaled from {SESSION_TYPES[selectedDayData.sessionType].label} benchmark at {REF_DURATION} min)
                      </span>
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {METRICS.map(m => {
                        const g = scaleSessionGPS(selectedDayData.sessionType, selectedDayData.durationMins);
                        return (
                          <div key={m.key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center">
                            <p className="text-xs text-zinc-500">{m.label}</p>
                            <p className="text-xs font-mono font-semibold text-zinc-300 mt-0.5">
                              ~{g[m.key].toLocaleString()}{m.unit}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </>)}
                </>
              )}

              {/* Match: GPS summary (uses effective values) */}
              {selectedDayData.type === "match" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500">
                      Match GPS — {posBase.label}
                      {hasPosOverride && (
                        <span className="ml-1.5 text-amber-400 text-xs">✎ edited</span>
                      )}
                    </p>
                    <button
                      onClick={() => { setEditingPosition(true); setSelectedDay(null); }}
                      className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      Edit values ↑
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {METRICS.map(m => (
                      <div key={m.key} className="bg-zinc-900 border border-green-900/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-zinc-500">{m.label}</p>
                        <p className={`text-xs font-mono font-semibold mt-0.5 ${
                          hasPosOverride && effectiveMatchGPS[m.key] !== posBase[m.key]
                            ? "text-amber-400"
                            : "text-green-400"
                        }`}>
                          {effectiveMatchGPS[m.key].toLocaleString()}{m.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rest note */}
              {selectedDayData.type === "rest" && (
                <p className="text-xs text-zinc-600 italic">
                  Rest days contribute no GPS load to the weekly total.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Weekly forecast ── */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Weekly Forecast
            </p>
            <p className="text-xs text-zinc-600">
              vs {multiplier}× {posBase.label} match load
              {hasPosOverride && <span className="ml-1 text-amber-500">✎</span>}
            </p>
          </div>

          {/* Summary chips */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Training sessions", value: trainCount > 0 ? String(trainCount) : "—" },
              { label: "Training mins",     value: totalMins > 0 ? `${totalMins} min` : "—" },
              { label: "Matches",           value: matchCount > 0 ? String(matchCount) : "—" },
              { label: "Avg RPE",           value: avgRpe !== null ? String(avgRpe) : "—" },
            ].map(chip => (
              <div
                key={chip.label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center"
              >
                <p className="text-lg font-bold text-white">{chip.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{chip.label}</p>
              </div>
            ))}
          </div>

          {/* Metric bars — banded vs target; a finished week under 90% gets a cue too */}
          <div className="space-y-4">
            {METRICS.map(m => {
              const actual   = weekGPS[m.key];
              const target   = weekTarget[m.key];
              const band     = loadBand(actual, target, { flagUnder: true });
              const style    = band.band !== "none" ? BAND_STYLES[band.band] : null;
              const matchVal = effectiveMatchGPS[m.key];
              const matchX   = matchVal > 0 ? (actual / matchVal).toFixed(1) + "×" : "—";

              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-400">{m.label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-mono ${style ? style.text : "text-zinc-300"}`}>
                        ~{actual.toLocaleString()}{m.unit}
                        {" / "}
                        {target.toLocaleString()}{m.unit}
                        {band.label && <span className="ml-1.5">{band.label}</span>}
                      </span>
                      <span className="text-xs font-semibold text-zinc-400 w-16 text-right tabular-nums">
                        {matchX} match
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${style ? style.bar : m.color}`}
                      style={{ width: `${Math.min(100, band.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Band legend */}
            <p className="text-xs text-zinc-600">
              vs weekly target: <span className="text-sky-400">●</span> &lt;90% under ·{" "}
              <span className="text-green-500">●</span> within ±10% ·{" "}
              <span className="text-amber-400">●</span> ≤+30% over ·{" "}
              <span className="text-red-400">●</span> &gt;+30% over
            </p>
          </div>

          {/* No activity note */}
          {trainCount === 0 && matchCount === 0 && (
            <p className="text-xs text-zinc-600 text-center py-2">
              All days are set to Rest — add training sessions or a match to see weekly forecasts
            </p>
          )}

          {/* Footnote + export */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
            <p className="text-xs text-zinc-700">
              GPS estimates are research-based approximations (±15–40% variability)
            </p>
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1.5 rounded border transition-colors shrink-0 ${
                copied
                  ? "border-green-700 bg-green-950 text-green-400"
                  : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
              }`}
            >
              {copied ? "Copied!" : "Copy week plan"}
            </button>
          </div>
        </div>

      </div>

      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-700 mt-8">
        Pitch Planner · Based on Riboli et al. (2020) · Built for women&apos;s football coaches
      </footer>
    </main>
  );
}
