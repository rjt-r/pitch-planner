"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const VIEW_W = 900;
const VIEW_H = 520;
const MARGIN = 52;
const GRID_W = VIEW_W - 2 * MARGIN;
const GRID_H = VIEW_H - 2 * MARGIN;

// Grass colours
const GRASS_DARK = "#2a5c1a";
const GRASS_LIGHT = "#306b1f";

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
  seedVersion: number;
  snapEnabled: boolean;
  onAddDrill?: (stats: { area: number; rpa: number; refLabel: string }) => void;
}

// ── Pitch markings (drawn inside the polygon, clipped to its shape) ────────
function PitchMarkings({
  vertices,
  toPx,
}: {
  vertices: Point[];
  toPx: (p: Point) => { px: number; py: number };
}) {
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

  const ptStr = vertices.map((v) => {
    const p = toPx(v);
    return `${p.px},${p.py}`;
  }).join(" ");

  const tl = toPx({ x: minX, y: minY });
  const br = toPx({ x: maxX, y: maxY });
  const bboxWpx = br.px - tl.px;
  const bboxHpx = br.py - tl.py;
  const cx = tl.px + bboxWpx / 2;
  const cy = tl.py + bboxHpx / 2;

  // Proportional pitch feature sizes
  const circleR    = Math.min(bboxWpx, bboxHpx) * 0.17;
  const penDepth   = bboxWpx * 0.13;
  const penWidth   = bboxHpx * 0.55;
  const goalDepth  = bboxWpx * 0.045;
  const goalWidth  = bboxHpx * 0.22;
  const cornerR    = Math.min(bboxWpx, bboxHpx) * 0.045;
  const goalPostW  = Math.max(4, bboxWpx * 0.025);

  return (
    <g>
      <defs>
        <clipPath id="clip-poly">
          <polygon points={ptStr} />
        </clipPath>
      </defs>

      {/* All markings clipped to the polygon shape */}
      <g clipPath="url(#clip-poly)" stroke="white" fill="none" strokeWidth={1.5} opacity={0.6}>
        {/* Halfway line */}
        <line x1={cx} y1={tl.py} x2={cx} y2={br.py} />

        {/* Centre circle */}
        <circle cx={cx} cy={cy} r={circleR} />

        {/* Centre spot */}
        <circle cx={cx} cy={cy} r={3} fill="white" stroke="none" />

        {/* Penalty areas */}
        <rect x={tl.px} y={cy - penWidth / 2} width={penDepth} height={penWidth} />
        <rect x={br.px - penDepth} y={cy - penWidth / 2} width={penDepth} height={penWidth} />

        {/* Goal areas */}
        <rect x={tl.px} y={cy - goalWidth / 2} width={goalDepth} height={goalWidth} />
        <rect x={br.px - goalDepth} y={cy - goalWidth / 2} width={goalDepth} height={goalWidth} />

        {/* Corner arcs */}
        <path d={`M ${tl.px} ${tl.py + cornerR} A ${cornerR} ${cornerR} 0 0 1 ${tl.px + cornerR} ${tl.py}`} />
        <path d={`M ${br.px - cornerR} ${tl.py} A ${cornerR} ${cornerR} 0 0 1 ${br.px} ${tl.py + cornerR}`} />
        <path d={`M ${tl.px} ${br.py - cornerR} A ${cornerR} ${cornerR} 0 0 0 ${tl.px + cornerR} ${br.py}`} />
        <path d={`M ${br.px - cornerR} ${br.py} A ${cornerR} ${cornerR} 0 0 0 ${br.px} ${br.py - cornerR}`} />
      </g>

      {/* Goals — drawn outside the clipPath so they protrude */}
      <g stroke="white" fill="rgba(255,255,255,0.15)" strokeWidth={2} opacity={0.7}>
        <rect
          x={tl.px - goalPostW}
          y={cy - goalWidth / 2}
          width={goalPostW}
          height={goalWidth}
        />
        <rect
          x={br.px}
          y={cy - goalWidth / 2}
          width={goalPostW}
          height={goalWidth}
        />
      </g>
    </g>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PitchCanvas({ seed, seedVersion, snapEnabled, onAddDrill }: PitchCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vertices, setVertices] = useState<Point[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverVtx, setHoverVtx] = useState<number | null>(null);
  const [hoverMid, setHoverMid] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [history, setHistory] = useState<Point[][]>([]);

  const scale = seed
    ? Math.min(GRID_W / seed.length, GRID_H / seed.width) * 0.88
    : Math.min(GRID_W, GRID_H) / 70;

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

  // ── SVG event handlers ────────────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (draggingIdx !== null) return;
    if (isClosed) return;
    const pt = toM(e.clientX, e.clientY);

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

  function handleVertexPointerUp() {
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
  const devColor  = absDev <= 0.1 ? "#4ade80" : absDev <= 0.3 ? "#fbbf24" : "#f87171";
  const devClass  = absDev <= 0.1 ? "text-green-400" : absDev <= 0.3 ? "text-amber-400" : "text-red-400";
  const devLabel  = absDev <= 0.1 ? "On target" : absDev <= 0.3 ? "Moderate" : "High deviation";

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
  const ptStr = vertices.map((v) => {
    const p = toPx(v);
    return `${p.px},${p.py}`;
  }).join(" ");

  // ── Preview line (drawing mode) ───────────────────────────────────────
  const lastPx = vertices.length > 0 ? toPx(vertices[vertices.length - 1]) : null;
  const curPx  = cursor ? toPx(cursor) : null;

  // ── Scale bar ─────────────────────────────────────────────────────────
  const scaleBarM  = scale > 8 ? 10 : scale > 4 ? 20 : 50;
  const scaleBarPx = scaleBarM * scale;

  const showStats = isClosed || vertices.length >= 3;
  const mode = isClosed ? "edit" : "draw";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-zinc-900 rounded-lg px-4 py-2.5 border border-zinc-800">
        {/* Mode badge */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
          mode === "draw"
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
            : "bg-green-500/15 text-green-400 border border-green-500/30"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
          {mode === "draw" ? "Drawing" : "Editing"}
        </span>

        {/* Context hint */}
        <span className="text-xs text-zinc-500 hidden sm:block">
          {mode === "draw"
            ? vertices.length === 0
              ? "Click the pitch to place your first point"
              : `${vertices.length} point${vertices.length !== 1 ? "s" : ""} — click start point or double-click to close`
            : "Drag corners to reshape · click edge midpoints to add points · double-click a point to remove"}
        </span>

        <div className="flex-1" />

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={snapEnabled} readOnly className="accent-green-500" />
          Snap 1m
        </label>
        <button
          onClick={undo}
          disabled={history.length === 0 && vertices.length === 0}
          className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-3 py-1 rounded transition-colors disabled:opacity-30"
        >
          Undo
        </button>
        <button
          onClick={() => { setVertices([]); setIsClosed(false); setHistory([]); setCursor(null); }}
          className="text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-3 py-1 rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="w-full touch-none overflow-x-auto rounded-xl overflow-hidden shadow-2xl">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full select-none block"
          style={{ cursor: isClosed ? "default" : "crosshair", minWidth: 320 }}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDblClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setCursor(null); }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <defs>
            {/* Grass stripe pattern */}
            <pattern id="grass" x="0" y="0" width="900" height="56" patternUnits="userSpaceOnUse">
              <rect width="900" height="28" fill={GRASS_DARK} />
              <rect y="28" width="900" height="28" fill={GRASS_LIGHT} />
            </pattern>
          </defs>

          {/* ── Background: green grass ── */}
          <rect width={VIEW_W} height={VIEW_H} fill={GRASS_DARK} />
          <rect x={MARGIN} y={MARGIN} width={GRID_W} height={GRID_H} fill="url(#grass)" />

          {/* ── Grid lines (white, faint) ── */}
          {vLines.map((m) => {
            const px = MARGIN + m * scale;
            const isMajor = m % (gridStep * 2) === 0;
            return (
              <g key={`v${m}`}>
                <line
                  x1={px} y1={MARGIN} x2={px} y2={VIEW_H - MARGIN}
                  stroke="white"
                  strokeOpacity={isMajor ? 0.18 : 0.07}
                  strokeWidth={isMajor ? 0.8 : 0.5}
                />
                {isMajor && m > 0 && (
                  <text x={px} y={VIEW_H - MARGIN + 16}
                    textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.35)" fontFamily="monospace">
                    {m}m
                  </text>
                )}
              </g>
            );
          })}

          {hLines.map((m) => {
            const py = MARGIN + m * scale;
            const isMajor = m % (gridStep * 2) === 0;
            return (
              <g key={`h${m}`}>
                <line
                  x1={MARGIN} y1={py} x2={VIEW_W - MARGIN} y2={py}
                  stroke="white"
                  strokeOpacity={isMajor ? 0.18 : 0.07}
                  strokeWidth={isMajor ? 0.8 : 0.5}
                />
                {isMajor && m > 0 && (
                  <text x={MARGIN - 6} y={py + 4}
                    textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.35)" fontFamily="monospace">
                    {m}m
                  </text>
                )}
              </g>
            );
          })}

          {/* Grid border */}
          <rect
            x={MARGIN} y={MARGIN} width={GRID_W} height={GRID_H}
            fill="none" stroke="white" strokeOpacity={0.25} strokeWidth={1}
          />

          {/* ── Closed polygon with pitch markings ── */}
          {vertices.length >= 3 && isClosed && (
            <>
              {/* Zone fill */}
              <polygon
                points={ptStr}
                fill="rgba(255,255,255,0.06)"
                stroke="white"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {/* Pitch markings inside the zone */}
              <PitchMarkings vertices={vertices} toPx={toPx} />
            </>
          )}

          {/* ── Polyline (drawing in progress) ── */}
          {!isClosed && vertices.length >= 2 && (
            <polyline
              points={ptStr}
              fill="none"
              stroke="white"
              strokeOpacity={0.6}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          )}

          {/* Preview line to cursor */}
          {!isClosed && lastPx && curPx && (
            <line
              x1={lastPx.px} y1={lastPx.py} x2={curPx.px} y2={curPx.py}
              stroke="white" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="5 4"
            />
          )}

          {/* Close-hint ring on first vertex */}
          {!isClosed && vertices.length >= 3 && (() => {
            const fp = toPx(vertices[0]);
            return (
              <circle
                cx={fp.px} cy={fp.py} r={18}
                fill="rgba(255,255,255,0.08)"
                stroke="white" strokeOpacity={0.4}
                strokeWidth={1} strokeDasharray="4 3"
              />
            );
          })()}

          {/* ── Edge midpoints (edit mode) ── */}
          {isClosed && vertices.map((v, i) => {
            const nb = vertices[(i + 1) % vertices.length];
            const mp = toPx(mid(v, nb));
            const isH = hoverMid === i;
            return (
              <circle key={`m${i}`}
                cx={mp.px} cy={mp.py} r={isH ? 7 : 5}
                fill={isH ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}
                stroke="white" strokeOpacity={0.5} strokeWidth={1}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverMid(i)}
                onMouseLeave={() => setHoverMid(null)}
                onClick={(e) => handleMidClick(e, i)}
              />
            );
          })}

          {/* ── Vertices ── */}
          {vertices.map((v, i) => {
            const p     = toPx(v);
            const isFirst = i === 0 && !isClosed;
            const isDrag  = draggingIdx === i;
            const isHov   = hoverVtx === i;
            const r     = isDrag ? 10 : isHov ? 8 : 7;
            const fill  = isFirst ? "#86efac" : "#ffffff";
            const strokeC = isDrag ? "#4ade80" : isFirst ? "#4ade80" : "rgba(255,255,255,0.5)";
            return (
              <circle key={`v${i}`}
                cx={p.px} cy={p.py} r={r}
                fill={fill} stroke={strokeC} strokeWidth={2}
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

          {/* ── Scale bar ── */}
          {(() => {
            const bx = MARGIN + 10;
            const by = VIEW_H - 10;
            return (
              <g>
                <line x1={bx} y1={by} x2={bx + scaleBarPx} y2={by}
                  stroke="white" strokeOpacity={0.5} strokeWidth={1.5} />
                <line x1={bx} y1={by - 4} x2={bx} y2={by + 4}
                  stroke="white" strokeOpacity={0.5} strokeWidth={1} />
                <line x1={bx + scaleBarPx} y1={by - 4} x2={bx + scaleBarPx} y2={by + 4}
                  stroke="white" strokeOpacity={0.5} strokeWidth={1} />
                <text x={bx + scaleBarPx / 2} y={by - 7}
                  textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.45)" fontFamily="monospace">
                  {scaleBarM}m
                </text>
              </g>
            );
          })()}

          {/* ── RPA indicator (top-right) ── */}
          {showStats && seed && (
            <g>
              <rect
                x={VIEW_W - MARGIN - 88} y={MARGIN + 8}
                width={86} height={24} rx={12}
                fill="rgba(0,0,0,0.45)"
              />
              <circle cx={VIEW_W - MARGIN - 76} cy={MARGIN + 20} r={5} fill={devColor} />
              <text x={VIEW_W - MARGIN - 67} y={MARGIN + 24}
                fontSize={10} fill="rgba(255,255,255,0.85)" fontFamily="monospace">
                {rpa.toFixed(1)} m²/pl
              </text>
            </g>
          )}

          {/* ── Empty state ── */}
          {vertices.length === 0 && (
            <g>
              <text x={VIEW_W / 2} y={VIEW_H / 2 - 10}
                textAnchor="middle" fontSize={15} fill="rgba(255,255,255,0.35)" fontFamily="sans-serif">
                Click anywhere on the pitch
              </text>
              <text x={VIEW_W / 2} y={VIEW_H / 2 + 12}
                textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.2)" fontFamily="sans-serif">
                to start drawing your training zone
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── Stats bar ── */}
      {showStats && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Area"   value={`${area.toFixed(0)} m²`} />
            <Stat label="Length" value={`${bboxL}m`} />
            <Stat label="Width"  value={`${bboxW}m`} />
            <Stat label="RPA"    value={`${rpa.toFixed(1)} m²/pl`} cls={devClass} />
            {seed && (
              <Stat
                label={`vs ${seed.refLabel}`}
                value={dev === 0 ? "Exact" : `${dev > 0 ? "+" : ""}${(dev * 100).toFixed(0)}%`}
                cls={devClass}
                sub={devLabel}
              />
            )}
          </div>
          {isClosed && seed && onAddDrill && (
            <button
              onClick={() => onAddDrill({ area, rpa, refLabel: seed.refLabel })}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <span>＋</span> Add to session
            </button>
          )}
        </div>
      )}

      {/* ── RPA legend ── */}
      {showStats && seed && (
        <p className="text-xs text-zinc-600">
          Target RPA ({seed.refLabel}): <span className="text-zinc-400">{refRpa.toFixed(1)} m²/player</span>
          {" · "}
          <span className="text-green-600">●</span> ≤10%
          {" · "}
          <span className="text-amber-600">●</span> ≤30%
          {" · "}
          <span className="text-red-600">●</span> &gt;30%
        </p>
      )}

      {/* ── RPA explainer ── */}
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
function Stat({ label, value, cls, sub }: {
  label: string;
  value: string;
  cls?: string;
  sub?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-base font-bold ${cls ?? "text-white"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${cls ?? "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}
