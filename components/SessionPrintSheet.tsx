"use client";

// ── Session print sheet ────────────────────────────────────────────────────
// A print-only, one-page session plan: pitch drawing, drills, and GPS load
// summary. Hidden on screen (see globals.css); window.print() turns it into
// the coach's shareable PDF. Light colours on white — ink-friendly.

import { METRICS, type GPSEstimate } from "@/lib/gps-targets";
import type { Drill } from "@/components/SessionPlanner";
import type { SeedConfig } from "@/components/ReferencePanel";

type Point = { x: number; y: number };

function shoelaceArea(pts: Point[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

// ── Pitch drawing (print-friendly rework of the canvas polygon) ────────────
function PrintPitch({ vertices }: { vertices: Point[] }) {
  if (vertices.length < 3) return null;

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const L = maxX - minX;
  const W = maxY - minY;
  if (L <= 0 || W <= 0) return null;

  // Fit into a fixed viewBox with margin for dimension labels
  const VIEW_W = 420;
  const VIEW_H = 300;
  const M = 34;
  const scale = Math.min((VIEW_W - 2 * M) / L, (VIEW_H - 2 * M) / W);
  const toPx = (p: Point) => ({
    px: M + (p.x - minX) * scale,
    py: M + (p.y - minY) * scale,
  });

  const ptStr = vertices
    .map((v) => {
      const p = toPx(v);
      return `${p.px},${p.py}`;
    })
    .join(" ");

  const tl = toPx({ x: minX, y: minY });
  const br = toPx({ x: maxX, y: maxY });

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Training pitch shape"
    >
      {/* Polygon */}
      <polygon
        points={ptStr}
        fill="#16a34a"
        fillOpacity={0.12}
        stroke="#15803d"
        strokeWidth={2}
      />
      {/* Vertices */}
      {vertices.map((v, i) => {
        const p = toPx(v);
        return <circle key={i} cx={p.px} cy={p.py} r={3} fill="#15803d" />;
      })}
      {/* Length label (top) */}
      <text
        x={(tl.px + br.px) / 2}
        y={tl.py - 10}
        textAnchor="middle"
        fontSize={12}
        fill="#3f3f46"
      >
        {Math.round(L)}m
      </text>
      {/* Width label (left, rotated) */}
      <text
        x={tl.px - 10}
        y={(tl.py + br.py) / 2}
        textAnchor="middle"
        fontSize={12}
        fill="#3f3f46"
        transform={`rotate(-90 ${tl.px - 10} ${(tl.py + br.py) / 2})`}
      >
        {Math.round(W)}m
      </text>
    </svg>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────
export default function SessionPrintSheet({
  format,
  seed,
  vertices,
  drills,
  totals,
  targets,
  targetLabel,
}: {
  format: string | null;
  seed: SeedConfig | null;
  vertices: Point[];
  drills: Drill[];
  totals: GPSEstimate | null;
  targets: GPSEstimate | null;
  targetLabel: string | null;
}) {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const area = shoelaceArea(vertices);
  const rpa = seed && seed.totalPlayers > 0 ? area / seed.totalPlayers : null;
  const totalMins = drills.reduce((s, d) => s + d.durationMins, 0);
  const avgRpe =
    drills.length > 0
      ? Math.round((drills.reduce((s, d) => s + d.rpe, 0) / drills.length) * 10) / 10
      : 0;

  const pct = (a: number, t: number) =>
    t > 0 ? `${Math.round((a / t) * 100)}%` : "—";

  return (
    <div id="session-print-sheet" className="bg-white text-zinc-900">
      <div className="p-2">
        {/* ── Header ── */}
        <div className="flex items-end justify-between border-b-2 border-green-700 pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Session Plan</h1>
            <p className="text-sm text-zinc-600 mt-0.5">{date}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-700">Pitch Planner</p>
            {format && (
              <p className="text-sm text-zinc-600">
                {format}
                {seed ? ` · ref ${seed.refLabel}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* ── Pitch + stats ── */}
        {vertices.length >= 3 && (
          <div className="flex gap-6 mb-4">
            <div className="w-[55%] border border-zinc-300 rounded-lg p-2">
              <PrintPitch vertices={vertices} />
            </div>
            <div className="flex-1 space-y-2 self-center">
              {[
                { label: "Area", value: `${area.toFixed(0)} m²` },
                rpa !== null
                  ? { label: "RPA", value: `${rpa.toFixed(1)} m² / player` }
                  : null,
                seed
                  ? {
                      label: `Reference (${seed.refLabel})`,
                      value: `${seed.length} × ${seed.width} m · ${seed.refRpa.toFixed(1)} m²/pl`,
                    }
                  : null,
                { label: "Session time", value: `${totalMins} min · avg RPE ${avgRpe}` },
              ]
                .filter((r): r is { label: string; value: string } => r !== null)
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between border-b border-zinc-200 pb-1.5"
                  >
                    <span className="text-sm text-zinc-500">{row.label}</span>
                    <span className="text-sm font-semibold">{row.value}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Drills table ── */}
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-zinc-400 text-left">
              <th className="py-1.5 pr-2 font-semibold">#</th>
              <th className="py-1.5 pr-2 font-semibold">Drill</th>
              <th className="py-1.5 pr-2 font-semibold">Min</th>
              <th className="py-1.5 pr-2 font-semibold">RPE</th>
              <th className="py-1.5 pr-2 font-semibold">RPA</th>
              <th className="py-1.5 pr-2 font-semibold text-right">Dist</th>
              <th className="py-1.5 pr-2 font-semibold text-right">HSR</th>
              <th className="py-1.5 pr-2 font-semibold text-right">Sprint</th>
              <th className="py-1.5 pr-2 font-semibold text-right">Acc</th>
              <th className="py-1.5 font-semibold text-right">Dec</th>
            </tr>
          </thead>
          <tbody>
            {drills.map((d, i) => (
              <tr key={d.id} className="border-b border-zinc-200">
                <td className="py-1.5 pr-2 text-zinc-500">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{d.name}</td>
                <td className="py-1.5 pr-2">{d.durationMins}</td>
                <td className="py-1.5 pr-2">{d.rpe}</td>
                <td className="py-1.5 pr-2">{d.rpa.toFixed(1)}</td>
                <td className="py-1.5 pr-2 text-right">~{d.gps.distance.toLocaleString()}m</td>
                <td className="py-1.5 pr-2 text-right">~{d.gps.hsr}m</td>
                <td className="py-1.5 pr-2 text-right">~{d.gps.sprint}m</td>
                <td className="py-1.5 pr-2 text-right">~{d.gps.accels}</td>
                <td className="py-1.5 text-right">~{d.gps.decels}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Load summary ── */}
        {totals && targets && (
          <div className="border border-zinc-300 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Session load vs target
              </h2>
              {targetLabel && (
                <span className="text-xs text-zinc-500">{targetLabel}</span>
              )}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-300 text-left">
                  <th className="py-1 pr-2 font-semibold"></th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="py-1 pr-2 font-semibold text-right">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-200">
                  <td className="py-1 pr-2 text-zinc-500">Planned</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-1 pr-2 text-right font-medium">
                      ~{totals[m.key].toLocaleString()}
                      {m.unit}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-200">
                  <td className="py-1 pr-2 text-zinc-500">Target</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-1 pr-2 text-right">
                      {targets[m.key] > 0
                        ? `${targets[m.key].toLocaleString()}${m.unit}`
                        : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-zinc-500">% of target</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-1 pr-2 text-right font-semibold">
                      {pct(totals[m.key], targets[m.key])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="text-xs text-zinc-500">
          GPS estimates are research-based approximations (±15–40% variability with
          player work rate). Based on Riboli et al. (2020). Made with Pitch Planner.
        </p>
      </div>
    </div>
  );
}
