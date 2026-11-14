import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EDITOR_SHELL_BG = "#141e26";
const LIGHT_GRADIENT_MARKERS = ["#d7e7ef", "#f0dcc8", "#eef3f6", "#dfe8ed"];

const globalsCss = readFileSync(
  path.resolve(__dirname, "../app/globals.css"),
  "utf8",
);
const cadEditorRootSrc = readFileSync(
  path.resolve(__dirname, "../components/editor/CadEditorRoot.tsx"),
  "utf8",
);
const editorPageSrc = readFileSync(
  path.resolve(__dirname, "../app/projects/[id]/page.tsx"),
  "utf8",
);
const projectsListSrc = readFileSync(
  path.resolve(__dirname, "../app/projects/page.tsx"),
  "utf8",
);

type Rule = { selectors: string[]; declarations: Record<string, string> };

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
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
    // Nested blocks are not html/body page backgrounds; skip those rules.
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

function hasUnscopedCombinator(selector: string): boolean {
  let depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) {
      // Ignore whitespace around the compound selector itself.
      const rest = selector.slice(i);
      if (/^\s*$/.test(rest)) continue;
      if (/^[>+~]/.test(rest.trimStart()) || /^\s+[^\s>+~]/.test(rest)) {
        // There's another compound after this one.
        if (/\S/.test(selector.slice(i))) return true;
      }
    }
  }
  return false;
}

function selectorMatchesPage(
  selector: string,
  element: "html" | "body",
  hasEditorRoot: boolean,
): boolean {
  const s = selector.trim();
  if (!s || hasUnscopedCombinator(s)) return false;
  // Also allow classes / other pseudos on html/body, e.g. html.cad-editor-page
  const compound = s.match(/^(html|body)(.*)$/);
  if (!compound) return false;
  if (compound[1] !== element) return false;
  const rest = compound[2] ?? "";
  if (!rest) return true;
  // :has(.cad-editor-root) — and repeats
  const tokens = [...rest.matchAll(/(:has\(([^)]+)\)|\.[\w-]+)/g)];
  const consumed = tokens.map((t) => t[0]).join("");
  if (consumed !== rest) {
    // Unknown leftover subject qualifier; do not pretend it matches.
    return false;
  }
  for (const token of tokens) {
    if (token[0].startsWith(":has(")) {
      const inner = token[2].trim();
      const wantsEditor = inner === ".cad-editor-root" || inner === "div.cad-editor-root";
      if (wantsEditor && !hasEditorRoot) return false;
      if (!wantsEditor) return false;
    } else if (token[0].startsWith(".")) {
      // A sticky page class would still apply after unmount. Treat any
      // required class as not present in these document fixtures.
      return false;
    }
  }
  return true;
}

function resolvedBackground(
  element: "html" | "body",
  hasEditorRoot: boolean,
  rules = parseTopLevelRules(globalsCss),
): string | undefined {
  let background: string | undefined;
  for (const rule of rules) {
    if (!rule.selectors.some((sel) => selectorMatchesPage(sel, element, hasEditorRoot))) {
      continue;
    }
    if (rule.declarations.background !== undefined) {
      background = rule.declarations.background;
    }
    if (rule.declarations["background-color"] !== undefined) {
      // A later background-color still paints the page if background was a
      // shorthand earlier; record it as the effective color when present.
      background = rule.declarations["background-color"];
    }
  }
  return background;
}

function isLightOfficeGradient(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes("gradient") &&
    LIGHT_GRADIENT_MARKERS.every((c) => lower.includes(c))
  );
}

function isEditorShellFill(value: string | undefined): boolean {
  if (!value) return false;
  const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
  return compact === EDITOR_SHELL_BG && !compact.includes("gradient");
}

describe("CAD editor page background", () => {
  it("mounts the official editor root only on the project editor route", () => {
    expect(cadEditorRootSrc).toMatch(/className="cad-editor-root"/);
    expect(editorPageSrc).toMatch(/<CadEditorRoot>/);
    expect(projectsListSrc).not.toMatch(/CadEditorRoot|cad-editor-root/);
  });

  it("keeps the light office gradient on html/body when the editor is not mounted", () => {
    const bodyBg = resolvedBackground("body", false);
    expect(isLightOfficeGradient(bodyBg), `body without editor: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(bodyBg)).toBe(false);

    const htmlBg = resolvedBackground("html", false);
    expect(htmlBg === undefined || !isEditorShellFill(htmlBg), `html without editor: ${htmlBg}`).toBe(
      true,
    );
    if (htmlBg) expect(htmlBg.toLowerCase()).not.toContain(EDITOR_SHELL_BG);
  });

  it("overrides the light body gradient with the editor shell fill while the editor is mounted", () => {
    const bodyBg = resolvedBackground("body", true);
    const htmlBg = resolvedBackground("html", true);
    expect(isEditorShellFill(bodyBg), `body with editor: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(htmlBg), `html with editor: ${htmlBg}`).toBe(true);
    expect(isLightOfficeGradient(bodyBg)).toBe(false);
    expect(isLightOfficeGradient(htmlBg)).toBe(false);
  });

  it("drops the dark override after the editor root unmounts, as on leave to /projects", () => {
    const mountedBody = resolvedBackground("body", true);
    const unmountedBody = resolvedBackground("body", false);
    const unmountedHtml = resolvedBackground("html", false);
    expect(isEditorShellFill(mountedBody)).toBe(true);
    expect(isLightOfficeGradient(unmountedBody)).toBe(true);
    expect(isEditorShellFill(unmountedBody)).toBe(false);
    expect(unmountedHtml === undefined || !isEditorShellFill(unmountedHtml)).toBe(true);
  });

  it("uses the existing cad-editor shell colour, not a new page palette", () => {
    const rules = parseTopLevelRules(globalsCss);
    const editorRule = rules.find((rule) => rule.selectors.includes(".cad-editor"));
    expect(editorRule?.declarations.background?.toLowerCase()).toBe(EDITOR_SHELL_BG);
    expect(resolvedBackground("body", true)?.toLowerCase()).toBe(
      editorRule?.declarations.background?.toLowerCase(),
    );
  });
});
