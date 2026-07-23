// ── Load bands — planned load vs target classification ────────────────────
// One shared rule set for every target bar in the app (session totals,
// sticky bar, weekly forecast, print sheet, text exports), mirroring the
// RPA traffic-light convention coaches already know from the canvas panel.
//
// Normal session types:  90–110% green · ≤+30% amber · >+30% red
// Strict (MD-1 / MD-2):  target is a ceiling — any overshoot is amber,
//                        red beyond +15%
// flagUnder (Week page): a finished plan below 90% gets an "under" cue;
//                        the Session page stays neutral while drills are
//                        still being added.

export type LoadBand = "on" | "amber" | "red" | "under" | "none";

export type BandOptions = {
  /** MD-1/MD-2 recovery & match-prep: overshoot flags immediately */
  strict?: boolean;
  /** Flag <90% as underloaded (Week page — a week plan is a finished artefact) */
  flagUnder?: boolean;
};

export type BandResult = {
  band: LoadBand;
  /** Rounded % of target (0 when no target) */
  pct: number;
  /** Human cue, e.g. "✓ on target", "+18% over", "−14% under". Empty when neutral. */
  label: string;
};

export function loadBand(
  actual: number,
  target: number,
  opts: BandOptions = {}
): BandResult {
  if (target <= 0) return { band: "none", pct: 0, label: "" };

  const pct = Math.round((actual / target) * 100);
  const amberAt = opts.strict ? 100 : 110; // over this → amber
  const redAt   = opts.strict ? 115 : 130; // over this → red

  if (pct > redAt)   return { band: "red",   pct, label: `+${pct - 100}% over` };
  if (pct > amberAt) return { band: "amber", pct, label: `+${pct - 100}% over` };
  if (pct >= 90)     return { band: "on",    pct, label: "✓ on target" };
  if (opts.flagUnder)
    return { band: "under", pct, label: `−${100 - pct}% under` };
  return { band: "none", pct, label: "" };
}

/** Tailwind classes per band. `none` falls back to the metric's own colour. */
export const BAND_STYLES: Record<
  Exclude<LoadBand, "none">,
  { bar: string; text: string }
> = {
  on:    { bar: "bg-green-400", text: "text-green-400" },
  amber: { bar: "bg-amber-400", text: "text-amber-400" },
  red:   { bar: "bg-red-500",   text: "text-red-400" },
  under: { bar: "bg-sky-500",   text: "text-sky-400" },
};
