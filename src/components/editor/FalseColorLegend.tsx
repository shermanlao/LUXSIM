"use client";

import type { CalcResults } from "@luxsim/solver";
import { legendStopsForRange } from "@/lib/false-color";

export function FalseColorLegend({
  results,
  emin: eminProp,
  emax: emaxProp,
  compact = false,
}: {
  results?: CalcResults | null;
  emin?: number;
  emax?: number;
  compact?: boolean;
}) {
  const emin = eminProp ?? results?.summary.emin ?? 56;
  const emax = emaxProp ?? results?.summary.emax ?? 500;
  const stops = legendStopsForRange(emin, emax);
  const hasResults = Boolean(results) || eminProp != null || emaxProp != null;
  const gradient = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / Math.max(stops.length - 1, 1)) * 100}%`)
    .join(", ")})`;

  return (
    <div className={compact ? "panel p-2 bg-white/90" : "panel p-3"}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>False-colour scale</h3>
        <span className="text-xs text-[var(--muted)]">
          {hasResults ? "Project-wide illuminance" : "Preview (run Calculate)"}
        </span>
      </div>
      <div
        className="h-3 w-full rounded-sm border border-[var(--line)]"
        style={{ background: gradient }}
        aria-hidden
      />
      <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]">
        {stops.map((s, i) => (
          <span key={s.lux} className="tabular-nums">
            {s.lux}
            {i === stops.length - 1 ? " lx" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
