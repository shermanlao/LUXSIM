"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { CalcResults } from "@luxsim/solver";
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import {
  officialChartLegendStops,
  normalizeFalseColorMapping,
  normalizeFalseColorScale,
  falseColorBarTicks,
  FALSE_COLOR_BAR_MAX,
  FALSE_COLOR_BAR_MIN,
  OFFICIAL_FALSE_COLOR_SCALE,
} from "@/lib/false-color";
import { FALSE_COLOR_SCALE_APPLY_PROMPT } from "@/lib/false-color-scale-commit";

function formatLux(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

function luxInputValue(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return Math.round(rounded);
  return rounded;
}

function handleInputStyle(pct: number, matePct?: number): CSSProperties {
  let transform = "translateX(-50%)";
  if (pct <= 8) transform = "translateX(0)";
  else if (pct >= 92) transform = "translateX(-100%)";
  else if (matePct != null && Math.abs(matePct - pct) < 14) {
    transform = matePct > pct ? "translateX(-85%)" : "translateX(-15%)";
  }
  return { left: `${pct}%`, transform };
}

function barStep(span: number): number {
  if (span > 100) return 1;
  if (span > 10) return 0.1;
  return 0.01;
}

function tickAlign(i: number, last: number): string {
  if (i === 0) return "translateX(0)";
  if (i === last) return "translateX(-100%)";
  return "translateX(-50%)";
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
    eminProp ?? results?.summary.emin ?? OFFICIAL_FALSE_COLOR_SCALE.minLux,
    emaxProp ?? results?.summary.emax ?? OFFICIAL_FALSE_COLOR_SCALE.maxLux
  );
  const committed = scale ? normalizeFalseColorMapping(scale) : fallback;
  const [draft, setDraft] = useState(committed);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const interactingRef = useRef(false);

  useEffect(() => {
    if (interactingRef.current) return;
    setDraft(committed);
  }, [committed.minLux, committed.maxLux, committed.winMin, committed.winMax]);

  const current = draft;
  const stops = officialChartLegendStops(palette, current);
  const hasResults = Boolean(results) || eminProp != null || emaxProp != null || scale != null;
  const gradient = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / Math.max(stops.length - 1, 1)) * 100}%`)
    .join(", ")})`;

  const barMin = current.minLux;
  const barMax = current.maxLux;
  const winMin = current.winMin ?? barMin;
  const winMax = current.winMax ?? barMax;
  const span = Math.max(barMax - barMin, 1e-9);
  const step = barStep(span);
  const minHandleGap = Math.max(step, Math.min(1, span / 2500));
  const pctMin = ((winMin - barMin) / span) * 100;
  const pctMax = ((winMax - barMin) / span) * 100;
  const ticks = falseColorBarTicks(barMin, barMax);

  const interactive = typeof onChange === "function";
  const dark = tone === "dark" || layout === "bar";
  const isBar = layout === "bar";

  function setDraftScale(next: FalseColorScale) {
    const normalized = normalizeFalseColorMapping(next);
    draftRef.current = normalized;
    setDraft(normalized);
    onChange?.(normalized);
  }

  function previewBar(minLux: number, maxLux: number) {
    setDraftScale({
      minLux,
      maxLux,
      winMin,
      winMax,
    });
  }

  function previewWindow(nextWinMin: number, nextWinMax: number) {
    setDraftScale({
      minLux: barMin,
      maxLux: barMax,
      winMin: nextWinMin,
      winMax: nextWinMax,
    });
  }

  function beginInteract() {
    interactingRef.current = true;
  }

  function commitDraft() {
    interactingRef.current = false;
    onChange?.(draftRef.current);
  }

  function onBarMinInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    previewBar(n, barMax);
  }

  function onBarMaxInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    previewBar(barMin, n);
  }

  function onWinMinInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    previewWindow(n, winMax);
  }

  function onWinMaxInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    previewWindow(winMin, n);
  }

  const shell = isBar
    ? `w-full shrink-0 px-3 py-1.5 ${dark ? "bg-[#0a1218] text-[#e8eef2] border-t border-[#2a3842]" : "bg-white border-t border-[var(--line)]"}`
    : compact
      ? `panel p-2 ${dark ? "!bg-[#162630] !border-[#2a3842] text-[#e8eef2]" : "bg-white/90"}`
      : "panel p-3";

  const endBoxClass = `w-14 shrink-0 rounded-sm border px-1 py-0.5 text-[11px] tabular-nums ${
    dark ? "bg-[#12202a] border-[#3a5160] text-[#e8eef2]" : "bg-white border-[var(--line)]"
  }`;

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
        {interactive ? (
          <input
            id="falsecolor-bar-min"
            type="number"
            min={FALSE_COLOR_BAR_MIN}
            max={FALSE_COLOR_BAR_MAX}
            step={step}
            value={luxInputValue(barMin)}
            onChange={(e) => onBarMinInput(e.target.value)}
            onBlur={commitDraft}
            onPointerUp={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                e.currentTarget.blur();
              }
            }}
            className={endBoxClass}
            aria-label="Scale-bar minimum lux"
          />
        ) : null}

        <div className="relative flex-1 min-w-0">
          {interactive && (
            <div className="relative h-[1.2rem] mb-0.5 pointer-events-none">
              <input
                type="number"
                min={barMin}
                max={winMax - minHandleGap}
                step={step}
                value={luxInputValue(winMin)}
                onChange={(e) => onWinMinInput(e.target.value)}
                onBlur={commitDraft}
                onPointerUp={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitDraft();
                    e.currentTarget.blur();
                  }
                }}
                className="falsecolor-handle-input"
                style={handleInputStyle(pctMin, pctMax)}
                aria-label="Lower handle lux"
              />
              <input
                type="number"
                min={winMin + minHandleGap}
                max={barMax}
                step={step}
                value={luxInputValue(winMax)}
                onChange={(e) => onWinMaxInput(e.target.value)}
                onBlur={commitDraft}
                onPointerUp={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitDraft();
                    e.currentTarget.blur();
                  }
                }}
                className="falsecolor-handle-input"
                style={handleInputStyle(pctMax, pctMin)}
                aria-label="Upper handle lux"
              />
            </div>
          )}
          <div
            className={`w-full rounded-sm border ${dark ? "border-[#3a5160]" : "border-[var(--line)]"} ${isBar ? "h-2.5" : "h-3.5"}`}
            style={{ background: gradient }}
            aria-hidden
          />
          {interactive && (
            <div className="relative h-3">
              <input
                type="range"
                min={barMin}
                max={barMax}
                step={step}
                value={Math.min(winMin, winMax - minHandleGap)}
                onPointerDown={beginInteract}
                onChange={(e) => previewWindow(Number(e.target.value), winMax)}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--min"
                aria-label="Lower handle lux"
              />
              <input
                type="range"
                min={barMin}
                max={barMax}
                step={step}
                value={Math.max(winMax, winMin + minHandleGap)}
                onPointerDown={beginInteract}
                onChange={(e) => previewWindow(winMin, Number(e.target.value))}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--max"
                aria-label="Upper handle lux"
              />
            </div>
          )}
          <div className={`relative mt-0.5 h-3 text-[10px] tabular-nums ${dark ? "text-[#8fa3ad]" : "text-[var(--muted)]"}`}>
            {ticks.map((lux, i) => (
              <span
                key={`${lux}-${i}`}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${((lux - barMin) / span) * 100}%`,
                  transform: tickAlign(i, ticks.length - 1),
                }}
              >
                {formatLux(lux)}
                {i === ticks.length - 1 && !interactive ? " lx" : ""}
              </span>
            ))}
          </div>
        </div>

        {interactive ? (
          <input
            id="falsecolor-bar-max"
            type="number"
            min={FALSE_COLOR_BAR_MIN}
            max={FALSE_COLOR_BAR_MAX}
            step={step}
            value={luxInputValue(barMax)}
            onChange={(e) => onBarMaxInput(e.target.value)}
            onBlur={commitDraft}
            onPointerUp={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                e.currentTarget.blur();
              }
            }}
            className={endBoxClass}
            aria-label="Scale-bar maximum lux"
          />
        ) : null}
      </div>
    </div>
  );
}
