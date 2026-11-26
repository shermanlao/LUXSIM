import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EDITOR_SHELL_BG = "#141e26";
const HEADER_SHELL_BG = "#121c24";
const PANEL_SHELL_BG = "#0a1218";
const LIGHT_GRADIENT_MARKERS = ["#d7e7ef", "#f0dcc8", "#eef3f6", "#dfe8ed"];

const srcRoot = path.resolve(__dirname, "..");
const globalsCss = readFileSync(path.join(srcRoot, "app/globals.css"), "utf8");
const cadEditorRootSrc = readFileSync(
  path.join(srcRoot, "components/editor/CadEditorRoot.tsx"),
  "utf8",
);
const appShellSrc = readFileSync(path.join(srcRoot, "components/AppShell.tsx"), "utf8");
const siteFooterSrc = readFileSync(path.join(srcRoot, "components/SiteFooter.tsx"), "utf8");
const editorPageSrc = readFileSync(path.join(srcRoot, "app/projects/[id]/page.tsx"), "utf8");
const projectsListSrc = readFileSync(path.join(srcRoot, "app/projects/page.tsx"), "utf8");
const homeSrc = readFileSync(path.join(srcRoot, "app/page.tsx"), "utf8");
const loginSrc = readFileSync(path.join(srcRoot, "app/login/page.tsx"), "utf8");
const registerSrc = readFileSync(path.join(srcRoot, "app/register/page.tsx"), "utf8");
const workspaceMembersSrc = readFileSync(
  path.join(srcRoot, "app/workspace/members/page.tsx"),
  "utf8",
);
const adminSources = [
  "app/admin/layout.tsx",
  "app/admin/page.tsx",
  "app/admin/users/page.tsx",
  "app/admin/workspaces/page.tsx",
  "app/admin/traffic/page.tsx",
  "app/admin/settings/page.tsx",
].map((rel) => ({ rel, src: readFileSync(path.join(srcRoot, rel), "utf8") }));

type Rule = { selectors: string[]; declarations: Record<string, string> };
type Chrome = { hasEditorRoot: boolean; hasListShell: boolean };

const noShells: Chrome = { hasEditorRoot: false, hasListShell: false };
const editorChrome: Chrome = { hasEditorRoot: true, hasListShell: false };
const listChrome: Chrome = { hasEditorRoot: false, hasListShell: true };

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

function splitAncestorDescendant(selector: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function hasUnscopedCombinator(selector: string): boolean {
  return splitAncestorDescendant(selector).length > 1;
}

function hookFromHas(inner: string): "editor" | "list" | "other" {
  const token = inner.trim();
  if (token === ".cad-editor-root" || token === "div.cad-editor-root") return "editor";
  if (token === ".projects-list-shell" || token === "div.projects-list-shell") return "list";
  return "other";
}

function compoundMatchesElement(
  selector: string,
  element: "html" | "body",
  chrome: Chrome,
): boolean {
  const s = selector.trim();
  if (!s || hasUnscopedCombinator(s)) return false;
  const compound = s.match(/^(html|body)(.*)$/);
  if (!compound) return false;
  if (compound[1] !== element) return false;
  const rest = compound[2] ?? "";
  if (!rest) return true;
  const tokens = [...rest.matchAll(/(:has\(([^)]+)\)|\.[\w-]+)/g)];
  const consumed = tokens.map((t) => t[0]).join("");
  if (consumed !== rest) {
    // Unknown leftover subject qualifier; do not pretend it matches.
    return false;
  }
  for (const token of tokens) {
    if (token[0].startsWith(":has(")) {
      const hook = hookFromHas(token[2]);
      if (hook === "editor" && !chrome.hasEditorRoot) return false;
      if (hook === "list" && !chrome.hasListShell) return false;
      if (hook === "other") return false;
    } else if (token[0].startsWith(".")) {
      // A sticky page class would still apply after unmount. Treat any
      // required class as not present in these document fixtures.
      return false;
    }
  }
  return true;
}

function selectorMatchesPage(
  selector: string,
  element: "html" | "body",
  chrome: Chrome,
): boolean {
  return compoundMatchesElement(selector, element, chrome);
}

function isFooterCompound(compound: string): boolean {
  const s = compound.trim();
  if (!s) return false;
  if (s === "footer" || s === ".site-footer" || s === "footer.site-footer") return true;
  return /^footer(?:\.[\w-]+)*$/.test(s) && !s.includes("cad-editor");
}

function selectorMatchesFooter(selector: string, chrome: Chrome): boolean {
  const parts = splitAncestorDescendant(selector);
  if (parts.length === 1) return isFooterCompound(parts[0]);
  if (parts.length === 2) {
    const ancestorOk =
      compoundMatchesElement(parts[0], "body", chrome) ||
      compoundMatchesElement(parts[0], "html", chrome);
    return ancestorOk && isFooterCompound(parts[1]);
  }
  return false;
}

