"use client";

import { useState, useMemo } from "react";
import {
  SESSION_TYPES,
  POSITION_DATA,
  METRICS,
  type GPSEstimate,
} from "@/lib/gps-targets";

// ── Types ─────────────────────────────────────────────────────────────────
type DayType = "rest" | "training" | "match";

interface WeekDayConfig {
  dayLabel: string;
  type: DayType;
  sessionType: string;   // key into SESSION_TYPES; preserved even on rest/match days
  durationMins: number;  // preserved on rest/match (restores when re-enabled)
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

function getDayGPS(day: WeekDayConfig, position: string): GPSEstimate | null {
  if (day.type === "rest")     return null;
  if (day.type === "match")    return { ...POSITION_DATA[position] };
  return scaleSessionGPS(day.sessionType, day.durationMins);
}

function computeWeekGPS(week: WeekDayConfig[], position: string): GPSEstimate {
  const zero: GPSEstimate = { distance: 0, hsr: 0, sprint: 0, accels: 0, decels: 0 };
  return week.reduce((acc, d) => {
    const gps = getDayGPS(d, position);
    if (!gps) return acc;
    return {
      distance: acc.distance + gps.distance,
      hsr:      acc.hsr      + gps.hsr,
      sprint:   acc.sprint   + gps.sprint,
      accels:   acc.accels   + gps.accels,
      decels:   acc.decels   + gps.decels,
    };
  }, zero);
}

function computeWeekTarget(position: string, multiplier: number): GPSEstimate {
  const m = POSITION_DATA[position];
  return {
    distance: Math.round(m.distance * multiplier),
    hsr:      Math.round(m.hsr      * multiplier),
    sprint:   Math.round(m.sprint   * multiplier),
    accels:   Math.round(m.accels   * multiplier),
    decels:   Math.round(m.decels   * multiplier),
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
  matchGPS: typeof POSITION_DATA[string],
  position: string,
  multiplier: number,
  trainCount: number,
  totalMins: number,
  matchCount: number,
  avgRpe: number | null
): string {
  const posLabel = POSITION_DATA[position].label;
  const lines: string[] = [
    `WEEKLY LOAD FORECAST — ${formatDate()}`,
    `Position: ${posLabel}  |  Target: ${multiplier}× match load`,
    "",
  ];

  week.forEach((d) => {
    if (d.type === "rest") {
      lines.push(`${d.dayLabel}  Rest`);
    } else if (d.type === "match") {
      const g = POSITION_DATA[position];
      lines.push(
        `${d.dayLabel}  Match (${posLabel})  |  ~${g.distance.toLocaleString()}m · ~${g.hsr}m HSR · ~${g.sprint}m sprint · ~${g.accels} acc · ~${g.decels} dec`
      );
    } else {
      const g = scaleSessionGPS(d.sessionType, d.durationMins);
      const st = SESSION_TYPES[d.sessionType];
      const parts = [
        `~${g.distance.toLocaleString()}m`,
        g.hsr > 0 ? `~${g.hsr}m HSR` : null,
        g.sprint > 0 ? `~${g.sprint}m sprint` : null,
        `~${g.accels} acc`,
        `~${g.decels} dec`,
      ].filter(Boolean).join(" · ");
      lines.push(`${d.dayLabel}  ${st.label} — ${d.durationMins} min  |  ${parts}`);
    }
  });

  lines.push("");
  lines.push("WEEKLY TOTALS");

  METRICS.forEach((m) => {
    const actual = weekGPS[m.key];
    const target = weekTarget[m.key];
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
    const matchX = matchGPS[m.key] > 0 ? (actual / matchGPS[m.key]).toFixed(1) + "× match" : "—";
    lines.push(
      `  ${m.label.padEnd(10)} ~${actual.toLocaleString()}${m.unit}  /  ${target.toLocaleString()}${m.unit} target  (${pct}%)   ${matchX}`
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
  const [week, setWeek]               = useState<WeekDayConfig[]>(DEFAULT_WEEK);
  const [selectedDay, setSelectedDay] = useState<number | null>(1); // open Tue by default
  const [position, setPosition]       = useState("average");
  const [multiplier, setMultiplier]   = useState(3.5);
  const [copied, setCopied]           = useState(false);

  const weekGPS    = useMemo(() => computeWeekGPS(week, position),          [week, position]);
  const weekTarget = useMemo(() => computeWeekTarget(position, multiplier),  [position, multiplier]);
  const matchGPS   = POSITION_DATA[position];

  // Derived summary stats
  const trainDays  = week.filter(d => d.type === "training");
  const trainCount = trainDays.length;
  const matchCount = week.filter(d => d.type === "match").length;
  const totalMins  = trainDays.reduce((s, d) => s + d.durationMins, 0);
  const avgRpe = trainCount > 0
    ? Math.round((trainDays.reduce((s, d) => s + SESSION_TYPES[d.sessionType].rpe, 0) / trainCount) * 10) / 10
    : null;

  function updateDay(idx: number, patch: Partial<WeekDayConfig>) {
    setWeek(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }

  function handleCopy() {
    const text = buildCopyText(week, weekGPS, weekTarget, matchGPS, position, multiplier, trainCount, totalMins, matchCount, avgRpe);
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
          {/* Position */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Position — drives match GPS &amp; weekly target
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(POSITION_DATA).map(([key, pos]) => (
                <button
                  key={key}
                  onClick={() => setPosition(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    position === key
                      ? "border-green-600 bg-green-950/50 text-green-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly multiplier */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Weekly target
              </p>
              <span className="text-sm font-bold text-white">
                {multiplier}× match load
                <span className="text-xs font-normal text-zinc-500 ml-2">
                  ({matchGPS.distance.toLocaleString()}m × {multiplier} = {weekTarget.distance.toLocaleString()}m target)
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
              const dayGPS = getDayGPS(day, position);

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
                        {(matchGPS.distance / 1000).toFixed(1)}km
                      </p>
                    </>
                  )}

                  {day.type === "training" && (
                    <>
                      <p className="text-xs font-bold text-white mt-0.5 leading-tight">
                        {SESSION_TYPES[day.sessionType].label.split(" ")[0]}
                      </p>
                      <p className="text-xs text-zinc-500">{day.durationMins}′</p>
                      {dayGPS && (
                        <p className="text-xs font-mono text-zinc-400">
                          {(dayGPS.distance / 1000).toFixed(1)}km
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

              {/* Training: session type + duration */}
              {selectedDayData.type === "training" && (
                <>
                  {/* Session type pills */}
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
                </>
              )}

              {/* Match: GPS summary */}
              {selectedDayData.type === "match" && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">
                    Match GPS — {POSITION_DATA[position].label}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {METRICS.map(m => (
                      <div key={m.key} className="bg-zinc-900 border border-green-900/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-zinc-500">{m.label}</p>
                        <p className="text-xs font-mono font-semibold text-green-400 mt-0.5">
                          {matchGPS[m.key].toLocaleString()}{m.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-700 mt-2">
                    Change position above to update match GPS values
                  </p>
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
              vs {multiplier}× {POSITION_DATA[position].label} match load
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

          {/* Metric bars */}
          <div className="space-y-4">
            {METRICS.map(m => {
              const actual = weekGPS[m.key];
              const target = weekTarget[m.key];
              const pct    = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
              const over   = actual >= target && target > 0;
              const matchVal = matchGPS[m.key];
              const matchX = matchVal > 0
                ? (actual / matchVal).toFixed(1) + "×"
                : "—";

              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-400">{m.label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-mono ${over ? "text-green-400" : "text-zinc-300"}`}>
                        ~{actual.toLocaleString()}{m.unit}
                        {" / "}
                        {target.toLocaleString()}{m.unit}
                        {over && <span className="ml-1 text-green-500">✓</span>}
                      </span>
                      <span className="text-xs font-semibold text-green-400 w-16 text-right tabular-nums">
                        {matchX} match
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${over ? "bg-green-400" : m.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
