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
import {
  FALSE_COLOR_TEMPLATE_COPY,
  type FalseColorScaleTemplate,
} from "@/lib/false-color-scale-templates";
import {
  FalseColorScaleDeleteTemplateDialog,
  FalseColorScaleSaveTemplateDialog,
} from "./FalseColorScaleTemplateDialogs";

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


function LuxNumberField({
  id,
  value,
  min,
  max,
  step,
  className,
  style,
  ariaLabel,
  onValueChange,
  onBegin,
  onCommit,
}: {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onValueChange: (n: number) => void;
  onBegin: () => void;
  onCommit: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const display = editing ? text : String(luxInputValue(value));

  function parseOrZero(raw: string): number {
    if (raw === "" || raw === ".") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function commitText(raw: string) {
    onValueChange(parseOrZero(raw));
    setEditing(false);
    onCommit();
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      min={min}
      max={max}
      step={step}
      value={display}
      aria-label={ariaLabel}
      className={className}
      style={style}
      onFocus={(e) => {
        setEditing(true);
        setText(String(luxInputValue(value)));
        e.currentTarget.select();
        onBegin();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        onBegin();
        if (raw !== "" && raw !== ".") {
          const n = Number(raw);
          if (Number.isFinite(n)) onValueChange(n);
        }
      }}
      onBlur={(e) => commitText(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitText(e.currentTarget.value);
          e.currentTarget.blur();
        }
      }}
    />
  );
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

const CHART_SLIDER_MAX = OFFICIAL_FALSE_COLOR_SCALE.maxLux - OFFICIAL_FALSE_COLOR_SCALE.minLux;

function tToSlider(t: number): number {
  return Math.round(Math.max(0, Math.min(1, t)) * CHART_SLIDER_MAX);
}

function sliderToT(value: number): number {
  return Math.max(0, Math.min(1, value / CHART_SLIDER_MAX));
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
  templates = [],
  templatesEnabled = false,
  templatesError = null,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
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
  templates?: readonly FalseColorScaleTemplate[];
  templatesEnabled?: boolean;
  templatesError?: string | null;
  onSaveTemplate?: (
    name: string,
    scale: FalseColorScale,
    palette: IsoluxPalette
  ) => Promise<{ ok: true; id: string } | { ok: false }>;
  onLoadTemplate?: (template: FalseColorScaleTemplate) => void;
  onDeleteTemplate?: (templateId: string) => Promise<boolean> | boolean;
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
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (interactingRef.current) return;
    setDraft(committed);
  }, [committed.minLux, committed.maxLux, committed.tMin, committed.tMax, committed.winMin, committed.winMax]);

  useEffect(() => {
    if (selectedTemplateId && !templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [templates, selectedTemplateId]);

  const current = draft;
  const stops = officialChartLegendStops(palette);
  const hasResults = Boolean(results) || eminProp != null || emaxProp != null || scale != null;
  const gradient = `linear-gradient(90deg, ${stops
    .map((s, i) => `${s.color} ${(i / Math.max(stops.length - 1, 1)) * 100}%`)
    .join(", ")})`;

  const barMin = current.minLux;
  const barMax = current.maxLux;
  const tMin = current.tMin ?? 0;
  const tMax = current.tMax ?? 1;
  const winMin = current.winMin ?? barMin;
  const winMax = current.winMax ?? barMax;
  const span = Math.max(barMax - barMin, 1e-9);
  const step = barStep(span);
  const anchorStep = barStep(Math.max(Math.abs(winMax - winMin), 1));
  const pctMin = tMin * 100;
  const pctMax = tMax * 100;
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

  function fullScale(partial: Partial<FalseColorScale> & Pick<FalseColorScale, "minLux" | "maxLux">): FalseColorScale {
    return {
      minLux: partial.minLux,
      maxLux: partial.maxLux,
      tMin: partial.tMin ?? tMin,
      tMax: partial.tMax ?? tMax,
      winMin: partial.winMin ?? winMin,
      winMax: partial.winMax ?? winMax,
    };
  }

  function previewBar(minLux: number, maxLux: number) {
    setDraftScale(fullScale({ minLux, maxLux, tMin, tMax, winMin, winMax }));
  }

  function previewHandles(nextTMin: number, nextTMax: number) {
    setDraftScale(fullScale({ minLux: barMin, maxLux: barMax, tMin: nextTMin, tMax: nextTMax, winMin, winMax }));
  }

  function previewAnchors(nextWinMin: number, nextWinMax: number) {
    setDraftScale(fullScale({ minLux: barMin, maxLux: barMax, tMin, tMax, winMin: nextWinMin, winMax: nextWinMax }));
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
    previewAnchors(n, winMax);
  }

  function onWinMaxInput(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    beginInteract();
    previewAnchors(winMin, n);
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

      {templatesEnabled ? (
        <div className="falsecolor-template-row" data-falsecolor-templates="">
          <select
            className="falsecolor-template-select"
            aria-label={FALSE_COLOR_TEMPLATE_COPY.templates}
            value={selectedTemplateId}
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTemplateId(id);
              const template = templates.find((item) => item.id === id);
              if (!template) return;
              interactingRef.current = false;
              onLoadTemplate?.(template);
            }}
          >
            <option value="">{FALSE_COLOR_TEMPLATE_COPY.selectPlaceholder}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="falsecolor-template-btn"
            disabled={busy}
            onClick={() => setSaveOpen(true)}
          >
            {FALSE_COLOR_TEMPLATE_COPY.saveAs}
          </button>
          <button
            type="button"
            className="falsecolor-template-btn"
            disabled={busy || !selectedTemplateId}
            onClick={() => {
              if (selectedTemplateId) setDeleteId(selectedTemplateId);
            }}
          >
            {FALSE_COLOR_TEMPLATE_COPY.delete}
          </button>
          {templatesError ? <span className="falsecolor-template-row-error">{templatesError}</span> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {interactive ? (
          <LuxNumberField
            id="falsecolor-bar-min"
            min={FALSE_COLOR_BAR_MIN}
            max={FALSE_COLOR_BAR_MAX}
            step={step}
            value={barMin}
            onValueChange={(n) => onBarMinInput(String(n))}
            onBegin={beginInteract}
            onCommit={commitDraft}
            className={endBoxClass}
            ariaLabel="Scale-bar minimum lux"
          />
        ) : null}

        <div className="relative flex-1 min-w-0">
          {interactive && (
            <div className="relative h-[1.2rem] mb-0.5 pointer-events-none">
              <LuxNumberField
                min={FALSE_COLOR_BAR_MIN}
                max={FALSE_COLOR_BAR_MAX}
                step={anchorStep}
                value={winMin}
                onValueChange={(n) => onWinMinInput(String(n))}
                onBegin={beginInteract}
                onCommit={commitDraft}
                className="falsecolor-handle-input"
                style={handleInputStyle(pctMin, pctMax)}
                ariaLabel="Lower colour lux anchor"
              />
              <LuxNumberField
                min={FALSE_COLOR_BAR_MIN}
                max={FALSE_COLOR_BAR_MAX}
                step={anchorStep}
                value={winMax}
                onValueChange={(n) => onWinMaxInput(String(n))}
                onBegin={beginInteract}
                onCommit={commitDraft}
                className="falsecolor-handle-input"
                style={handleInputStyle(pctMax, pctMin)}
                ariaLabel="Upper colour lux anchor"
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
                min={0}
                max={CHART_SLIDER_MAX}
                step={1}
                value={Math.min(tToSlider(tMin), tToSlider(tMax) - 1)}
                onPointerDown={beginInteract}
                onChange={(e) => previewHandles(sliderToT(Number(e.target.value)), tMax)}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--min"
                aria-label="Lower colour"
              />
              <input
                type="range"
                min={0}
                max={CHART_SLIDER_MAX}
                step={1}
                value={Math.max(tToSlider(tMax), tToSlider(tMin) + 1)}
                onPointerDown={beginInteract}
                onChange={(e) => previewHandles(tMin, sliderToT(Number(e.target.value)))}
                onPointerUp={commitDraft}
                onPointerCancel={commitDraft}
                onKeyUp={commitDraft}
                className="falsecolor-range falsecolor-range--max"
                aria-label="Upper colour"
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
          <LuxNumberField
            id="falsecolor-bar-max"
            min={FALSE_COLOR_BAR_MIN}
            max={FALSE_COLOR_BAR_MAX}
            step={step}
            value={barMax}
            onValueChange={(n) => onBarMaxInput(String(n))}
            onBegin={beginInteract}
            onCommit={commitDraft}
            className={endBoxClass}
            ariaLabel="Scale-bar maximum lux"
          />
        ) : null}
      </div>
      {templatesEnabled ? (
        <>
          <FalseColorScaleSaveTemplateDialog
            open={saveOpen}
            templates={templates}
            onCancel={() => setSaveOpen(false)}
            onSave={(name) => {
              if (!onSaveTemplate) return;
              setBusy(true);
              void Promise.resolve(onSaveTemplate(name, draftRef.current, palette)).then((result) => {
                if (result && result.ok) {
                  setSelectedTemplateId(result.id);
                  setSaveOpen(false);
                }
              }).finally(() => {
                setBusy(false);
              });
            }}
          />
          <FalseColorScaleDeleteTemplateDialog
            open={Boolean(deleteId)}
            templateName={templates.find((item) => item.id === deleteId)?.name ?? ""}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => {
              if (!deleteId || !onDeleteTemplate) return;
              const id = deleteId;
              setBusy(true);
              void Promise.resolve(onDeleteTemplate(id)).then((ok) => {
                if (ok !== false) {
                  setDeleteId(null);
                  setSelectedTemplateId((current) => (current === id ? "" : current));
                }
              }).finally(() => {
                setBusy(false);
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
