import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(__dirname, "..");
const globalsCss = readFileSync(path.join(srcRoot, "app/globals.css"), "utf8");
const cadEditorRootSrc = readFileSync(
  path.join(srcRoot, "components/editor/CadEditorRoot.tsx"),
  "utf8",
);
const buildingEditorSrc = readFileSync(
  path.join(srcRoot, "components/editor/BuildingEditor.tsx"),
  "utf8",
);
const appShellSrc = readFileSync(path.join(srcRoot, "components/AppShell.tsx"), "utf8");

type Rule = { selectors: string[]; declarations: Record<string, string> };

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function skipBlock(css: string, openBrace: number): number {
  let depth = 0;
  for (let i = openBrace; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

function splitSelectors(selectorText: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of selectorText) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseDeclarations(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  for (const chunk of body.split(";")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();
    decls[prop] = value;
  }
  return decls;
}

/** Top-level style rules only; @media / @theme / @import are skipped. */
function parseTopLevelRules(cssText: string): Rule[] {
  const css = stripComments(cssText);
  const rules: Rule[] = [];
  let i = 0;
  while (i < css.length) {
    const start = css.slice(i).search(/\S/);
    if (start < 0) break;
    i += start;
    if (css.startsWith("@", i)) {
      const brace = css.indexOf("{", i);
      if (brace < 0) break;
      i = skipBlock(css, brace) + 1;
      continue;
    }
    const brace = css.indexOf("{", i);
    if (brace < 0) break;
    const selectorText = css.slice(i, brace).trim();
    const end = skipBlock(css, brace);
    const body = css.slice(brace + 1, end);
    if (!body.includes("{")) {
      rules.push({
        selectors: splitSelectors(selectorText),
        declarations: parseDeclarations(body),
      });
    }
    i = end + 1;
  }
  return rules;
}

function mergedDecls(rules: Rule[], selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.selectors.includes(selector)) Object.assign(out, rule.declarations);
  }
  return out;
}

function isViewportHeight(value: string | undefined): boolean {
  if (!value) return false;
  const compact = value.toLowerCase().replace(/\s+/g, "");
  return (
    compact === "100dvh" ||
    compact === "100svh" ||
    compact === "100vh" ||
    compact === "100%" ||
    compact === "100lvh"
  );
}

function overflowHides(value: string | undefined): boolean {
  if (!value) return false;
  const first = value.toLowerCase().trim().split(/\s+/)[0];
  return first === "hidden" || first === "clip";
}

function overflowYScrolls(decls: Record<string, string>): boolean {
  const y = (decls["overflow-y"] ?? "").toLowerCase().trim();
  if (y === "auto" || y === "scroll") return true;
  const both = (decls.overflow ?? "").toLowerCase().trim();
  const parts = both.split(/\s+/);
  // overflow: auto | scroll, or overflow: hidden auto
  if (parts.length === 1) return parts[0] === "auto" || parts[0] === "scroll";
  if (parts.length >= 2) return parts[1] === "auto" || parts[1] === "scroll";
  return false;
}

function flexFills(value: string | undefined): boolean {
  if (!value) return false;
  const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (compact === "1" || compact === "1 1 0" || compact === "1 1 0%" || compact === "1 1 auto") {
    return true;
  }
  return /(?:^|;)\s*1(?:\s+1\s+0%?)?\s*$/.test(compact);
}

function minHeightAllowsShrink(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim() === "0" || value.trim() === "0px";
}

