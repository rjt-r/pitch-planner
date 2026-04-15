"use client";

import { useState } from "react";
import FormatSelector from "@/components/FormatSelector";
import ReferencePanel from "@/components/ReferencePanel";
import PitchCanvas from "@/components/PitchCanvas";
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

export default function PitchPlannerPage() {
  const [format, setFormat] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [seed, setSeed] = useState<SeedConfig | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);

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
            shape — rectangle, circle, star, L-shape. Area and RPA update live as you reshape.
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
            />
          </div>
        )}

      </div>

      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-700 mt-8">
        Pitch Planner · Based on Riboli et al. (2020) · Built for women&apos;s football coaches
      </footer>
    </main>
  );
}
