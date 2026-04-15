"use client";

import { useState, useEffect } from "react";
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
  /** Fires whenever totals or targets change — used by parent to drive sticky bar */
  onTotalsChange?: (totals: GPSEstimate, targets: GPSEstimate) => void;
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
  zeroNote,
}: {
  label: string;
  unit: string;
  actual: number;
  target: number;
  colorClass: string;
  zeroNote?: string; // shown when target === 0 instead of a bar
}) {
  // When target is 0 (e.g. Sprint in SSG sessions), show an explanatory note
  if (target === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-zinc-500">{label}</span>
          <span className="text-xs text-zinc-600 italic">{zeroNote ?? "not targeted"}</span>
        </div>
        <div className="h-2 bg-zinc-800/50 rounded-full" />
      </div>
    );
  }

  const pct = Math.min(100, (actual / target) * 100);
  const over = actual >= target;
  const barColor = over ? "bg-green-400" : colorClass;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className={`text-xs font-mono ${over ? "text-green-400" : "text-zinc-300"}`}>
          ~{actual.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
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

// ── Export helpers ────────────────────────────────────────────────────────
function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function targetLabel(
  mode: "session" | "position",
  sessionKey: string,
  positionKey: string,
  matchPct: number,
  targets: GPSEstimate
): string {
  if (mode === "session") {
    const st = SESSION_TYPES[sessionKey];
    return `${st.label} · ${targets.distance.toLocaleString()}m dist · ${targets.hsr}m HSR · ${targets.accels} Acc / ${targets.decels} Dec`;
  }
  const pos = POSITION_DATA[positionKey];
  return `${pos.label} @ ${matchPct}% · ${targets.distance.toLocaleString()}m dist · ${targets.hsr}m HSR`;
}

function buildClipboardText(
  drills: Drill[],
  targets: GPSEstimate,
  totals: GPSEstimate,
  mode: "session" | "position",
  sessionKey: string,
  positionKey: string,
  matchPct: number
): string {
  const lines: string[] = [
    `SESSION PLAN — ${formatDate()}`,
    `Target: ${targetLabel(mode, sessionKey, positionKey, matchPct, targets)}`,
    "",
  ];

  drills.forEach((d, i) => {
    lines.push(
      `${i + 1}. ${d.name} · ${d.durationMins} min · RPE ${d.rpe} · RPA ${d.rpa.toFixed(1)} m²/pl`,
      `   ~${d.gps.distance.toLocaleString()}m dist · ~${d.gps.hsr}m HSR · ~${d.gps.sprint}m sprint · ~${d.gps.accels} acc · ~${d.gps.decels} dec`,
      ""
    );
  });

  const pct = (a: number, t: number) =>
    t > 0 ? ` (${Math.round((a / t) * 100)}%)` : "";

  lines.push(
    `TOTALS`,
    `  Distance: ~${totals.distance.toLocaleString()}m / ${targets.distance.toLocaleString()}m${pct(totals.distance, targets.distance)}`,
    `  HSR:      ~${totals.hsr}m / ${targets.hsr}m${pct(totals.hsr, targets.hsr)}`,
    `  Sprint:   ~${totals.sprint}m / ${targets.sprint}m${pct(totals.sprint, targets.sprint)}`,
    `  Accels:   ~${totals.accels} / ${targets.accels}${pct(totals.accels, targets.accels)}`,
    `  Decels:   ~${totals.decels} / ${targets.decels}${pct(totals.decels, targets.decels)}`,
    "",
    "GPS estimates are research-based approximations (±15–40% variability)"
  );

  return lines.join("\n");
}

function buildCSV(
  drills: Drill[],
  targets: GPSEstimate,
  totals: GPSEstimate,
  mode: "session" | "position",
  sessionKey: string,
  positionKey: string,
  matchPct: number
): string {
  const label = mode === "session"
    ? SESSION_TYPES[sessionKey].label
    : `${POSITION_DATA[positionKey].label} @ ${matchPct}%`;

  const rows: string[][] = [
    ["Session Plan", formatDate(), "", "", "", "", "", "", "", ""],
    ["Target", label, "", "", String(targets.distance), String(targets.hsr), String(targets.sprint), String(targets.accels), String(targets.decels), ""],
    [],
    ["#", "Name", "Format", "Duration (min)", "RPA (m\u00b2/pl)", "Distance (m)", "HSR (m)", "Sprint (m)", "Accels", "Decels", "RPE"],
    ...drills.map((d, i) => [
      String(i + 1), d.name, d.format, String(d.durationMins), d.rpa.toFixed(1),
      String(d.gps.distance), String(d.gps.hsr), String(d.gps.sprint),
      String(d.gps.accels), String(d.gps.decels), String(d.rpe),
    ]),
    [],
    ["TOTALS", "", "", String(drills.reduce((s, d) => s + d.durationMins, 0)), "",
      String(totals.distance), String(totals.hsr), String(totals.sprint),
      String(totals.accels), String(totals.decels), ""],
    [],
    ["Note: GPS values are research-based approximations (±15-40% variability)"],
  ];

  return rows
    .map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))
    .join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────
