import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EDITOR_CHROME_MINIMIZED,
  EDITOR_CHROME_MINIMIZED_STORAGE_KEY,
  EDITOR_CHROME_MINIMIZED_STRIP_PX,
  editorChromeBodyClassName,
  editorChromeRailMode,
  editorChromeRailStripVisible,
  editorChromeToggleLabel,
  parseEditorChromeMinimized,
  patchEditorChromeMinimized,
  readEditorChromeMinimized,
  writeEditorChromeMinimized,
  type EditorChromeMinimized,
} from "./editor-chrome-minimize";

const root = path.resolve(__dirname, "../..");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(root, ...parts), "utf8");
}

function sliceBetween(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  expect(a, `missing start ${start}`).toBeGreaterThan(-1);
  expect(b, `missing end ${end} after ${start}`).toBeGreaterThan(a);
  return src.slice(a, b);
}

function stripMediaBlocks(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const media = css.indexOf("@media", i);
    if (media < 0) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, media);
    const brace = css.indexOf("{", media);
    if (brace < 0) break;
    let depth = 0;
    let end = css.length - 1;
    for (let j = brace; j < css.length; j++) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    i = end + 1;
  }
  return out;
}

function declsOf(css: string, selector: string): Record<string, string> {
  const stripped = stripMediaBlocks(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  const decls: Record<string, string> = {};
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]+)\\}`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped))) {
    for (const chunk of match[1].split(";")) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      if (colon < 0) continue;
      decls[trimmed.slice(0, colon).trim().toLowerCase()] = trimmed.slice(colon + 1).trim();
    }
  }
  return decls;
}

function media1100(css: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /@media\s*\(\s*max-width:\s*1100px\s*\)\s*\{/g;
  const match = re.exec(stripped);
  expect(match, "missing @media (max-width: 1100px)").toBeTruthy();
  const open = match!.index + match![0].lastIndexOf("{");
  let depth = 0;
  for (let i = open; i < stripped.length; i++) {
    if (stripped[i] === "{") depth += 1;
    else if (stripped[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(open + 1, i);
    }
  }
  throw new Error("unclosed 1100px media block");
}

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function installMemoryStorage() {
  const data = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
  };
  vi.stubGlobal("window", { localStorage });
  vi.stubGlobal("localStorage", localStorage);
  return localStorage;
}

const expanded: EditorChromeMinimized = { ...DEFAULT_EDITOR_CHROME_MINIMIZED };

describe("editor chrome minimize helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults every docked panel to expanded", () => {
    expect(DEFAULT_EDITOR_CHROME_MINIMIZED).toEqual({
      left: false,
      right: false,
      fixtures: false,
      results: false,
    });
    expect(parseEditorChromeMinimized(null)).toEqual(expanded);
    expect(parseEditorChromeMinimized("")).toEqual(expanded);
    expect(editorChromeRailMode(true, false)).toBe("expanded");
  });

  it("minimizes and restores each panel independently", () => {
    let state = expanded;
    state = patchEditorChromeMinimized(state, "left", true);
    expect(state).toEqual({ left: true, right: false, fixtures: false, results: false });
    state = patchEditorChromeMinimized(state, "right", true);
    expect(state.left).toBe(true);
    expect(state.right).toBe(true);
    state = patchEditorChromeMinimized(state, "left", false);
    expect(state.left).toBe(false);
    expect(state.right).toBe(true);
    state = patchEditorChromeMinimized(state, "fixtures", true);
    state = patchEditorChromeMinimized(state, "results", true);
    expect(state.fixtures).toBe(true);
    expect(state.results).toBe(true);
    state = patchEditorChromeMinimized(state, "fixtures", false);
    expect(state.fixtures).toBe(false);
    expect(state.results).toBe(true);
  });

  it("keeps the fixtures table and results strip as independent flags", () => {
    const onlyFixtures = patchEditorChromeMinimized(expanded, "fixtures", true);
    const onlyResults = patchEditorChromeMinimized(expanded, "results", true);
    expect(onlyFixtures.fixtures).toBe(true);
    expect(onlyFixtures.results).toBe(false);
    expect(onlyResults.fixtures).toBe(false);
    expect(onlyResults.results).toBe(true);
    expect(onlyFixtures).not.toEqual(onlyResults);
  });

  it("treats a tab-hidden rail as hidden with no restore strip, even if minimized is saved", () => {
    expect(editorChromeRailMode(false, true)).toBe("hidden");
    expect(editorChromeRailMode(false, false)).toBe("hidden");
    expect(editorChromeRailStripVisible(false)).toBe(false);
    expect(editorChromeRailStripVisible(true)).toBe(true);
    expect(
      editorChromeBodyClassName({
        showLeftRail: false,
        showRightRail: true,
        minimized: { left: true, right: false },
      }),
    ).toBe("cad-body cad-body--no-left");
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: false,
        minimized: { left: false, right: true },
      }),
    ).toBe("cad-body cad-body--no-right");
    expect(
      editorChromeBodyClassName({
        showLeftRail: false,
        showRightRail: false,
        minimized: { left: true, right: true },
      }),
    ).toBe("cad-body cad-body--no-left cad-body--no-right");
  });

  it("maps shown minimized rails to min classes, distinct from hidden no- classes", () => {
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: true,
        minimized: { left: false, right: false },
      }),
    ).toBe("cad-body");
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: true,
        minimized: { left: true, right: false },
      }),
    ).toBe("cad-body cad-body--min-left");
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: true,
        minimized: { left: false, right: true },
      }),
    ).toBe("cad-body cad-body--min-right");
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: true,
        minimized: { left: true, right: true },
      }),
    ).toBe("cad-body cad-body--min-left cad-body--min-right");
    expect(
      editorChromeBodyClassName({
        showLeftRail: false,
        showRightRail: true,
        minimized: { left: true, right: true },
      }),
    ).toBe("cad-body cad-body--no-left cad-body--min-right");
    expect(
      editorChromeBodyClassName({
        showLeftRail: true,
        showRightRail: false,
        minimized: { left: true, right: true },
      }),
    ).toBe("cad-body cad-body--min-left cad-body--no-right");
    expect(editorChromeRailMode(true, true)).toBe("minimized");
  });

  it("is SSR-safe and persists only under luxsim.editor.chromeMinimized, not project JSON", () => {
    expect(EDITOR_CHROME_MINIMIZED_STORAGE_KEY).toBe("luxsim.editor.chromeMinimized");
    expect(typeof window).toBe("undefined");
    expect(readEditorChromeMinimized()).toEqual(expanded);
    expect(() =>
      writeEditorChromeMinimized({ left: true, right: true, fixtures: true, results: true }),
    ).not.toThrow();

    const store = installMemoryStorage();
    expect(readEditorChromeMinimized()).toEqual(expanded);
    const saved: EditorChromeMinimized = {
      left: true,
      right: false,
      fixtures: true,
      results: false,
    };
    writeEditorChromeMinimized(saved);
    expect(store.getItem(EDITOR_CHROME_MINIMIZED_STORAGE_KEY)).toBe(
      JSON.stringify(saved),
    );
    expect(readEditorChromeMinimized()).toEqual(saved);
    expect(parseEditorChromeMinimized("{not json")).toEqual(expanded);
    expect(parseEditorChromeMinimized(JSON.stringify({ left: "yes", results: 1 }))).toEqual(
      expanded,
    );
    expect(
      parseEditorChromeMinimized(
        JSON.stringify({ left: true, scene: { ui: { tool: "select" } }, format: "luxsim" }),
      ),
    ).toEqual({ left: true, right: false, fixtures: false, results: false });

    const helperSrc = readSrc("src/lib/editor-chrome-minimize.ts");
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    expect(helperSrc).not.toMatch(/scene\.ui/);
    expect(helperSrc).not.toMatch(/format["']:\s*["']luxsim["']/);
    expect(helperSrc).toContain('EDITOR_CHROME_MINIMIZED_STORAGE_KEY = "luxsim.editor.chromeMinimized"');
    expect(editor).toContain("readEditorChromeMinimized");
    expect(editor).toContain("writeEditorChromeMinimized");
    expect(editor).not.toContain("localStorage.setItem");
    expect(editor).not.toMatch(/ui:\s*\{[\s\S]{0,200}chromeMin/);
    expect(editor).not.toMatch(/scene\.ui\.[a-zA-Z]*[Cc]hrome/);
  });
});

describe("editor chrome minimize wiring and CSS", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const editor = readSrc("src/components/editor/BuildingEditor.tsx");
  const css = readSrc("src/app/globals.css");
  const guide = readSrc("docs/USER_GUIDE.md");
  const toggle = readSrc("src/components/editor/EditorChromeToggle.tsx");
  const helperSrc = readSrc("src/lib/editor-chrome-minimize.ts");
  const stripPx = String(EDITOR_CHROME_MINIMIZED_STRIP_PX);

  it("wires independent minimize controls into the editor chrome, including view-only", () => {
    expect(editor).toContain("editorChromeBodyClassName({");
    expect(editor).toContain("showLeftRail");
    expect(editor).toContain("showRightRail");
    expect(editor).toContain('panel="left"');
    expect(editor).toContain('panel="right"');
    expect(editor).toContain('panel="fixtures"');
    expect(editor).toContain('panel="results"');
    expect(editor).toContain("<EditorChromeToggle");
    expect(editor).toContain("setChromePanelMinimized");
    expect(editor).toContain("{!chromeMin.left && (");
    expect(editor).toContain("{!chromeMin.right && (");
    expect(editor).toContain("{!chromeMin.fixtures && (");
    expect(editor).toContain("{!chromeMin.results && (");
    expect(editor).toContain("data-cad-left-rail=\"\"");
    expect(editor).toContain("data-cad-right-rail=\"\"");
    expect(editor).toContain('data-minimized={chromeMin.left ? "true" : undefined}');
    expect(editor).toContain('data-minimized={chromeMin.right ? "true" : undefined}');

    const toggleBlock = editor.slice(
      editor.indexOf("function setChromePanelMinimized"),
      editor.indexOf("function setChromePanelMinimized") + 800,
    );
    expect(toggleBlock).not.toMatch(/if\s*\(\s*readOnly\s*\)/);
    // Controls are not behind !readOnly.
    const leftToggle = sliceBetween(editor, 'panel="left"', "/>");
    expect(leftToggle).not.toContain("readOnly");
    const fixturesGate = editor.slice(
      editor.indexOf("{showFixturesTable && ("),
      editor.indexOf("{showFixturesTable && (") + 900,
    );
    expect(fixturesGate).toContain('panel="fixtures"');
    expect(fixturesGate).not.toMatch(/\{!readOnly && \(\s*<EditorChromeToggle/);
    const resultsGate = editor.slice(
      editor.indexOf("{showResultsStrip && ("),
      editor.indexOf("{showResultsStrip && (") + 1800,
    );
    expect(resultsGate).toContain('panel="results"');
    expect(resultsGate).not.toMatch(/\{!readOnly && \(\s*<EditorChromeToggle/);
    expect(toggle).toContain("editorChromeToggleLabel");
    expect(toggle).toContain("aria-expanded");
    expect(toggle).toContain('type="button"');
  });

  it("collapses hidden vs minimized desktop columns and 1100px stacked rows", () => {
    const desktopNoLeft = declsOf(css, ".cad-body.cad-body--no-left");
    const desktopNoRight = declsOf(css, ".cad-body.cad-body--no-right");
    const desktopNeither = declsOf(css, ".cad-body.cad-body--no-left.cad-body--no-right");
    expect(compact(desktopNoLeft["grid-template-columns"])).toBe("minmax(0, 1fr) 288px");
    expect(compact(desktopNoRight["grid-template-columns"])).toBe("248px minmax(0, 1fr)");
    expect(compact(desktopNeither["grid-template-columns"])).toBe("minmax(0, 1fr)");

    expect(compact(declsOf(css, ".cad-body.cad-body--min-left")["grid-template-columns"])).toBe(
      `${stripPx}px minmax(0, 1fr) 288px`,
    );
    expect(compact(declsOf(css, ".cad-body.cad-body--min-right")["grid-template-columns"])).toBe(
      `248px minmax(0, 1fr) ${stripPx}px`,
    );
    expect(
      compact(declsOf(css, ".cad-body.cad-body--min-left.cad-body--min-right")["grid-template-columns"]),
    ).toBe(`${stripPx}px minmax(0, 1fr) ${stripPx}px`);
    expect(
      compact(declsOf(css, ".cad-body.cad-body--no-left.cad-body--min-right")["grid-template-columns"]),
    ).toBe(`minmax(0, 1fr) ${stripPx}px`);
    expect(
      compact(declsOf(css, ".cad-body.cad-body--min-left.cad-body--no-right")["grid-template-columns"]),
    ).toBe(`${stripPx}px minmax(0, 1fr)`);

    const narrow = media1100(css);
    expect(declsOf(narrow, ".cad-body.cad-body--no-left")["grid-template-rows"]).toMatch(
      /minmax\(\s*16rem\s*,\s*1fr\s*\).*minmax\(\s*0\s*,\s*14rem\s*\)/,
    );
    expect(declsOf(narrow, ".cad-body.cad-body--min-left")["grid-template-rows"]).toMatch(
      new RegExp(`${stripPx}.*minmax\\(\\s*16rem\\s*,\\s*1fr\\s*\\).*minmax\\(\\s*0\\s*,\\s*14rem\\s*\\)`),
    );
    expect(declsOf(narrow, ".cad-body.cad-body--min-right")["grid-template-rows"]).toMatch(
      new RegExp(`minmax\\(\\s*0\\s*,\\s*11rem\\s*\\).*minmax\\(\\s*16rem\\s*,\\s*1fr\\s*\\).*${stripPx}`),
    );
    expect(
      declsOf(narrow, ".cad-body.cad-body--min-left.cad-body--min-right")["grid-template-rows"],
    ).toMatch(new RegExp(`${stripPx}.*minmax\\(\\s*16rem\\s*,\\s*1fr\\s*\\).*${stripPx}`));
    expect(
      declsOf(narrow, ".cad-body.cad-body--no-left.cad-body--min-right")["grid-template-rows"],
    ).toMatch(new RegExp(`minmax\\(\\s*16rem\\s*,\\s*1fr\\s*\\).*${stripPx}`));
    expect(
      declsOf(narrow, ".cad-body.cad-body--min-left.cad-body--no-right")["grid-template-rows"],
    ).toMatch(new RegExp(`${stripPx}.*minmax\\(\\s*16rem\\s*,\\s*1fr\\s*\\)`));
    expect(declsOf(narrow, ".cad-body.cad-body--min-left")["grid-template-columns"]?.replace(/\s+/g, "")).toBe(
      "1fr",
    );
    expect(css).toContain(".cad-fixtures-panel--minimized");
    expect(css).toContain(".cad-results-chrome--minimized");
  });

  it("uses bilingual labels and does not put DIALux or evo in chrome or new guide text", () => {
    expect(editorChromeToggleLabel("left", false)).toBe("Minimize left panel / 最小化左側欄");
    expect(editorChromeToggleLabel("left", true)).toBe("Expand left panel / 展開左側欄");
    expect(editorChromeToggleLabel("right", false)).toBe("Minimize right panel / 最小化右側欄");
    expect(editorChromeToggleLabel("right", true)).toBe("Expand right panel / 展開右側欄");
    expect(editorChromeToggleLabel("fixtures", false)).toBe(
      "Minimize fixtures table / 最小化專案燈具表",
    );
    expect(editorChromeToggleLabel("fixtures", true)).toBe("Expand fixtures table / 展開專案燈具表");
    expect(editorChromeToggleLabel("results", false)).toBe("Minimize results panel / 最小化結果列");
    expect(editorChromeToggleLabel("results", true)).toBe("Expand results panel / 展開結果列");

    const panels = sliceBetween(guide, "## 工作分頁與面板 / Workflow panels", "## 匯入圖則 / Import plan");
    expect(helperSrc).not.toMatch(/DIALux|\bevo\b/i);
    expect(toggle).not.toMatch(/DIALux|\bevo\b/i);
    expect(panels).not.toMatch(/DIALux|\bevo\b/i);
    expect(editor).toContain("EditorChromeToggle");
  });
});
