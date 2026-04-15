"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const VIEW_W = 900;  // SVG viewBox width
const VIEW_H = 520;  // SVG viewBox height
const MARGIN = 52;   // pixels around the grid for labels
const GRID_W = VIEW_W - 2 * MARGIN;
const GRID_H = VIEW_H - 2 * MARGIN;

// ── Geometry helpers ───────────────────────────────────────────────────────
type Point = { x: number; y: number }; // always in metres

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

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function snapM(v: number): number {
  return Math.round(v);
}

// ── Types ──────────────────────────────────────────────────────────────────
export type SeedConfig = {
  totalPlayers: number;
  refRpa: number;
  refLabel: string;
  length: number;
  width: number;
};

interface PitchCanvasProps {
  seed: SeedConfig | null;
  seedVersion: number; // increment to re-seed
  snapEnabled: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PitchCanvas({ seed, seedVersion, snapEnabled }: PitchCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vertices, setVertices] = useState<Point[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverVtx, setHoverVtx] = useState<number | null>(null);
  const [hoverMid, setHoverMid] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [history, setHistory] = useState<Point[][]>([]); // for undo

  // Compute scale: viewBox units per metre
  const scale = seed
    ? Math.min(GRID_W / seed.length, GRID_H / seed.width) * 0.88
    : Math.min(GRID_W, GRID_H) / 70;