export default function SessionPlanner({
  drills,
  onRemoveDrill,
  onUpdateDrill,
  onTotalsChange,
}: SessionPlannerProps) {
  const [mode, setMode] = useState<"session" | "position">("session");
  const [sessionKey, setSessionKey] = useState("intensive");
  const [positionKey, setPositionKey] = useState("average");
  const [matchPct, setMatchPct] = useState(60);
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Editable targets: per-sessionKey overrides on top of SESSION_TYPES defaults ──
  const [customOverrides, setCustomOverrides] = useState<
    Record<string, Partial<GPSEstimate>>
  >({});
  const [editingTarget, setEditingTarget] = useState(false);

  // Effective targets for current selection
  const baseSessionTarget = SESSION_TYPES[sessionKey];
  const overrides = customOverrides[sessionKey] ?? {};
  const effectiveSessionTarget: GPSEstimate = {
    distance: overrides.distance ?? baseSessionTarget.distance,
    hsr:      overrides.hsr      ?? baseSessionTarget.hsr,
    sprint:   overrides.sprint   ?? baseSessionTarget.sprint,
    accels:   overrides.accels   ?? baseSessionTarget.accels,
    decels:   overrides.decels   ?? baseSessionTarget.decels,
  };

  const targets: GPSEstimate =
    mode === "session"
      ? effectiveSessionTarget
      : {
          distance: Math.round(POSITION_DATA[positionKey].distance * (matchPct / 100)),
          hsr:      Math.round(POSITION_DATA[positionKey].hsr      * (matchPct / 100)),
          sprint:   Math.round(POSITION_DATA[positionKey].sprint   * (matchPct / 100)),
          accels:   Math.round(POSITION_DATA[positionKey].accels   * (matchPct / 100)),
          decels:   Math.round(POSITION_DATA[positionKey].decels   * (matchPct / 100)),
        };

  const totals = sumGPS(drills);
  const totalDuration = drills.reduce((s, d) => s + d.durationMins, 0);
  const avgRpe =
    drills.length > 0
      ? Math.round((drills.reduce((s, d) => s + d.rpe, 0) / drills.length) * 10) / 10
      : 0;

  // Notify parent of totals/targets whenever they change
  useEffect(() => {
    onTotalsChange?.(totals, targets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drills, targets.distance, targets.hsr, targets.sprint, targets.accels, targets.decels]);

  function setOverride(k: keyof GPSEstimate, val: number) {
    setCustomOverrides((prev) => ({
      ...prev,
      [sessionKey]: { ...(prev[sessionKey] ?? {}), [k]: val },
    }));
  }

  function resetOverrides() {
    setCustomOverrides((prev) => {
      const next = { ...prev };
      delete next[sessionKey];
      return next;
    });
  }

  const hasOverride = Object.keys(customOverrides[sessionKey] ?? {}).length > 0;

  function handleCopy() {
    const text = buildClipboardText(drills, targets, totals, mode, sessionKey, positionKey, matchPct);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCSV() {
    const csv = buildCSV(drills, targets, totals, mode, sessionKey, positionKey, matchPct);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-plan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ── Target mode toggle ── */}
      <div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 w-fit">
        {(["session", "position"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setEditingTarget(false); }}
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
            {Object.entries(SESSION_TYPES).map(([key, st]) => {
              const isSelected = sessionKey === key;
              const ov = customOverrides[key] ?? {};
              const isCustomised = Object.keys(ov).length > 0;
              return (
                <div key={key} className="relative">
                  <button
                    onClick={() => { setSessionKey(key); setEditingTarget(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                      isSelected
                        ? "border-green-600 bg-green-950/50 text-green-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    <span className="font-bold block text-sm leading-tight pr-6">{st.label}</span>
                    <span className="text-zinc-500 mt-0.5 block">{st.subtitle}</span>
                    <span className="text-zinc-600 block mt-1">
                      {(ov.distance ?? st.distance).toLocaleString()}m · RPE {st.rpe}
                    </span>
                  </button>
                  {/* ✎ customise icon — always visible on card, prominent on selected */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionKey(key);
                      setEditingTarget((v) => sessionKey === key ? !v : true);
                    }}
                    title="Customise targets for your squad"
                    className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded transition-colors text-xs ${
                      isCustomised
                        ? "text-amber-400 bg-amber-500/15 border border-amber-500/30"
                        : isSelected
                        ? "text-zinc-400 hover:text-white hover:bg-zinc-700"
                        : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    ✎
                  </button>
                </div>
              );
            })}
          </div>

          {editingTarget && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400 font-medium">
                  {SESSION_TYPES[sessionKey].label} targets{" "}
                  <span className="text-zinc-600 font-normal">— edit for your squad</span>
                </p>
                {hasOverride && (
                  <button
                    onClick={resetOverrides}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    Reset to defaults
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {METRICS.map((m) => {
                  const defaultVal = baseSessionTarget[m.key];
                  const currentVal = effectiveSessionTarget[m.key];
                  const isEdited = currentVal !== defaultVal;
                  return (
                    <div key={m.key}>
                      <label className="text-xs text-zinc-500 block mb-1">
                        {m.label}{m.unit ? ` (${m.unit})` : ""}
                        {isEdited && (
                          <span className="ml-1 text-amber-600 text-xs">✎</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={currentVal}
                        onChange={(e) => setOverride(m.key, Number(e.target.value))}
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
            </div>
          )}
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
              <label className="text-xs text-zinc-400">
                Match load target: <span className="font-bold text-white">{matchPct}%</span>
              </label>
              <span className="text-xs text-zinc-600">{targets.distance.toLocaleString()}m distance</span>
            </div>
            <input
              type="range" min={30} max={90} step={5} value={matchPct}
              onChange={(e) => setMatchPct(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-zinc-700">
              <span>30%</span><span>60%</span><span>90%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bars ── */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3" id="session-totals">
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
            zeroNote={
              m.key === "sprint" && targets[m.key] === 0
                ? "not targeted in tight spaces — use Extensive or Match Load %"
                : undefined
            }
          />
        ))}
        {drills.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center pt-2">
            Add drills from the canvas above to see your session GPS totals
          </p>
        ) : (
          <p className="text-xs text-zinc-700 pt-1">
            GPS estimates are research-based approximations (±15–40%). Edit any value in the drill to override.
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
              <div key={drill.id} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
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
                        ~{drill.gps[m.key].toLocaleString()}{m.unit}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 px-4 py-4 space-y-4 bg-zinc-900/40">
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
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">
                          Duration: <span className="text-white font-semibold">{drill.durationMins} min</span>
                        </label>
                        <input
                          type="range" min={5} max={45} step={5} value={drill.durationMins}
                          onChange={(e) => onUpdateDrill(drill.id, { durationMins: Number(e.target.value) })}
                          className="w-full accent-green-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">
                          RPE: <span className="text-white font-semibold">{drill.rpe}</span>
                        </label>
                        <input
                          type="range" min={1} max={10} step={1} value={drill.rpe}
                          onChange={(e) => onUpdateDrill(drill.id, { rpe: Number(e.target.value) })}
                          className="w-full accent-green-500"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">GPS estimates (editable):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {METRICS.map((m) => (
                          <div key={m.key}>
                            <label className="text-xs text-zinc-500 block mb-1">{m.label}{m.unit ? ` (${m.unit})` : ""}</label>
                            <input
                              type="number" min={0} value={drill.gps[m.key]}
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

      {/* ── Export bar — always visible; buttons disabled until drills are added ── */}
      <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
        <span className="text-xs text-zinc-600 flex-1">
          {drills.length === 0
            ? "Export (add drills to unlock)"
            : "Export session plan"}
        </span>
        <button
          disabled={drills.length === 0}
          onClick={handleCopy}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            drills.length === 0
              ? "border-zinc-800 text-zinc-700 cursor-not-allowed"
              : copied
              ? "border-green-700 bg-green-950 text-green-400"
              : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
          }`}
        >
          {copied ? "Copied!" : "Copy text"}
        </button>
        <button
          disabled={drills.length === 0}
          onClick={handleCSV}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            drills.length === 0
              ? "border-zinc-800 text-zinc-700 cursor-not-allowed"
              : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
          }`}
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