function selectorMatchesHeader(selector: string, chrome: Chrome): boolean {
  const parts = splitAncestorDescendant(selector);
  if (parts.length === 1) return parts[0] === "header";
  if (parts.length === 2) {
    const ancestorOk =
      compoundMatchesElement(parts[0], "body", chrome) ||
      compoundMatchesElement(parts[0], "html", chrome);
    return ancestorOk && parts[1] === "header";
  }
  return false;
}

function resolvedBackground(
  element: "html" | "body",
  chrome: Chrome,
  rules = parseTopLevelRules(globalsCss),
): string | undefined {
  let background: string | undefined;
  for (const rule of rules) {
    if (!rule.selectors.some((sel) => selectorMatchesPage(sel, element, chrome))) {
      continue;
    }
    if (rule.declarations.background !== undefined) {
      background = rule.declarations.background;
    }
    if (rule.declarations["background-color"] !== undefined) {
      background = rule.declarations["background-color"];
    }
  }
  return background;
}

function resolvedFooterDisplay(
  chrome: Chrome,
  rules = parseTopLevelRules(globalsCss),
): string | undefined {
  let display: string | undefined;
  for (const rule of rules) {
    if (!rule.selectors.some((sel) => selectorMatchesFooter(sel, chrome))) continue;
    if (rule.declarations.display !== undefined) display = rule.declarations.display;
  }
  return display;
}