  // Seed canvas when seedVersion changes
  useEffect(() => {
    if (seed) {
      const rect: Point[] = [
        { x: 0, y: 0 },
        { x: seed.length, y: 0 },
        { x: seed.length, y: seed.width },
        { x: 0, y: seed.width },
      ];
      setVertices(rect);
      setIsClosed(true);
      setHistory([rect]);
      setDraggingIdx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedVersion]);

  // ── Coordinate conversion ─────────────────────────────────────────────
  const toM = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / rect.width) * VIEW_W;
      const svgY = ((clientY - rect.top) / rect.height) * VIEW_H;
      let x = (svgX - MARGIN) / scale;
      let y = (svgY - MARGIN) / scale;
      if (snapEnabled) { x = snapM(x); y = snapM(y); }
      return { x, y };
    },
    [scale, snapEnabled]
  );

  const toPx = useCallback(
    (pt: Point) => ({ px: MARGIN + pt.x * scale, py: MARGIN + pt.y * scale }),
    [scale]
  );

  // ── Undo ──────────────────────────────────────────────────────────────
  function pushHistory(verts: Point[]) {
    setHistory((h) => [...h.slice(-19), verts]);
  }

  function undo() {
    if (history.length <= 1) {
      // Fully clear
      setVertices([]);
      setIsClosed(false);
      setHistory([]);
    } else {
      const prev = history[history.length - 2];
      setVertices(prev);
      setIsClosed(true);
      setHistory((h) => h.slice(0, -1));
    }
  }

  // ── Mouse/touch helpers ───────────────────────────────────────────────
  function clientFromEvent(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  }

  // ── SVG event handlers ────────────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (draggingIdx !== null) return;
    if (isClosed) return;
    const pt = toM(e.clientX, e.clientY);

    // Close polygon if clicking near first vertex
    if (vertices.length >= 3) {
      const fp = toPx(vertices[0]);
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const cy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      const dPx = Math.hypot(cx - fp.px, cy - fp.py);
      if (dPx < 20) {
        setIsClosed(true);
        pushHistory(vertices);
        return;
      }
    }

    const next = [...vertices, pt];
    setVertices(next);
  }

  function handleCanvasDblClick() {
    if (!isClosed && vertices.length >= 3) {
      setIsClosed(true);
      pushHistory(vertices);
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const pt = toM(e.clientX, e.clientY);
    setCursor(pt);
    if (draggingIdx !== null) {
      setVertices((prev) => {
        const next = [...prev];
        next[draggingIdx] = pt;
        return next;
      });
    }
  }

  function handleMouseUp() {
    if (draggingIdx !== null) {
      pushHistory(vertices);
      setDraggingIdx(null);
    }
  }

  function handleVertexPointerDown(e: React.PointerEvent, idx: number) {
    e.stopPropagation();
    if (!isClosed) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
  }

  function handleVertexPointerMove(e: React.PointerEvent, idx: number) {
    if (draggingIdx !== idx) return;
    const pt = toM(e.clientX, e.clientY);
    setVertices((prev) => {
      const next = [...prev];
      next[idx] = pt;
      return next;
    });
  }

  function handleVertexPointerUp(e: React.PointerEvent) {
    if (draggingIdx !== null) {
      pushHistory(vertices);
      setDraggingIdx(null);
    }
  }

  function handleVertexDblClick(e: React.MouseEvent, idx: number) {
    e.stopPropagation();
    if (vertices.length <= 3) return;
    const next = vertices.filter((_, i) => i !== idx);
    setVertices(next);
    pushHistory(next);
  }

  function handleMidClick(e: React.MouseEvent, edgeIdx: number) {
    e.stopPropagation();
    if (!isClosed) return;
    const a = vertices[edgeIdx];
    const b = vertices[(edgeIdx + 1) % vertices.length];
    let m = mid(a, b);
    if (snapEnabled) m = { x: snapM(m.x), y: snapM(m.y) };
    const next = [...vertices];
    next.splice(edgeIdx + 1, 0, m);
    setVertices(next);
    setDraggingIdx(edgeIdx + 1);
    pushHistory(next);
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    e.preventDefault();
    if (draggingIdx === null) return;
    const t = e.touches[0];
    const pt = toM(t.clientX, t.clientY);
    setVertices((prev) => {
      const next = [...prev];
      next[draggingIdx] = pt;
      return next;
    });
  }

  function handleTouchEnd() {
    if (draggingIdx !== null) {
      pushHistory(vertices);
      setDraggingIdx(null);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────
  const area = shoelaceArea(vertices);
  const totalPlayers = seed?.totalPlayers ?? 0;
  const rpa = totalPlayers > 0 ? area / totalPlayers : 0;
  const refRpa = seed?.refRpa ?? 0;
  const dev = refRpa > 0 ? (rpa - refRpa) / refRpa : 0;
  const absDev = Math.abs(dev);
  const devColor = absDev <= 0.1 ? "#4ade80" : absDev <= 0.3 ? "#fbbf24" : "#f87171";
  const devClass = absDev <= 0.1 ? "text-green-400" : absDev <= 0.3 ? "text-amber-400" : "text-red-400";
  const devLabel = absDev <= 0.1 ? "On target" : absDev <= 0.3 ? "Moderate" : "High deviation";

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const bboxL = vertices.length ? +(Math.max(...xs) - Math.min(...xs)).toFixed(1) : 0;
  const bboxW = vertices.length ? +(Math.max(...ys) - Math.min(...ys)).toFixed(1) : 0;

  // ── Grid lines ────────────────────────────────────────────────────────
  const gridStep = scale < 5 ? 20 : scale < 10 ? 10 : 5;
  const maxMX = Math.ceil(GRID_W / scale / gridStep) * gridStep;
  const maxMY = Math.ceil(GRID_H / scale / gridStep) * gridStep;
  const vLines: number[] = [];
  const hLines: number[] = [];
  for (let m = 0; m <= maxMX; m += gridStep) {
    if (MARGIN + m * scale <= VIEW_W - MARGIN + 1) vLines.push(m);
  }
  for (let m = 0; m <= maxMY; m += gridStep) {
    if (MARGIN + m * scale <= VIEW_H - MARGIN + 1) hLines.push(m);
  }

  // ── Polygon points string ─────────────────────────────────────────────
  const ptStr = vertices.map((v) => { const p = toPx(v); return `${p.px},${p.py}`; }).join(" ");

  // ── Preview line (drawing mode) ───────────────────────────────────────
  const lastPx = vertices.length > 0 ? toPx(vertices[vertices.length - 1]) : null;
  const curPx = cursor ? toPx(cursor) : null;

  // ── Scale bar ─────────────────────────────────────────────────────────
  const scaleBarM = scale > 8 ? 10 : scale > 4 ? 20 : 50;
  const scaleBarPx = scaleBarM * scale;

  const showStats = isClosed || vertices.length >= 3;
  const mode = isClosed ? "edit" : "draw";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-mono px-2 py-1 rounded ${mode === "draw" ? "bg-zinc-800 text-zinc-400" : "bg-green-950 text-green-400"}`}>
          {mode === "draw"
            ? vertices.length === 0 ? "Click to start drawing" : `${vertices.length} point${vertices.length !== 1 ? "s" : ""} — click first or double-click to close`
            : `${vertices.length} vertices — drag to reshape · click midpoint to add · double-click vertex to remove`}
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={snapEnabled}
            readOnly
            className="accent-green-500"
          />
          Snap 1m
        </label>
        <button
          onClick={undo}
          disabled={history.length === 0 && vertices.length === 0}
          className="text-xs border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1 rounded transition-colors disabled:opacity-30"
        >
          Undo
        </button>
        <button
          onClick={() => { setVertices([]); setIsClosed(false); setHistory([]); setCursor(null); }}
          className="text-xs border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1 rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="w-full touch-none overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full rounded-xl border border-zinc-800 select-none"
          style={{ background: "#080808", cursor: isClosed ? "default" : "crosshair", minWidth: 320 }}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDblClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setCursor(null); }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Grid vertical lines */}
          {vLines.map((m) => {
            const px = MARGIN + m * scale;
            const isMajor = m % (gridStep * 2) === 0;
            return (
              <g key={`v${m}`}>
                <line x1={px} y1={MARGIN} x2={px} y2={VIEW_H - MARGIN}
                  stroke={isMajor ? "#222" : "#141414"} strokeWidth={isMajor ? 1 : 0.5} />
                {isMajor && m > 0 && (
                  <text x={px} y={VIEW_H - MARGIN + 14} textAnchor="middle"
                    fontSize={9} fill="#3f3f46" fontFamily="monospace">{m}m</text>
                )}
              </g>
            );
          })}

          {/* Grid horizontal lines */}
          {hLines.map((m) => {
            const py = MARGIN + m * scale;
            const isMajor = m % (gridStep * 2) === 0;
            return (
              <g key={`h${m}`}>
                <line x1={MARGIN} y1={py} x2={VIEW_W - MARGIN} y2={py}
                  stroke={isMajor ? "#222" : "#141414"} strokeWidth={isMajor ? 1 : 0.5} />
                {isMajor && m > 0 && (
                  <text x={MARGIN - 4} y={py + 3} textAnchor="end"
                    fontSize={9} fill="#3f3f46" fontFamily="monospace">{m}m</text>
                )}
              </g>
            );
          })}

          {/* Grid border */}
          <rect x={MARGIN} y={MARGIN} width={GRID_W} height={GRID_H}
            fill="none" stroke="#1c1c1c" strokeWidth={1} />

          {/* Polygon (closed) */}
          {vertices.length >= 3 && isClosed && (
            <polygon points={ptStr}
              fill="#15803d1a" stroke="#4ade80" strokeWidth={2} strokeLinejoin="round" />
          )}

          {/* Polyline (drawing in progress) */}
          {!isClosed && vertices.length >= 2 && (
            <polyline points={ptStr}
              fill="none" stroke="#4ade8077" strokeWidth={1.5} strokeDasharray="5 3" />
          )}

          {/* Preview line to cursor */}
          {!isClosed && lastPx && curPx && (
            <line x1={lastPx.px} y1={lastPx.py} x2={curPx.px} y2={curPx.py}
              stroke="#4ade8044" strokeWidth={1.5} strokeDasharray="5 3" />
          )}

          {/* Close-hint ring on first vertex */}
          {!isClosed && vertices.length >= 3 && (() => {
            const fp = toPx(vertices[0]);
            return <circle cx={fp.px} cy={fp.py} r={16}
              fill="#4ade8022" stroke="#4ade8066" strokeWidth={1} strokeDasharray="4 2" />;
          })()}

          {/* Edge midpoints (edit mode only) */}
          {isClosed && vertices.map((v, i) => {
            const nb = vertices[(i + 1) % vertices.length];
            const mp = toPx(mid(v, nb));
            const isH = hoverMid === i;
            return (
              <circle key={`m${i}`}
                cx={mp.px} cy={mp.py} r={isH ? 7 : 4.5}
                fill={isH ? "#3f3f46" : "#1c1c1c"} stroke={isH ? "#71717a" : "#3f3f46"} strokeWidth={1}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverMid(i)}
                onMouseLeave={() => setHoverMid(null)}
                onClick={(e) => handleMidClick(e, i)}
              />
            );
          })}

          {/* Vertices */}
          {vertices.map((v, i) => {
            const p = toPx(v);
            const isFirst = i === 0 && !isClosed;
            const isDrag = draggingIdx === i;
            const isHov = hoverVtx === i;
            const r = isDrag ? 10 : isHov ? 8 : 6;
            const fill = isDrag ? "#fff" : isFirst ? "#4ade80" : isHov ? "#d4d4d4" : "#fff";
            const stroke = isFirst ? "#4ade80" : "#71717a44";
            return (
              <circle key={`v${i}`}
                cx={p.px} cy={p.py} r={r}
                fill={fill} stroke={stroke} strokeWidth={1.5}
                style={{ cursor: isClosed ? (isDrag ? "grabbing" : "grab") : "pointer", touchAction: "none" }}
                onMouseEnter={() => setHoverVtx(i)}
                onMouseLeave={() => setHoverVtx(null)}
                onPointerDown={(e) => handleVertexPointerDown(e, i)}
                onPointerMove={(e) => handleVertexPointerMove(e, i)}
                onPointerUp={handleVertexPointerUp}
                onDoubleClick={(e) => handleVertexDblClick(e, i)}
              />
            );
          })}

          {/* Scale bar */}
          {(() => {
            const bx = MARGIN + 8;
            const by = VIEW_H - 12;
            const bpx = scaleBarPx;
            return (
              <g>
                <line x1={bx} y1={by} x2={bx + bpx} y2={by} stroke="#3f3f46" strokeWidth={1.5} />
                <line x1={bx} y1={by - 3} x2={bx} y2={by + 3} stroke="#3f3f46" strokeWidth={1} />
                <line x1={bx + bpx} y1={by - 3} x2={bx + bpx} y2={by + 3} stroke="#3f3f46" strokeWidth={1} />
                <text x={bx + bpx / 2} y={by - 6} textAnchor="middle"
                  fontSize={9} fill="#3f3f46" fontFamily="monospace">{scaleBarM}m</text>
              </g>
            );
          })()}

          {/* RPA indicator arc on canvas (when shape exists) */}
          {showStats && seed && (
            <g>
              <circle cx={VIEW_W - MARGIN + 20} cy={MARGIN + 16} r={6}
                fill={devColor} opacity={0.9} />
              <text x={VIEW_W - MARGIN + 30} y={MARGIN + 20}
                fontSize={10} fill="#a1a1aa" fontFamily="monospace">
                {rpa.toFixed(1)} m²/pl
              </text>
            </g>
          )}

          {/* Empty state instruction */}
          {vertices.length === 0 && (
            <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle"
              fontSize={14} fill="#3f3f46" fontFamily="sans-serif">
              Click anywhere to place your first vertex
            </text>
          )}
        </svg>
      </div>

      {/* Stats bar */}
      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Area" value={`${area.toFixed(0)} m²`} />
          <Stat label="Length" value={`${bboxL}m`} />
          <Stat label="Width" value={`${bboxW}m`} />
          <Stat label="RPA" value={`${rpa.toFixed(1)} m²/pl`} cls={devClass} />
          {seed && (
            <Stat
              label={`vs ${seed.refLabel}`}
              value={dev === 0 ? "Exact" : `${dev > 0 ? "+" : ""}${(dev * 100).toFixed(0)}%`}
              cls={devClass}
              sub={devLabel}
            />
          )}
        </div>
      )}

      {/* RPA legend */}
      {showStats && seed && (
        <p className="text-xs text-zinc-700">
          Target RPA ({seed.refLabel}): {refRpa.toFixed(1)} m²/player ·{" "}
          <span className="text-green-700">green ≤10%</span> ·{" "}
          <span className="text-amber-700">amber ≤30%</span> ·{" "}
          <span className="text-red-700">red &gt;30%</span>
        </p>
      )}

      {/* RPA explainer */}
      <details className="text-xs text-zinc-600 border border-zinc-900 rounded-lg">
        <summary className="cursor-pointer px-4 py-3 hover:text-zinc-400 transition-colors select-none">
          What is RPA?
        </summary>
        <p className="px-4 pb-3 leading-relaxed">
          Relative Pitch Area (RPA) is total pitch area ÷ number of players. Riboli et al.
          demonstrated that matching SSG RPA to women&apos;s match-level RPA reliably replicates
          physical demands — keeping high-intensity running, accelerations, and sprint distance
          close to competitive match values. Use the indicator to see how far your drawn shape
          strays from the selected reference.
        </p>
      </details>
    </div>
  );
}

// ── Stat box ────────────────────────────────────────────────────────────────
function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="bg-zinc-900 rounded-lg px-3 py-2">
      <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${cls ?? "text-white"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${cls ?? "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}