function parseMaxWidth1100CadBody(): Record<string, string> | null {
  const css = stripComments(globalsCss);
  const mediaRe = /@media\s*\(\s*max-width:\s*1100px\s*\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = mediaRe.exec(css))) {
    const end = skipBlock(css, match.index + match[0].lastIndexOf("{"));
    const body = css.slice(match.index + match[0].length, end);
    const innerRules: Rule[] = [];
    let i = 0;
    while (i < body.length) {
      const start = body.slice(i).search(/\S/);
      if (start < 0) break;
      i += start;
      const brace = body.indexOf("{", i);
      if (brace < 0) break;
      const selectorText = body.slice(i, brace).trim();
      const close = skipBlock(body, brace);
      const ruleBody = body.slice(brace + 1, close);
      if (!ruleBody.includes("{")) {
        innerRules.push({
          selectors: splitSelectors(selectorText),
          declarations: parseDeclarations(ruleBody),
        });
      }
      i = close + 1;
    }
    const decls = mergedDecls(innerRules, ".cad-body");
    if (Object.keys(decls).length) return decls;
  }
  return null;
}

const rules = parseTopLevelRules(globalsCss);

describe("CAD editor shell keeps the canvas in view", () => {
  it("still mounts the official editor root hook", () => {
    expect(cadEditorRootSrc).toMatch(/className="cad-editor-root"/);
    expect(appShellSrc).toMatch(/className="app-shell min-h-screen flex flex-col"/);
  });

  it("height-constrains the editor route to the viewport", () => {
    const html = mergedDecls(rules, "html:has(.cad-editor-root)");
    const body = mergedDecls(rules, "body:has(.cad-editor-root)");
    expect(isViewportHeight(html.height), `html height: ${html.height}`).toBe(true);
    expect(isViewportHeight(body.height), `body height: ${body.height}`).toBe(true);
    expect(overflowHides(html.overflow), `html overflow: ${html.overflow}`).toBe(true);
    expect(overflowHides(body.overflow), `body overflow: ${body.overflow}`).toBe(true);

    const shell = mergedDecls(rules, "body:has(.cad-editor-root) .app-shell");
    expect(isViewportHeight(shell.height) || shell.height === "100%", `app-shell height: ${shell.height}`).toBe(
      true,
    );
    expect(minHeightAllowsShrink(shell["min-height"]), `app-shell min-height: ${shell["min-height"]}`).toBe(
      true,
    );
    expect(overflowHides(shell.overflow), `app-shell overflow: ${shell.overflow}`).toBe(true);

    const main = mergedDecls(rules, "main:has(.cad-editor-root)");
    expect(flexFills(main.flex), `main flex: ${main.flex}`).toBe(true);
    expect(minHeightAllowsShrink(main["min-height"])).toBe(true);
    expect(main["flex-direction"]).toBe("column");
  });

  it("lets the official root fill the remaining height without growing the page", () => {
    const root = mergedDecls(rules, ".cad-editor-root");
    expect(flexFills(root.flex), `root flex: ${root.flex}`).toBe(true);
    expect(root["flex-direction"]).toBe("column");
    expect(minHeightAllowsShrink(root["min-height"]), `root min-height: ${root["min-height"]}`).toBe(true);
    expect(root["min-height"] ?? "").not.toMatch(/100dvh|100vh|calc\(/);
    expect(overflowHides(root.overflow), `root overflow: ${root.overflow}`).toBe(true);

    const editor = mergedDecls(rules, ".cad-editor");
    expect(flexFills(editor.flex)).toBe(true);
    expect(editor["flex-direction"]).toBe("column");
    expect(minHeightAllowsShrink(editor["min-height"])).toBe(true);
    expect(overflowHides(editor.overflow)).toBe(true);
  });

  it("uses a viewport-bounded grid whose canvas column fills remaining height", () => {
    const body = mergedDecls(rules, ".cad-body");
    expect(body.display).toBe("grid");
    expect(flexFills(body.flex)).toBe(true);
    expect(minHeightAllowsShrink(body["min-height"])).toBe(true);
    expect(overflowHides(body.overflow)).toBe(true);
    expect(body["grid-template-columns"]).toMatch(/248px.*minmax\(0,\s*1fr\).*288px/);
    expect(body["grid-template-rows"]).toMatch(/minmax\(\s*0\s*,\s*1fr\s*\)/);

    const center = mergedDecls(rules, ".cad-center");
    expect(center.display).toBe("flex");
    expect(center["flex-direction"]).toBe("column");
    expect(minHeightAllowsShrink(center["min-height"])).toBe(true);

    const viewport = mergedDecls(rules, ".cad-viewport-wrap");
    expect(flexFills(viewport.flex), `viewport flex: ${viewport.flex}`).toBe(true);
    expect(minHeightAllowsShrink(viewport["min-height"])).toBe(true);
    expect(viewport.display).toBe("flex");
    expect(viewport["flex-direction"]).toBe("column");
  });

  it("scrolls a long right rail and left tree inside their columns", () => {
    const rails = mergedDecls(rules, ".cad-left,.cad-right");
    const left = { ...rails, ...mergedDecls(rules, ".cad-left") };
    const right = { ...rails, ...mergedDecls(rules, ".cad-right") };
    // parseTopLevelRules stores exact selector strings; the combined rule
    // is ".cad-left,\n.cad-right" split into two selectors.
    const combinedLeft = mergedDecls(rules, ".cad-left");
    const combinedRight = mergedDecls(rules, ".cad-right");
    expect(overflowYScrolls({ ...rails, ...combinedLeft, ...left })).toBe(true);
    expect(overflowYScrolls({ ...rails, ...combinedRight, ...right })).toBe(true);
    expect(minHeightAllowsShrink(combinedLeft["min-height"] ?? rails["min-height"])).toBe(true);
    expect(minHeightAllowsShrink(combinedRight["min-height"] ?? rails["min-height"])).toBe(true);
  });

  it("keeps the stacked narrow layout from burying the canvas under the rails", () => {
    const narrow = parseMaxWidth1100CadBody();
    expect(narrow, "missing @media (max-width: 1100px) .cad-body").toBeTruthy();
    expect(narrow!["grid-template-columns"]?.replace(/\s+/g, "")).toBe("1fr");
    const rows = narrow!["grid-template-rows"] ?? "";
    expect(rows).toMatch(/minmax\(\s*16rem\s*,\s*1fr\s*\)/);
    expect(rows).toMatch(/minmax\(\s*0\s*,\s*11rem\s*\)/);
    expect(rows).toMatch(/minmax\(\s*0\s*,\s*14rem\s*\)/);
  });

  it("does not lock overflow on pages that are not the editor", () => {
    for (const rule of rules) {
      for (const sel of rule.selectors) {
        const isEditorScoped = sel.includes(".cad-editor-root") || sel.includes(".cad-editor");
        if (isEditorScoped) continue;
        const bare = /^(html|body|html body)$/.test(sel.trim());
        if (!bare) continue;
        expect(
          overflowHides(rule.declarations.overflow),
          `unscoped overflow hidden on ${sel}`,
        ).toBe(false);
      }
    }
    const listHtml = mergedDecls(rules, "html:has(.projects-list-shell)");
    const listBody = mergedDecls(rules, "body:has(.projects-list-shell)");
    expect(overflowHides(listHtml.overflow), `list html overflow: ${listHtml.overflow}`).toBe(false);
    expect(overflowHides(listBody.overflow), `list body overflow: ${listBody.overflow}`).toBe(false);
  });

  it("keeps the existing fullscreen path and idle Esc exit", () => {
    expect(buildingEditorSrc).toMatch(/const \[fullscreen, setFullscreen\] = useState\(false\)/);
    expect(buildingEditorSrc).toMatch(/fixed inset-0 z-\[100\]/);
    expect(buildingEditorSrc).toMatch(/Exit fullscreen/);
    expect(buildingEditorSrc).toMatch(/\{fullscreen \? "Exit fullscreen" : "Fullscreen"\}/);
    expect(buildingEditorSrc).toMatch(/if \(e\.key === "Escape"\) setFullscreen\(false\)/);
    // Fixtures list under the canvas must not steal the remaining height.
    expect(buildingEditorSrc).toMatch(/shrink-0 px-2 pb-2 max-h-40 overflow-auto/);
    expect(buildingEditorSrc).toContain("editor-view-cluster");
    expect(buildingEditorSrc).toContain('className="cad-chrome"');
  });
});
