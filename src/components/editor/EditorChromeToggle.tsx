"use client";

import {
  editorChromeToggleLabel,
  type EditorChromePanel,
} from "@/lib/editor-chrome-minimize";

export function EditorChromeToggle({
  panel,
  minimized,
  onToggle,
}: {
  panel: EditorChromePanel;
  minimized: boolean;
  onToggle: () => void;
}) {
  const label = editorChromeToggleLabel(panel, minimized);
  return (
    <button
      type="button"
      className="cad-chrome-toggle"
      aria-expanded={!minimized}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <EditorChromeToggleGlyph panel={panel} minimized={minimized} />
    </button>
  );
}

function EditorChromeToggleGlyph({
  panel,
  minimized,
}: {
  panel: EditorChromePanel;
  minimized: boolean;
}) {
  const direction =
    panel === "left"
      ? minimized
        ? "right"
        : "left"
      : panel === "right"
        ? minimized
          ? "left"
          : "right"
        : minimized
          ? "up"
          : "down";
  const d =
    direction === "left"
      ? "M14.5 5.5L8.5 12l6 6.5"
      : direction === "right"
        ? "M9.5 5.5L15.5 12l-6 6.5"
        : direction === "up"
          ? "M5.5 14.5L12 8.5l6.5 6"
          : "M5.5 9.5L12 15.5l6.5-6";
  return (
    <svg className="cad-chrome-toggle__icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
