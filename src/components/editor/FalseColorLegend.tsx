"use client";

import type { CalcResults } from "@luxsim/solver";
import { falseColorGradientCss, falseColorStops } from "@/lib/false-color";

export function FalseColorLegend({ results }: { results: CalcResults | null }) {
  const maxLux = results ? Math.max(...results.grid.lux, results.summary.emax, 1) : 500;
  const stops = falseColorStops(maxLux, 5);
  const hasResults = Boolean(results);

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold">False-color scale</h3>
        <span className="text-xs text-[var(--muted)]">
          {hasResults ? "Workplane illuminance" : "Preview (run Calculate)"}
        </span>
      </div>
      <div
        className="h-3 w-full rounded-sm border border-[var(--line)]"
        style={{ background: falseColorGradientCss(maxLux) }}
        aria-hidden
      />
      <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]">
        {stops.map((s) => (
          <span key={s.lux} className="tabular-nums">
            {Math.round(s.lux)}
            {s.lux === stops[stops.length - 1]!.lux ? " lx" : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
        <LegendSwatch color={stops[0]!.color} label="Low" />
        <LegendSwatch color={stops[Math.floor(stops.length / 2)]!.color} label="Mid" />
        <LegendSwatch color={stops[stops.length - 1]!.color} label="High" />
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 border border-black/10"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
