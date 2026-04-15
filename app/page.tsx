"use client";

import { useState } from "react";
import FormatSelector from "@/components/FormatSelector";
import ReferencePanel from "@/components/ReferencePanel";
import PitchCanvas from "@/components/PitchCanvas";
import type { SeedConfig } from "@/components/ReferencePanel";

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
    setSeedVersion((v) => v + 1); // re-seed canvas
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-green-600 uppercase mb-2">
            Pitch Planner
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Design your training area
          </h1>
          <p className="text-zinc-400 mt-2 max-w-xl">
            Pick a game format and reference size, then draw any pitch shape — rectangle, circle,
            star, L-shape. Area and RPA update live as you reshape.
          </p>
        </div>

        <div className="space-y-8">
          {/* Format selector */}
          <FormatSelector selected={format} onSelect={handleFormat} />

          {/* Reference panels */}
          {format && (
            <ReferencePanel
              format={format}
              selectedKey={selectedKey}
              onSelect={handleRefSelect}
            />
          )}

          {/* Canvas — shown once a reference is selected, or always if format chosen */}
          {format && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase">
                  Step 3 — Draw your pitch shape
                </p>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.target.checked)}
                    className="accent-green-500"
                  />
                  Snap to 1m grid
                </label>
              </div>

              {!seed && (
                <div className="border border-dashed border-zinc-800 rounded-xl p-6 text-center text-zinc-600 text-sm mb-3">
                  Select a reference size above to seed the canvas with a starting rectangle,
                  or{" "}
                  <button
                    onClick={() => setSeed(null)}
                    className="text-zinc-400 underline hover:text-white transition-colors"
                  >
                    draw freehand
                  </button>{" "}
                  below.
                </div>
              )}

              <PitchCanvas
                seed={seed}
                seedVersion={seedVersion}
                snapEnabled={snapEnabled}
              />

              {seed && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => setSeedVersion((v) => v + 1)}
                    className="text-xs border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded transition-colors"
                  >
                    ↺ Reset to {seed.refLabel}
                  </button>
                  <button
                    onClick={() => { setSeed(null); setSelectedKey(null); }}
                    className="text-xs border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Draw freehand
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
