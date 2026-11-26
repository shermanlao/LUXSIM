export const EDITOR_CHROME_MINIMIZED_STORAGE_KEY = "luxsim.editor.chromeMinimized";

/** Thin restore-strip width for a minimized docked rail or bottom panel. */
export const EDITOR_CHROME_MINIMIZED_STRIP_PX = 28;

export type EditorChromePanel = "left" | "right" | "fixtures" | "results";

export type EditorChromeMinimized = {
  left: boolean;
  right: boolean;
  fixtures: boolean;
  results: boolean;
};

export const DEFAULT_EDITOR_CHROME_MINIMIZED: EditorChromeMinimized = {
  left: false,
  right: false,
  fixtures: false,
  results: false,
};

export type EditorChromeRailMode = "hidden" | "minimized" | "expanded";

const PANELS: EditorChromePanel[] = ["left", "right", "fixtures", "results"];

const TOGGLE_LABELS: Record<EditorChromePanel, { minimize: string; expand: string }> = {
  left: {
    minimize: "Minimize left panel / 最小化左側欄",
    expand: "Expand left panel / 展開左側欄",
  },
  right: {
    minimize: "Minimize right panel / 最小化右側欄",
    expand: "Expand right panel / 展開右側欄",
  },
  fixtures: {
    minimize: "Minimize fixtures table / 最小化專案燈具表",
    expand: "Expand fixtures table / 展開專案燈具表",
  },
  results: {
    minimize: "Minimize results panel / 最小化結果列",
    expand: "Expand results panel / 展開結果列",
  },
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseEditorChromeMinimized(raw: string | null | undefined): EditorChromeMinimized {
  const next: EditorChromeMinimized = { ...DEFAULT_EDITOR_CHROME_MINIMIZED };
  if (raw == null || raw === "") return next;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return next;
    const record = parsed as Record<string, unknown>;
    for (const panel of PANELS) {
      if (record[panel] === true) next[panel] = true;
    }
    return next;
  } catch {
    return { ...DEFAULT_EDITOR_CHROME_MINIMIZED };
  }
}

export function readEditorChromeMinimized(): EditorChromeMinimized {
  const store = storage();
  if (!store) return { ...DEFAULT_EDITOR_CHROME_MINIMIZED };
  try {
    return parseEditorChromeMinimized(store.getItem(EDITOR_CHROME_MINIMIZED_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_EDITOR_CHROME_MINIMIZED };
  }
}

export function writeEditorChromeMinimized(state: EditorChromeMinimized): void {
  const store = storage();
  if (!store) return;
  const payload: EditorChromeMinimized = {
    left: !!state.left,
    right: !!state.right,
    fixtures: !!state.fixtures,
    results: !!state.results,
  };
  try {
    store.setItem(EDITOR_CHROME_MINIMIZED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function patchEditorChromeMinimized(
  prev: EditorChromeMinimized,
  panel: EditorChromePanel,
  minimized: boolean,
): EditorChromeMinimized {
  return { ...prev, [panel]: minimized };
}

export function editorChromeRailMode(showRail: boolean, minimized: boolean): EditorChromeRailMode {
  if (!showRail) return "hidden";
  return minimized ? "minimized" : "expanded";
}

/** A rail the current tab does not own stays fully hidden — no restore strip. */
export function editorChromeRailStripVisible(showRail: boolean): boolean {
  return showRail;
}

export function editorChromeBodyClassName(opts: {
  showLeftRail: boolean;
  showRightRail: boolean;
  minimized: Pick<EditorChromeMinimized, "left" | "right">;
}): string {
  const classes = ["cad-body"];
  const left = editorChromeRailMode(opts.showLeftRail, opts.minimized.left);
  const right = editorChromeRailMode(opts.showRightRail, opts.minimized.right);
  if (left === "hidden") classes.push("cad-body--no-left");
  else if (left === "minimized") classes.push("cad-body--min-left");
  if (right === "hidden") classes.push("cad-body--no-right");
  else if (right === "minimized") classes.push("cad-body--min-right");
  return classes.join(" ");
}

export function editorChromeToggleLabel(panel: EditorChromePanel, minimized: boolean): string {
  return minimized ? TOGGLE_LABELS[panel].expand : TOGGLE_LABELS[panel].minimize;
}
