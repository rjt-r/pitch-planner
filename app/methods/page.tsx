import Link from "next/link";
import {
  SESSION_TYPES,
  POSITION_DATA,
  METRICS,
  UNCERTAINTY,
  type GPSEstimate,
} from "@/lib/gps-targets";

export const metadata = {
  title: "Methods & Data · Pitch Planner",
  description:
    "Where Pitch Planner's numbers come from, how the GPS estimates are built, and how to make them your own.",
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xs font-mono text-green-500 mt-0.5">{n}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const UNCERTAINTY_NOTES: Record<keyof GPSEstimate, string> = {
  distance: "Most stable — mainly work-rate dependent",
  hsr: "Depends on how much room the space gives for acceleration",
  sprint: "Highest uncertainty — threshold-sensitive and context-dependent",
  accels: "Varies with player intent and rest periods",
  decels: "Varies with player intent and rest periods",
};

export default function MethodsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* ── Hero ── */}
        <div className="bg-gradient-to-br from-green-950/60 to-zinc-900/60 border border-green-900/40 rounded-xl p-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Methods &amp; data</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Every number in Pitch Planner is an <strong className="text-zinc-200">estimate</strong>,
            not a measurement. This page explains where the benchmarks come from, how the
            GPS figures are built, and — most importantly — how to replace our starting
            points with your own squad&apos;s data.
          </p>
        </div>

        {/* ── The headline caveat ── */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-6">
          <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide mb-2">
            Read this first
          </h2>
          <p className="text-sm text-amber-100/80 leading-relaxed">
            These benchmarks describe <em>populations</em> of players in published research.
            Your squad is not that population — age, competitive level, fitness, and playing
            style all shift the real numbers. Treat every default here as a{" "}
            <strong className="text-amber-200">calibration starting point</strong>, and where
            you have your own GPS data, use the edit controls to overwrite ours. The app is
            designed to be corrected.
          </p>
        </div>

        {/* ── 01 RPA & pitch sizes ── */}
        <Section n="01" title="Relative Pitch Area (RPA) &amp; pitch sizes">
          <p>
            <strong className="text-zinc-200">RPA = total pitch area ÷ number of players.</strong>{" "}
            It captures how much space each player has, and it is the strongest single lever a
            coach controls: tighter areas force more accelerations, decelerations, and changes of
            direction; larger areas open up high-speed running and sprinting.
          </p>
          <p>
            The reference pitch sizes (SSG / MSG / LSG for each format from 1v1 to 11v11) are
            based on{" "}
            <strong className="text-zinc-200">Riboli et al. (2020)</strong>, whose work related
            physical match performance to relative pitch area in{" "}
            <strong className="text-zinc-200">women&apos;s football</strong>. Because that cohort
            matches this app&apos;s intended users, the pitch dimensions are population-appropriate
            — but individual squads still vary, which is why every seeded shape is fully editable.
          </p>
          <p className="text-zinc-500">
            On the canvas, the RPA traffic-light compares your drawn shape to the Riboli reference
            for that format:{" "}
            <span className="text-green-400">● within ±10%</span> ·{" "}
            <span className="text-amber-400">● within ±30%</span> ·{" "}
            <span className="text-red-400">● beyond ±30%</span>.
          </p>
        </Section>

        {/* ── 02 GPS estimation model ── */}
        <Section n="02" title="How the GPS estimates are built">
          <p>
            When you add a drill, the app estimates its GPS output from the drill&apos;s RPA and
            duration. The model follows the direction of the Riboli findings:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 marker:text-zinc-600">
            <li>Running distance per minute rises modestly with more space</li>
            <li>High-speed running stays negligible below ~55 m²/player, then grows</li>
            <li>Sprint distance only emerges in large spaces (above ~100 m²/player)</li>
            <li>Accelerations &amp; decelerations are highest in tight areas and fall as space grows</li>
          </ul>
          <p>
            These rates are <strong className="text-zinc-200">calibrated</strong> so the standard
            session types below reproduce their target loads. They are deliberately simple,
            transparent relationships — not a black box — so you can sanity-check any number
            against your own experience and override it.
          </p>

          {/* Uncertainty table */}
          <div className="mt-2">
            <p className="text-zinc-300 font-medium mb-2">
              Built-in uncertainty (why every value shows a ± range)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Metric</th>
                    <th className="py-2 pr-3 font-medium text-right">Typical variation</th>
                    <th className="py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => (
                    <tr key={m.key} className="border-b border-zinc-800/60">
                      <td className="py-2 pr-3 text-zinc-300">{m.label}</td>
                      <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                        ±{Math.round(UNCERTAINTY[m.key] * 100)}%
                      </td>
                      <td className="py-2 text-zinc-500">{UNCERTAINTY_NOTES[m.key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-zinc-500 mt-2">
              A drill planned at exactly its target can realistically land anywhere in these
              bands on the day. This is also why over-shooting a target matters: a plan already
              +10% on paper will routinely land well over once real work-rate variation is added.
            </p>
          </div>
        </Section>

        {/* ── 03 Session-type benchmarks ── */}
        <Section n="03" title="Session-type benchmarks">
          <p>
            The four session types set the GPS targets you plan against. These are default
            planning loads — the ✎ control on each card lets you replace them with your own
            squad&apos;s targets.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Session</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="py-2 pr-3 font-medium text-right">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2 font-medium text-right">RPE</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SESSION_TYPES).map(([key, s]) => (
                  <tr key={key} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{s.label}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="py-2 pr-3 text-right font-mono text-zinc-400">
                        {s[m.key].toLocaleString()}
                        {m.unit}
                      </td>
                    ))}
                    <td className="py-2 text-right font-mono text-zinc-400">{s.rpe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-500">
            Recovery and match-prep days (MD-2, MD-1) treat their targets as{" "}
            <strong className="text-zinc-300">ceilings</strong> — the app flags any overshoot
            immediately rather than allowing the ±10% grace band used for training days.
          </p>
        </Section>

        {/* ── 04 Position match-demands ── */}
        <Section n="04" title="Match-demand reference values (by position)">
          <p>
            The Week forecaster scales its weekly target from match load. The per-position values
            below are <strong className="text-zinc-200">women&apos;s-football reference figures</strong>{" "}
            used as defaults. They are the single most important thing to personalise: if you have
            your squad&apos;s own GPS averages, enter them with the ✎ control and every downstream
            target updates.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Position</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="py-2 pr-3 font-medium text-right">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(POSITION_DATA).map(([key, p]) => (
                  <tr
                    key={key}
                    className={`border-b border-zinc-800/60 ${
                      key === "average" ? "text-zinc-300" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{p.label}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="py-2 pr-3 text-right font-mono text-zinc-400">
                        {p[m.key].toLocaleString()}
                        {m.unit}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-600 text-xs italic">
            Provenance note: exact source citation for these reference values to be added.
            Until then, treat them as practitioner starting points and prefer your own squad&apos;s
            measured data wherever you have it.
          </p>
        </Section>

        {/* ── 05 Make it yours ── */}
        <Section n="05" title="Making it your own">
          <p>Nothing here is fixed. You can override:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 marker:text-zinc-600">
            <li>Any pitch shape — drag the drawn polygon to your real dimensions</li>
            <li>Any drill&apos;s GPS values — type over the estimate with measured data</li>
            <li>Session-type targets — the ✎ control on each session card</li>
            <li>Position match-demands — the ✎ control in the Week forecaster</li>
          </ul>
          <p>
            The more of your own GPS data you feed in, the more the estimates become{" "}
            <em>your</em>{" "}squad&apos;s model rather than a research average.
          </p>
        </Section>

        {/* ── References ── */}
        <Section n="—" title="References">
          <p>
            Riboli, A., et al. (2020). Research relating physical match performance to relative
            pitch area in women&apos;s football, underpinning the SSG/MSG/LSG reference sizes and
            the direction of the RPA-to-GPS relationships used here.
          </p>
          <p className="text-zinc-600 text-xs italic">
            Full citation and any additional sources for the position reference values to be
            completed.
          </p>
        </Section>

        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-sm text-green-500 hover:text-green-400 transition-colors"
          >
            ← Back to session planner
          </Link>
        </div>
      </div>

      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-700 mt-8">
        Pitch Planner · Based on Riboli et al. (2020) · Built for women&apos;s football coaches
      </footer>
    </main>
  );
}
