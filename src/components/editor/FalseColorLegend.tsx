"use client";

import { useEffect, useRef, useState } from "react";
import type { CalcResults } from "@luxsim/solver";
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import {
  officialChartLegendStops,
  normalizeFalseColorScale,
  OFFICIAL_FALSE_COLOR_SCALE,
  OFFICIAL_FALSE_COLOR_CHART_TICKS,
} from "@/lib/false-color";
import { FALSE_COLOR_SCALE_APPLY_PROMPT } from "@/lib/false-color-scale-commit";

function formatLux(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

export function FalseColorLegend({
  results,
  emin: eminProp,
  emax: emaxProp,
  scale,
  onChange,
  onReset,
  onApply,
  canApply = false,
  compact = false,
  tone = "light",
  layout = "card",
  palette = "falsecolor",
}: {
  results?: CalcResults | null;
  emin?: number;
  emax?: number;
  scale?: FalseColorScale;
  onChange?: (scale: FalseColorScale) => void;
  onReset?: () => void;
  onApply?: () => void;
  canApply?: boolean;
  compact?: boolean;
  tone?: "light" | "dark";
  /** "bar" is a short, full-width strip under the 3D window. */
  layout?: "card" | "bar";
  /** Greyscale uses a grey gradient and title; false colour uses a continuous nine-stop scale. */
  palette?: IsoluxPalette;
}) {
  const fallback = normalizeFalseColorScale(
    eminProp ?? results?.summary.emin ?? 56,
    emaxProp ?? results?.summary.emax ?? 500
  );
  const committed = scale ? normalizeFalseColorScale(scale.minLux, scale.maxLux) : fallback;
  const [draft, setDraft] = useState(committed);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const interactingRef = useRef(false);

  useEffect(() => {
    if (interactingRef.current) return;
    setDraft(committed);
  }, [committed.minLux, committed.maxLux]);

  const current = draft;
  const stops = officialChartLegendStops(palette);
  const hasResults = Boolean(results) || eminProp != null || emaxProp != null || scale != null;
  const gradient = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / Math.max(stops.length - 1, 1)) * 100}%`)
    .join(", ")})`;

  const domainMax = OFFICIAL_FALSE_COLOR_SCALE.maxLux;
  const domainMin = OFFICIAL_FALSE_COLOR_SCALE.minLux;

  const interactive = typeof onChange === "function";
  const dark = tone === "dark" || layout === "bar";
  const isBar = layout === "bar";

  function preview(minLux: number, maxLux: number) {
    const next = normalizeFalseColorScale(minLux, maxLux);
    draftRef.current = next;
    setDraft(next);
    onChange?.(next);
  }

  function beginInteract() {
    interactingRef.current = true;
  }

  function commitDraft() {
    interactingRef.current = false;
    onChange?.(draftRef.current);
  }

  function onMinInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    preview(n, current.maxLux);
  }

  function onMaxInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    preview(current.minLux, n);
  }

  const shell = isBar
    ? `w-full shrink-0 px-3 py-1.5 ${dark ? "bg-[#0a1218] text-[#e8eef2] border-t border-[#2a3842]" : "bg-white border-t border-[var(--line)]"}`
    : compact
      ? `panel p-2 ${dark ? "!bg-[#162630] !border-[#2a3842] text-[#e8eef2]" : "bg-white/90"}`
      : "panel p-3";

  return (
    <div className={shell} data-falsecolor-legend={layout} data-scale-palette={palette}>
      <div className={`flex items-center gap-2 ${isBar ? "mb-1" : "justify-between gap-2 mb-2"}`}>
        <h3 className={isBar || compact ? "text-[10px] uppercase tracking-wider font-semibold shrink-0" : "text-sm font-semibold"}>
          {palette === "greyscale" ? "Greyscale scale" : "False-colour scale"}
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
            onClick={() => {
              interactingRef.current = false;
              onReset();
            }}
          >
            Reset
          </button>
        )}
        {onApply && canApply && (
          <button
            type="button"
            className={`text-[10px] rounded-sm px-1.5 py-0.5 font-semibold ${
              dark
                ? "bg-[#c45c26] text-[#f5f7f8] hover:bg-[#d56a30]"
                : "bg-[var(--accent)] text-white"
            }`}
            onClick={onApply}
          >
            {FALSE_COLOR_SCALE_APPLY_PROMPT.applyEn} / {FALSE_COLOR_SCALE_APPLY_PROMPT.applyZh}
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
            min={domainMin}
            max={domainMax}
            step={1}
            value={Math.round(current.minLux)}
            onChange={(e) => onMinInput(e.target.value)}
            onBlur={commitDraft}
            onPointerUp={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                e.currentTarget.blur();
              }
            }}
            className={`w-14 shrink-0 rounded-sm border px-1 py-0.5 text-[11px] tabular-nums ${
              dark ? "bg-[#12202a] border-[#3a5160] text-[#e8eef2]" : "bg-white border-[var(--line)]"
            }`}
          />
        ) : null}

        <div className="relative flex-1 min-w-0">
          <div
            className={`w-full rounded-sm border ${dark ? "border-[#3a5160]" : "border-[var(--line)]"} ${isBar ? "h-2.5" : "h-3.5"}`}
            style={{ background: gradient }}
            aria-hidden
          />
          {interactive && (
            <div className="relative h-3">
              <input
                type="range"
                min={domainMin}
                max={domainMax}
                step={1}
                value={Math.min(current.minLux, current.maxLux - 1)}
                onPointerDown={beginInteract}
                onChange={(e) => preview(Number(e.target.value), current.maxLux)}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--min"
                aria-label="Minimum lux"
              />
              <input
                type="range"
                min={domainMin}
                max={domainMax}
                step={1}
                value={Math.max(current.maxLux, current.minLux + 1)}
                onPointerDown={beginInteract}
                onChange={(e) => preview(current.minLux, Number(e.target.value))}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--max"
                aria-label="Maximum lux"
              />
            </div>
          )}
          <div className={`mt-0.5 flex justify-between text-[10px] tabular-nums ${dark ? "text-[#8fa3ad]" : "text-[var(--muted)]"}`}>
            {OFFICIAL_FALSE_COLOR_CHART_TICKS.map((lux, i) => (
              <span key={lux}>
                {formatLux(lux)}
                {i === OFFICIAL_FALSE_COLOR_CHART_TICKS.length - 1 && !interactive ? " lx" : ""}
              </span>
            ))}
          </div>
        </div>

        {interactive ? (
          <input
            id="falsecolor-max"
            type="number"
            min={domainMin}
            max={domainMax}
            step={1}
            value={Math.round(current.maxLux)}
            onChange={(e) => onMaxInput(e.target.value)}
            onBlur={commitDraft}
            onPointerUp={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                e.currentTarget.blur();
              }
            }}
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