function resolvedHeaderBackground(
  chrome: Chrome,
  rules = parseTopLevelRules(globalsCss),
): string | undefined {
  let background: string | undefined;
  for (const rule of rules) {
    if (!rule.selectors.some((sel) => selectorMatchesHeader(sel, chrome))) continue;
    if (rule.declarations.background !== undefined) {
      background = rule.declarations.background;
    }
    if (rule.declarations["background-color"] !== undefined) {
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

function isHeaderShellFill(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase().replace(/\s+/g, " ").trim() === HEADER_SHELL_BG;
}

function sourceHasShellHook(src: string): boolean {
  return /CadEditorRoot|cad-editor-root|projects-list-shell/.test(src);
}

const parsedRules = parseTopLevelRules(globalsCss);

describe("CAD editor page background", () => {
  it("mounts the official editor root only on the project editor route", () => {
    expect(cadEditorRootSrc).toMatch(/className="cad-editor-root"/);
    expect(editorPageSrc).toMatch(/<CadEditorRoot>/);
    expect(projectsListSrc).not.toMatch(/CadEditorRoot|cad-editor-root/);
  });

  it("keeps the light office gradient on html/body when no dark project shell is mounted", () => {
    const bodyBg = resolvedBackground("body", noShells);
    expect(isLightOfficeGradient(bodyBg), `body without shells: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(bodyBg)).toBe(false);

    const htmlBg = resolvedBackground("html", noShells);
    expect(htmlBg === undefined || !isEditorShellFill(htmlBg), `html without shells: ${htmlBg}`).toBe(
      true,
    );
    if (htmlBg) expect(htmlBg.toLowerCase()).not.toContain(EDITOR_SHELL_BG);
  });

  it("overrides the light body gradient with the editor shell fill while the editor is mounted", () => {
    const bodyBg = resolvedBackground("body", editorChrome);
    const htmlBg = resolvedBackground("html", editorChrome);
    expect(isEditorShellFill(bodyBg), `body with editor: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(htmlBg), `html with editor: ${htmlBg}`).toBe(true);
    expect(isLightOfficeGradient(bodyBg)).toBe(false);
    expect(isLightOfficeGradient(htmlBg)).toBe(false);
  });

  it("drops the editor dark override after the editor root unmounts when the list shell is also absent", () => {
    const mountedBody = resolvedBackground("body", editorChrome);
    const unmountedBody = resolvedBackground("body", noShells);
    const unmountedHtml = resolvedBackground("html", noShells);
    expect(isEditorShellFill(mountedBody)).toBe(true);
    expect(isLightOfficeGradient(unmountedBody)).toBe(true);
    expect(isEditorShellFill(unmountedBody)).toBe(false);
    expect(unmountedHtml === undefined || !isEditorShellFill(unmountedHtml)).toBe(true);
  });

  it("uses the existing cad-editor shell colour, not a new page palette", () => {
    const editorRule = parsedRules.find((rule) => rule.selectors.includes(".cad-editor"));
    expect(editorRule?.declarations.background?.toLowerCase()).toBe(EDITOR_SHELL_BG);
    expect(resolvedBackground("body", editorChrome)?.toLowerCase()).toBe(
      editorRule?.declarations.background?.toLowerCase(),
    );
  });

  it("still hides the LightX footer on the editor route", () => {
    expect(resolvedFooterDisplay(editorChrome)?.toLowerCase()).toBe("none");
    expect(appShellSrc).toMatch(/<SiteFooter\s*\/>/);
  });
});

describe("signed-in project list uses the light site tone", () => {
  it("uses a list-only hook on /projects and never mounts the editor root there", () => {
    expect(projectsListSrc).toMatch(/className="[^"]*projects-list-shell/);
    expect(projectsListSrc).not.toMatch(/CadEditorRoot|cad-editor-root/);
    expect(existsSync(path.join(srcRoot, "app/projects/layout.tsx"))).toBe(false);
    expect(editorPageSrc).not.toMatch(/projects-list-shell/);
    expect(editorPageSrc).toMatch(/<CadEditorRoot>/);
    expect(projectsListSrc).toMatch(/ProjectsListActions/);
    expect(projectsListSrc).toMatch(/href=\{`\/projects\/\$\{p\.id\}`\}/);
    expect(projectsListSrc).toMatch(/You are not in a workspace yet/);
    expect(projectsListSrc).toMatch(/No projects yet/);
  });

  it("keeps the light office gradient on /projects and does not apply the dark CAD shell there", () => {
    const bodyBg = resolvedBackground("body", listChrome);
    const htmlBg = resolvedBackground("html", listChrome);
    expect(isLightOfficeGradient(bodyBg), `body with list shell: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(bodyBg), `body with list shell: ${bodyBg}`).toBe(false);
    expect(htmlBg === undefined || !isEditorShellFill(htmlBg), `html with list shell: ${htmlBg}`).toBe(
      true,
    );
    if (htmlBg) expect(isLightOfficeGradient(htmlBg) || !isEditorShellFill(htmlBg)).toBe(true);
  });

  it("keeps the LightX footer visible on /projects", () => {
    expect(siteFooterSrc).toMatch(/<footer className="site-footer/);
    expect(appShellSrc).toMatch(/<SiteFooter\s*\/>/);
    const display = resolvedFooterDisplay(listChrome);
    expect(display === undefined || display.toLowerCase() !== "none", `list footer display: ${display}`).toBe(
      true,
    );
    expect(resolvedFooterDisplay(editorChrome)?.toLowerCase()).toBe("none");
  });

  it("does not force the dark list shell onto login, home, register, admin, or workspace members", () => {
    expect(sourceHasShellHook(homeSrc)).toBe(false);
    expect(sourceHasShellHook(loginSrc)).toBe(false);
    expect(sourceHasShellHook(registerSrc)).toBe(false);
    expect(sourceHasShellHook(workspaceMembersSrc)).toBe(false);
    for (const page of adminSources) {
      expect(sourceHasShellHook(page.src), page.rel).toBe(false);
    }

    const bodyBg = resolvedBackground("body", noShells);
    const htmlBg = resolvedBackground("html", noShells);
    expect(isLightOfficeGradient(bodyBg), `login/home body: ${bodyBg}`).toBe(true);
    expect(isEditorShellFill(bodyBg)).toBe(false);
    expect(htmlBg === undefined || !isEditorShellFill(htmlBg)).toBe(true);

    for (const rule of parsedRules) {
      for (const sel of rule.selectors) {
        const parts = splitAncestorDescendant(sel);
        if (parts.length !== 1) continue;
        if (parts[0] !== "html" && parts[0] !== "body" && parts[0] !== "html, body") {
          // compoundMatches already requires html/body; bare html/body only.
          const bare = /^(html|body)$/.test(parts[0]);
          if (!bare) continue;
        }
        const bg = rule.declarations.background ?? rule.declarations["background-color"];
        if (bg && isEditorShellFill(bg)) {
          throw new Error(`unscoped dark page fill on ${sel}: ${bg}`);
        }
      }
    }
  });

  it("does not restyle the project list, header, or cards with the dark CAD palette", () => {
    const listPanel = parsedRules.find((rule) =>
      rule.selectors.includes(".projects-list-shell .panel"),
    );
    expect(listPanel).toBeUndefined();
    const listShell = parsedRules.find((rule) => rule.selectors.includes(".projects-list-shell"));
    expect(listShell).toBeUndefined();
    expect(isHeaderShellFill(resolvedHeaderBackground(listChrome))).toBe(false);
    expect(isHeaderShellFill(resolvedHeaderBackground(editorChrome))).toBe(true);
    expect(isLightOfficeGradient(resolvedBackground("body", listChrome))).toBe(true);
    expect(isEditorShellFill(resolvedBackground("body", listChrome))).toBe(false);
    expect(globalsCss).not.toMatch(/html:has\(\.projects-list-shell\)/);
    expect(globalsCss).not.toMatch(/body:has\(\.projects-list-shell\)/);
  });
});
