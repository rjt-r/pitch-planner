"use client";

import { useState, useCallback } from "react";
import FormatSelector from "@/components/FormatSelector";
import ReferencePanel from "@/components/ReferencePanel";
import PitchCanvas from "@/components/PitchCanvas";
import SessionPlanner, { type Drill } from "@/components/SessionPlanner";
import { estimateGPS } from "@/lib/gps-targets";
import type { SeedConfig } from "@/components/ReferencePanel";

function StepHeader({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Drill detail modal ────────────────────────────────────────────────────
type PendingDrill = {
  area: number;
  rpa: number;
  refLabel: string;
};

function DrillModal({
  pending,
  format,
  seed,
  onConfirm,
  onCancel,
}: {
  pending: PendingDrill;
  format: string;
  seed: SeedConfig;
  onConfirm: (drill: Drill) => void;
  onCancel: () => void;
}) {
  const defaultGps = estimateGPS(pending.rpa, 15);
  const [name, setName] = useState(`${format} drill`);
  const [duration, setDuration] = useState(15);
  const [rpe, setRpe] = useState(7);
  const [gps, setGps] = useState(defaultGps);

  // Re-estimate when duration changes
  function handleDuration(d: number) {
    setDuration(d);
    setGps(estimateGPS(pending.rpa, d));
  }

  function handleConfirm() {
    const drill: Drill = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      format,
      rpa: pending.rpa,
      area: pending.area,
      refLabel: pending.refLabel,
      durationMins: duration,
      rpe,
      gps,
    };
    onConfirm(drill);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white">Add drill to session</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            RPA {pending.rpa.toFixed(1)} m²/pl · {pending.area.toFixed(0)} m² · Ref: {pending.refLabel}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Drill name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Duration: <span className="text-white font-semibold">{duration} min</span>
              </label>
              <input
                type="range"
                min={5}
                max={45}
                step={5}
                value={duration}
                onChange={(e) => handleDuration(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-zinc-700 mt-0.5">
                <span>5</span><span>25</span><span>45</span>
              </div>
            </div>

            {/* RPE */}
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                RPE: <span className="text-white font-semibold">{rpe}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-zinc-700 mt-0.5">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>
          </div>

          {/* GPS estimates */}
          <div>
            <p className="text-xs text-zinc-400 mb-2">
              Estimated GPS output{" "}
              <span className="text-zinc-600">(research-based · editable)</span>
            </p>
            <div className="grid grid-cols-5 gap-2">
              {(["distance","hsr","sprint","accels","decels"] as const).map((k) => {
                const labels: Record<string, string> = {
                  distance: "Dist (m)", hsr: "HSR (m)", sprint: "Sprint (m)",
                  accels: "Accels", decels: "Decels",
                };
                return (
                  <div key={k}>
                    <label className="text-xs text-zinc-500 block mb-1 leading-tight">{labels[k]}</label>
                    <input
                      type="number"
                      min={0}
                      value={gps[k]}
                      onChange={(e) => setGps((g) => ({ ...g, [k]: Number(e.target.value) }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-green-600"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors"
          >
            Add drill
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function PitchPlannerPage() {
  const [format, setFormat] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [seed, setSeed] = useState<SeedConfig | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Session planner state
  const [drills, setDrills] = useState<Drill[]>([]);
  const [pendingDrill, setPendingDrill] = useState<PendingDrill | null>(null);

  function handleFormat(f: string) {
    setFormat(f);
    setSelectedKey(null);
    setSeed(null);
  }

  function handleRefSelect(cfg: SeedConfig, key: string) {
    setSeed(cfg);
    setSelectedKey(key);
    setSeedVersion((v) => v + 1);
  }

  const handleAddDrill = useCallback(
    (stats: { area: number; rpa: number; refLabel: string }) => {
      setPendingDrill(stats);
    },
    []
  );

  function handleDrillConfirm(drill: Drill) {
    setDrills((prev) => [...prev, drill]);
    setPendingDrill(null);
  }

  function handleRemoveDrill(id: string) {
    setDrills((prev) => prev.filter((d) => d.id !== id));
  }

  function handleUpdateDrill(id: string, updates: Partial<Drill>) {
    setDrills((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      {/* ── Header ── */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold tracking-tight">Pitch Planner</span>
            <span className="text-xs text-zinc-600 hidden sm:block">
              Women&apos;s football training zone designer
            </span>
          </div>
          {drills.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                {drills.length}
              </span>
              <span className="text-xs text-zinc-400">
                {drills.length === 1 ? "drill" : "drills"} in session
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* ── Hero ── */}
        <div className="bg-gradient-to-br from-green-950/60 to-zinc-900/60 border border-green-900/40 rounded-xl p-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Design your training area
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Pick a game format, choose a reference size based on research, then draw any pitch
            shape. Area and RPA update live as you reshape — then add drills to build a full
            session plan with GPS load estimates.
          </p>
        </div>

        {/* ── Step 1: Format ── */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
          <StepHeader
            n={1}
            title="Select game format"
            subtitle="How many players per side?"
          />
          <FormatSelector selected={format} onSelect={handleFormat} />
        </div>

        {/* ── Step 2: Reference ── */}
        {format && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
            <StepHeader
              n={2}
              title="Choose a reference size"
              subtitle="Click a card to seed the canvas — then reshape it freely"
            />
            <ReferencePanel
              format={format}
              selectedKey={selectedKey}
              onSelect={handleRefSelect}
            />
          </div>
        )}

        {/* ── Step 3: Canvas ── */}
        {format && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">Draw your pitch shape</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {seed
                      ? "Drag the white corner dots to reshape, or click an edge midpoint to add a new point"
                      : "Select a reference above to start from a rectangle, or draw freehand below"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {seed && (
                  <button
                    onClick={() => setSeedVersion((v) => v + 1)}
                    className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-3 py-1.5 rounded transition-colors"
                  >
                    ↺ Reset
                  </button>
                )}
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.target.checked)}
                    className="accent-green-500"
                  />
                  Snap 1m
                </label>
              </div>
            </div>

            {!seed && (
              <div className="border border-dashed border-zinc-700 rounded-lg p-4 text-center text-zinc-500 text-sm mb-4">
                ↑ Select a reference size above to seed the canvas, or click the pitch to draw freehand
              </div>
            )}

            <PitchCanvas
              seed={seed}
              seedVersion={seedVersion}
              snapEnabled={snapEnabled}
              onAddDrill={seed ? handleAddDrill : undefined}
            />
          </div>
        )}

        {/* ── Step 4: Session GPS Planner ── */}
        {format && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
            <StepHeader
              n={4}
              title="Session GPS load planner"
              subtitle="Set a target, add drills from the canvas, and track your session load"
            />
            <SessionPlanner
              drills={drills}
              onRemoveDrill={handleRemoveDrill}
              onUpdateDrill={handleUpdateDrill}
            />
          </div>
        )}

      </div>

      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-700 mt-8">
        Pitch Planner · Based on Riboli et al. (2020) · Built for women&apos;s football coaches
      </footer>

      {/* ── Drill detail modal ── */}
      {pendingDrill && seed && format && (
        <DrillModal
          pending={pendingDrill}
          format={format}
          seed={seed}
          onConfirm={handleDrillConfirm}
          onCancel={() => setPendingDrill(null)}
        />
      )}
    </main>
  );
}
