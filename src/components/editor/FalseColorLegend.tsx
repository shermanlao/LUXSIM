"use client";

import { useMemo } from "react";
import type { CalcResults } from "@luxsim/solver";
import type { FalseColorScale } from "@luxsim/project-io";
import { legendStopsForScale, normalizeFalseColorScale } from "@/lib/false-color";

function formatLux(value: number): string {
  if (value >= 100 || Number.isInteger(value)) return String(Math.round(value));
  return value.toFixed(1);
}

export function FalseColorLegend({
  results,
  emin: eminProp,
  emax: emaxProp,
  scale,
  onChange,
  onReset,
  compact = false,
  tone = "light",
  layout = "card",
}: {
  results?: CalcResults | null;
  emin?: number;
  emax?: number;
  scale?: FalseColorScale;
  onChange?: (scale: FalseColorScale) => void;
  onReset?: () => void;
  compact?: boolean;
  tone?: "light" | "dark";
  /** "bar" is a short, full-width strip under the 3D window. */
  layout?: "card" | "bar";
}) {
  const fallback = normalizeFalseColorScale(
    eminProp ?? results?.summary.emin ?? 56,
    emaxProp ?? results?.summary.emax ?? 500
  );
  const current = scale ? normalizeFalseColorScale(scale.minLux, scale.maxLux) : fallback;
  const stops = legendStopsForScale(current);
  const hasResults = Boolean(results) || eminProp != null || emaxProp != null || scale != null;
  const gradient = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / Math.max(stops.length - 1, 1)) * 100}%`)
    .join(", ")})`;

  const domainMax = useMemo(() => {
    const raw = Math.max(current.maxLux, fallback.maxLux, 500);
    const nice = [200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000];
    return nice.find((v) => v >= raw) ?? Math.ceil(raw / 500) * 500;
  }, [current.maxLux, fallback.maxLux]);

  const interactive = typeof onChange === "function";
  const dark = tone === "dark" || layout === "bar";
  const isBar = layout === "bar";

  function commit(minLux: number, maxLux: number) {
    onChange?.(normalizeFalseColorScale(minLux, maxLux));
  }

  function onMinInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    commit(n, current.maxLux);
  }

  function onMaxInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    commit(current.minLux, n);
  }

  const shell = isBar
    ? `w-full shrink-0 px-3 py-1.5 ${dark ? "bg-[#0a1218] text-[#e8eef2] border-t border-[#2a3842]" : "bg-white border-t border-[var(--line)]"}`
    : compact
      ? `panel p-2 ${dark ? "!bg-[#162630] !border-[#2a3842] text-[#e8eef2]" : "bg-white/90"}`
      : "panel p-3";

  return (
    <div className={shell} data-falsecolor-legend={layout}>
      <div className={`flex items-center gap-2 ${isBar ? "mb-1" : "justify-between gap-2 mb-2"}`}>
        <h3 className={isBar || compact ? "text-[10px] uppercase tracking-wider font-semibold shrink-0" : "text-sm font-semibold"}>
          {isBar ? "False-colour scale" : "False-colour scale"}
        </h3>
        {!isBar && (
          <span className={`text-xs ${dark ? "text-[#8fa3ad]" : "text-[var(--muted)]"}`}>
            {hasResults ? "Project-wide illuminance" : "Preview (run Calculate)"}
          </span>
        )}
        <span className={`ml-auto text-[10px] ${dark ? "text-[#8fa3ad]" : "text-[var(--muted)]"}`}>lx</span>
        {onReset && (
          <button
            type="button"
            className={`text-[10px] underline-offset-2 hover:underline ${dark ? "text-[#c5d0d6]" : "text-[var(--muted)]"}`}
            onClick={onReset}
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {interactive && (
          <label className="sr-only" htmlFor="falsecolor-min">
            Minimum lux
          </label>
        )}
        {interactive ? (
          <input
            id="falsecolor-min"
            type="number"
            min={0}
            step={1}
            value={Math.round(current.minLux)}
            onChange={(e) => onMinInput(e.target.value)}
            className={`w-14 shrink-0 rounded-sm border px-1 py-0.5 text-[11px] tabular-nums ${
              dark ? "bg-[#12202a] border-[#3a5160] text-[#e8eef2]" : "bg-white border-[var(--line)]"
            }`}
          />
        ) : null}

        <div className="relative flex-1 min-w-0">
          <div
            className={`w-full rounded-sm border ${dark ? "border-[#3a5160]" : "border-[var(--line)]"} ${isBar ? "h-2" : "h-3"}`}
            style={{ background: gradient }}
            aria-hidden
          />
          {interactive && (
            <div className="relative h-3">
              <input
                type="range"
                min={0}
                max={domainMax}
                step={1}
                value={Math.min(current.minLux, current.maxLux - 1)}
                onChange={(e) => commit(Number(e.target.value), current.maxLux)}
                className="falsecolor-range falsecolor-range--min"
                aria-label="Minimum lux"
              />
              <input
                type="range"
                min={0}
                max={domainMax}
                step={1}
                value={Math.max(current.maxLux, current.minLux + 1)}
                onChange={(e) => commit(current.minLux, Number(e.target.value))}
                className="falsecolor-range falsecolor-range--max"
                aria-label="Maximum lux"
              />
            </div>
          )}
          <div className={`mt-0.5 flex justify-between text-[10px] tabular-nums ${dark ? "text-[#8fa3ad]" : "text-[var(--muted)]"}`}>
            {stops.map((s, i) => (
              <span key={`${s.lux}-${i}`}>
                {formatLux(s.lux)}
                {i === stops.length - 1 && !interactive ? " lx" : ""}
              </span>
            ))}
          </div>
        </div>

        {interactive ? (
          <input
            id="falsecolor-max"
            type="number"
            min={0}
            step={1}
            value={Math.round(current.maxLux)}
            onChange={(e) => onMaxInput(e.target.value)}
            className={`w-14 shrink-0 rounded-sm border px-1 py-0.5 text-[11px] tabular-nums ${
              dark ? "bg-[#12202a] border-[#3a5160] text-[#e8eef2]" : "bg-white border-[var(--line)]"
            }`}
            aria-label="Maximum lux"
          />
        ) : null}
      </div>
    </div>
  );
}
