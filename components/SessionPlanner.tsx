"use client";

import { useState } from "react";
import {
  SESSION_TYPES,
  POSITION_DATA,
  METRICS,
  type GPSEstimate,
} from "@/lib/gps-targets";

export type Drill = {
  id: string;
  name: string;
  format: string;
  rpa: number;
  area: number;
  refLabel: string;
  durationMins: number;
  rpe: number;
  gps: GPSEstimate;
};

interface SessionPlannerProps {
  drills: Drill[];
  onRemoveDrill: (id: string) => void;
  onUpdateDrill: (id: string, updates: Partial<Drill>) => void;
}

function sumGPS(drills: Drill[]): GPSEstimate {
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

function ProgressBar({
  label,
  unit,
  actual,
  target,
  colorClass,
}: {
  label: string;
  unit: string;
  actual: number;
  target: number;
  colorClass: string;
}) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const over = target > 0 && actual > target;
  const barColor = over ? "bg-green-400" : colorClass;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className={`text-xs font-mono ${over ? "text-green-400" : "text-zinc-300"}`}>
          {actual.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
          {over && <span className="ml-1 text-green-500">✓</span>}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SessionPlanner({
  drills,
  onRemoveDrill,
  onUpdateDrill,
}: SessionPlannerProps) {
  const [mode, setMode] = useState<"session" | "position">("session");
  const [sessionKey, setSessionKey] = useState("intensive");
  const [positionKey, setPositionKey] = useState("average");
  const [matchPct, setMatchPct] = useState(60);
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);

  // Compute current targets
  const targets: GPSEstimate =
    mode === "session"
      ? SESSION_TYPES[sessionKey]
      : {
          distance: Math.round(POSITION_DATA[positionKey].distance * (matchPct / 100)),
          hsr:      Math.round(POSITION_DATA[positionKey].hsr      * (matchPct / 100)),
          sprint:   Math.round(POSITION_DATA[positionKey].sprint    * (matchPct / 100)),
          accels:   Math.round(POSITION_DATA[positionKey].accels    * (matchPct / 100)),
          decels:   Math.round(POSITION_DATA[positionKey].decels    * (matchPct / 100)),
        };

  const totals = sumGPS(drills);
  const totalDuration = drills.reduce((s, d) => s + d.durationMins, 0);
  const avgRpe =
    drills.length > 0
      ? Math.round((drills.reduce((s, d) => s + d.rpe, 0) / drills.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-5">
      {/* ── Target mode toggle ── */}
      <div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 w-fit">
        {(["session", "position"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === m
                ? "bg-green-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {m === "session" ? "Session Type" : "Match Load %"}
          </button>
        ))}
      </div>

      {/* ── Target selector ── */}
      {mode === "session" ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Choose the session type to set GPS targets:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(SESSION_TYPES).map(([key, st]) => (
              <button
                key={key}
                onClick={() => setSessionKey(key)}
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  sessionKey === key
                    ? "border-green-600 bg-green-950/50 text-green-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                <span className="font-bold block text-sm leading-tight">{st.label}</span>
                <span className="text-zinc-500 mt-0.5 block">{st.subtitle}</span>
                <span className="text-zinc-600 block mt-1">{st.distance.toLocaleString()}m · RPE {st.rpe}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Choose position and % of match load to target:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(POSITION_DATA).map(([key, pos]) => (
              <button
                key={key}
                onClick={() => setPositionKey(key)}
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  positionKey === key
                    ? "border-green-600 bg-green-950/50 text-green-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                <span className="font-semibold block">{pos.label}</span>
                <span className="text-zinc-600 block mt-0.5">{pos.distance.toLocaleString()}m · {pos.hsr} HSR</span>
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Match load target: <span className="font-bold text-white">{matchPct}%</span></label>
              <span className="text-xs text-zinc-600">{targets.distance.toLocaleString()}m distance</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              step={5}
              value={matchPct}
              onChange={(e) => setMatchPct(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-zinc-700">
              <span>30%</span>
              <span>60%</span>
              <span>90%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bars ── */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Session Running Total</h3>
          <div className="flex gap-4 text-xs text-zinc-600">
            <span>{totalDuration} min</span>
            {avgRpe > 0 && <span>RPE {avgRpe}</span>}
          </div>
        </div>
        {METRICS.map((m) => (
          <ProgressBar
            key={m.key}
            label={m.label}
            unit={m.unit}
            actual={totals[m.key]}
            target={targets[m.key]}
            colorClass={m.color}
          />
        ))}
        {drills.length === 0 && (
          <p className="text-xs text-zinc-600 text-center pt-2">
            Add drills below to see your session GPS totals
          </p>
        )}
      </div>

      {/* ── Drill list ── */}
      {drills.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Drills</h3>
          {drills.map((drill, idx) => {
            const isExpanded = expandedDrill === drill.id;
            return (
              <div
                key={drill.id}
                className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden"
              >
                {/* Drill header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs flex items-center justify-center shrink-0 font-mono">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{drill.name}</p>
                    <p className="text-xs text-zinc-500">
                      {drill.format} · {drill.durationMins} min · RPA {drill.rpa.toFixed(1)} m²/pl · RPE {drill.rpe}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedDrill(isExpanded ? null : drill.id)}
                      className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-2.5 py-1 rounded transition-colors"
                    >
                      {isExpanded ? "Close" : "Edit"}
                    </button>
                    <button
                      onClick={() => onRemoveDrill(drill.id)}
                      className="text-xs border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900 px-2.5 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* GPS summary row */}
                <div className="px-4 pb-3 grid grid-cols-5 gap-2">
                  {METRICS.map((m) => (
                    <div key={m.key} className="text-center">
                      <p className="text-xs text-zinc-600">{m.label}</p>
                      <p className="text-xs font-mono font-semibold text-zinc-300">
                        {drill.gps[m.key].toLocaleString()}{m.unit}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 px-4 py-4 space-y-4 bg-zinc-900/40">
                    {/* Name */}
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Drill name</label>
                      <input
                        type="text"
                        value={drill.name}
                        onChange={(e) => onUpdateDrill(drill.id, { name: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Duration */}
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">
                          Duration: <span className="text-white font-semibold">{drill.durationMins} min</span>
                        </label>
                        <input
                          type="range"
                          min={5}
                          max={45}
                          step={5}
                          value={drill.durationMins}
                          onChange={(e) => onUpdateDrill(drill.id, { durationMins: Number(e.target.value) })}
                          className="w-full accent-green-500"
                        />
                      </div>

                      {/* RPE */}
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">
                          RPE: <span className="text-white font-semibold">{drill.rpe}</span>
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={drill.rpe}
                          onChange={(e) => onUpdateDrill(drill.id, { rpe: Number(e.target.value) })}
                          className="w-full accent-green-500"
                        />
                      </div>
                    </div>

                    {/* GPS overrides */}
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">GPS estimates (editable):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {METRICS.map((m) => (
                          <div key={m.key}>
                            <label className="text-xs text-zinc-500 block mb-1">{m.label} {m.unit}</label>
                            <input
                              type="number"
                              min={0}
                              value={drill.gps[m.key]}
                              onChange={(e) =>
                                onUpdateDrill(drill.id, {
                                  gps: { ...drill.gps, [m.key]: Number(e.target.value) },
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-green-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
