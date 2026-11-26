import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { editorWorkflowRailPlacement } from "./editor-workflow-panels";

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

describe("editor workflow panels are tab-specific", () => {
  const editor = readSrc("src/components/editor/BuildingEditor.tsx");
  const css = readSrc("src/app/globals.css");
  const guide = readSrc("docs/USER_GUIDE.md");

  const constructionCard = sliceBetween(
    editor,
    'data-construction-room-props=""',
    "showRightCalculationRoom &&",
  );
  const calculationCard = sliceBetween(
    editor,
    'data-calculation-room-props=""',
    "showRightFixtureProps &&",
  );
  const fixtureLibrary = sliceBetween(
    editor,
    'data-fixture-library=""',
    "</aside>",
  );
  const documentation = sliceBetween(
    editor,
    'data-documentation-export=""',
    "showLeftBuilding &&",
  );
  const fixturesTable = sliceBetween(
    editor,
    'data-fixtures-in-project=""',
    "</section>",
  );
  const leftRail = sliceBetween(
    editor,
    'data-cad-left-rail=""',
    "</aside>",
  );
  const rightRail = sliceBetween(
    editor,
    'data-cad-right-rail=""',
    "</aside>",
  );
  const legendGate = editor.slice(
    editor.lastIndexOf("workflow === \"calculation\" &&", editor.indexOf("<FalseColorLegend")),
    editor.indexOf("<FalseColorLegend") + "<FalseColorLegend".length,
  );

  it("Construction hides Fixture library, results, and the scale bar, and shows modelling chrome", () => {
    expect(editor).toContain('showConstructionPlan = workflow === "construction"');
    expect(editor).toContain('showConstructionEditors = workflow === "construction"');
    expect(editor).toContain('showConstructionTools = workflow === "construction" && !readOnly');
    expect(editor).toContain(
      "showRightConstructionRoom = workflow === \"construction\" && !selected && !!activeRoom",
    );
    expect(leftRail).toContain("Import plan");
    expect(leftRail).toContain("showConstructionPlan && !readOnly");
    expect(leftRail).toContain('<h3 className="font-semibold text-sm text-white/95">Tools</h3>');
    expect(leftRail).toContain("showConstructionTools &&");
    expect(leftRail).toContain("Room height (mm)");
    expect(leftRail).toContain("Add storey");
    expect(leftRail).toContain("Copy storey");
    expect(constructionCard).toContain("Height (mm)");
    expect(constructionCard).toContain("Area");
    expect(constructionCard).toContain("Origin (first corner)");
    expect(constructionCard).toContain("Bounding min");
    expect(constructionCard).toContain("ρ {face}");
    expect(constructionCard).not.toContain("Workplane (m)");
    expect(constructionCard).not.toContain("Grid spacing (m)");
    expect(constructionCard).not.toContain("Maintenance factor");
    expect(constructionCard).not.toContain("EN 12464-1 assist");
    expect(editor).toContain('showRightFixtureLibrary = workflow === "light"');
    expect(editor).toContain('showFixturesTable = workflow === "light"');
    expect(editor).toContain('showResultsStrip = workflow === "calculation"');
    expect(legendGate).toMatch(/workflow === "calculation" &&/);
    expect(fixtureLibrary).not.toContain("showConstruction");
  });

  it("Light shows Fixture library, light tools, and the fixtures table only", () => {
    expect(editor).toContain("{showRightFixtureLibrary && (");
    expect(fixtureLibrary).toContain("Fixture library");
    expect(fixtureLibrary).toContain("Add from org library");
    expect(fixtureLibrary).toContain("Upload IES / LDT / GLDF");
    expect(fixtureLibrary).toMatch(/>\s*Generate LDT\s*</);
    expect(fixtureLibrary).toContain("setGenerateLdtOpen(true)");
    expect(fixtureLibrary).not.toContain("<GenerateLdtForm");
    expect(fixtureLibrary).not.toContain("Lumen (required)");
    expect(rightRail).toContain("showRightFixtureProps &&");
    expect(rightRail).toContain('data-fixture-properties=""');
    expect(rightRail).toContain("<PlanCodePlacePanel");
    expect(rightRail).toContain("<RcpDetectPanel");
    expect(rightRail).toContain("<ScheduleImportPanel");
    expect(rightRail).toContain("<FixtureCodeMapPanel");
    expect(rightRail).toContain("<FixtureArrayPanel");
    expect(editor).toMatch(/workflow === "light" && !readOnly && \(\s*<PlanCodePlacePanel/);
    expect(fixturesTable).toContain("Fixtures in project");
    expect(editor).toContain("{showFixturesTable && (");
    expect(leftRail).toContain('cad-section-title">Building');
    // Import plan / Tools / metric editors stay in the left-rail source but are construction-gated.
    expect(leftRail).toContain("showConstructionPlan && !readOnly");
    expect(leftRail).toContain("showConstructionTools &&");
    expect(leftRail).toContain("showConstructionEditors &&");
    expect(documentation).not.toContain("Fixture library");
  });

  it("Calculation shows isoline levels, calc room fields, results, and a gated scale bar", () => {
    expect(editor).toContain('showRightIsolines = workflow === "calculation"');
    expect(rightRail).toContain("{showRightIsolines && (");
    expect(rightRail).toContain('data-isoline-levels-panel=""');
    expect(rightRail).toContain("Isoline levels / 等照度線數值");
    expect(calculationCard).toContain("Workplane (m)");
    expect(calculationCard).toContain('data-show-workplane=""');
    expect(calculationCard).toContain("Grid spacing (m)");
    expect(calculationCard).toContain("Maintenance factor (CIE 97)");
    expect(calculationCard).toContain("EN 12464-1 assist");
    expect(calculationCard).toContain("Area");
    expect(calculationCard).toContain("{activeRoom.name}");
    expect(calculationCard).not.toContain("Height (mm)");
    expect(calculationCard).not.toContain("Origin (first corner)");
    expect(calculationCard).not.toContain("ρ {face}");
    expect(editor).toContain("{showResultsStrip && (");
    expect(editor).toContain("<EditorResultsStrip");
    const resultsIdx = editor.indexOf("{showResultsStrip && (");
    const stripIdx = editor.indexOf("<EditorResultsStrip");
    expect(stripIdx).toBeGreaterThan(resultsIdx);
    expect(legendGate).toContain('display3d === "falsecolor" || display3d === "greyscale"');
    expect(legendGate).toContain("planShowFalseColor && results");
    expect(editor).not.toContain('showFixturesTable = workflow === "calculation"');
  });

  it("Documentation shows the export block on the left and hides the right rail", () => {
    expect(editor).toContain("editorWorkflowRailPlacement");
    expect(editor).toContain("showLeftDocumentation");
    expect(editor).toContain("showLeftBuilding");
    expect(editor).toContain("{showLeftRail && (");
    expect(editor).toContain("{showLeftDocumentation && (");
    expect(editor).toContain("{showLeftBuilding && (");
    expect(editor).not.toContain("showRightDocumentation");
    expect(leftRail).toContain('data-documentation-export=""');
    expect(rightRail).not.toContain('data-documentation-export=""');
    expect(documentation).toContain("Documentation &amp; export");
    expect(documentation).toContain("ProjectSharePanel");
    expect(documentation).toContain("Full PDF report");
    expect(documentation).toContain("Save .lxm");
    expect(documentation).toContain("Verification pack (zip)");
    expect(documentation).not.toContain("Fixture library");
    expect(documentation).not.toContain("Import plan");
    expect(documentation).not.toContain("Isoline levels");
    expect(editor).toContain("editorChromeBodyClassName");
    expect(readSrc("src/lib/editor-chrome-minimize.ts")).toContain("cad-body--no-left");
    expect(css).toContain("cad-body--no-left");
    expect(declsOf(css, ".cad-body")["grid-template-columns"]?.replace(/\s+/g, " ")).toBe(
      "248px minmax(0, 1fr) 288px",
    );
    expect(declsOf(css, ".cad-body.cad-body--no-right")["grid-template-columns"]?.replace(/\s+/g, " ")).toBe(
      "248px minmax(0, 1fr)",
    );
    const panels = sliceBetween(guide, "## 工作分頁與面板 / Workflow panels", "## 匯入圖則 / Import plan");
    expect(panels).toMatch(/左側顯示 \*\*Documentation & export\*\*/);
    expect(panels).toMatch(/the left rail shows \*\*Documentation & export\*\*/);
    expect(panels).toMatch(/左側欄是主要面板/);
    expect(panels).toMatch(/The left rail is the primary panel/);
    expect(panels).toMatch(/左側欄寬度保持不變/);
    expect(panels).toMatch(/The left rail width stays the same/);
    expect(panels).not.toMatch(/隱藏整條左欄/);
    expect(panels).not.toMatch(/the entire left rail is hidden/i);
  });

  it("hides a rail completely and collapses the grid when that tab has no content for it", () => {
    expect(editor).toContain("{showRightRail && (");
    expect(editor).toContain("editorChromeBodyClassName({");
    expect(editor).toContain("showLeftRail");
    expect(editor).toContain("showRightRail");
    expect(editor).not.toContain('className="cad-body"');
    expect(editor).not.toContain(
      'className={`cad-body${showLeftRail ? "" : " cad-body--no-left"}${showRightRail ? "" : " cad-body--no-right"}`}',
    );

    const desktopNoLeft = declsOf(css, ".cad-body.cad-body--no-left");
    const desktopNoRight = declsOf(css, ".cad-body.cad-body--no-right");
    const desktopNeither = declsOf(css, ".cad-body.cad-body--no-left.cad-body--no-right");
    expect(desktopNoLeft["grid-template-columns"]?.replace(/\s+/g, " ")).toBe("minmax(0, 1fr) 288px");
    expect(desktopNoRight["grid-template-columns"]?.replace(/\s+/g, " ")).toBe("248px minmax(0, 1fr)");
    expect(desktopNeither["grid-template-columns"]?.replace(/\s+/g, " ")).toBe("minmax(0, 1fr)");

    const narrow = media1100(css);
    expect(declsOf(narrow, ".cad-body.cad-body--no-left")["grid-template-rows"]).toMatch(
      /minmax\(\s*16rem\s*,\s*1fr\s*\).*minmax\(\s*0\s*,\s*14rem\s*\)/,
    );
    expect(declsOf(narrow, ".cad-body.cad-body--no-right")["grid-template-rows"]).toMatch(
      /minmax\(\s*0\s*,\s*11rem\s*\).*minmax\(\s*16rem\s*,\s*1fr\s*\)/,
    );
    expect(declsOf(narrow, ".cad-body.cad-body--no-left.cad-body--no-right")["grid-template-rows"]).toMatch(
      /minmax\(\s*16rem\s*,\s*1fr\s*\)/,
    );
    expect(declsOf(narrow, ".cad-body.cad-body--no-left")["grid-template-columns"]?.replace(/\s+/g, "")).toBe(
      "1fr",
    );
  });

  it("keeps view-only edit gates on the tab-specific controls", () => {
    expect(leftRail).toContain("showConstructionPlan && !readOnly");
    expect(leftRail).toContain("showConstructionPlan && readOnly && underlay");
    expect(leftRail).toContain("showConstructionEditors && !readOnly");
    expect(leftRail).toContain("showConstructionTools &&");
    expect(editor).toContain("showConstructionTools = workflow === \"construction\" && !readOnly");
    expect(fixtureLibrary).toMatch(/\{!readOnly && \(/);
    const gated = fixtureLibrary.slice(fixtureLibrary.indexOf("{!readOnly && ("));
    expect(gated).toContain("Add from org library");
    expect(gated).toContain("Upload IES / LDT / GLDF");
    expect(gated).toMatch(/>\s*Generate LDT\s*</);
    expect(editor).toMatch(/\{!readOnly && \([\s\S]*?<GenerateLdtDialog/);
    expect(fixturesTable).toContain("{!readOnly && (");
    expect(fixturesTable).toContain("Remove");
    expect(documentation).toContain("{!readOnly && (");
    expect(documentation).toContain("ProjectSharePanel");
  });

  it("does not put DIALux or evo wording in the editor chrome or new guide text", () => {
    expect(constructionCard).not.toMatch(/DIALux|\bevo\b/i);
    expect(calculationCard).not.toMatch(/DIALux|\bevo\b/i);
    expect(fixtureLibrary).not.toMatch(/DIALux|\bevo\b/i);
    const documentationVisible = documentation
      .replace(/data-help-key="[^"]+"/g, "")
      .replace(/onExportDialuxVerification/g, "");
    expect(documentationVisible).toContain("Verification pack (zip)");
    expect(documentationVisible).not.toMatch(/DIALux|\bevo\b/i);
    expect(guide).toMatch(/工作分頁與面板 \/ Workflow panels/);
    const panels = sliceBetween(guide, "## 工作分頁與面板 / Workflow panels", "## 匯入圖則 / Import plan");
    expect(panels).not.toMatch(/DIALux|\bevo\b/i);
  });
});

describe("editorWorkflowRailPlacement keeps the left rail first", () => {
  it("puts Documentation on the left and never uses a right-only layout", () => {
    expect(
      editorWorkflowRailPlacement({ workflow: "export", hasRightContent: false }),
    ).toEqual({
      showLeftDocumentation: true,
      showLeftBuilding: false,
      showLeftRail: true,
      showRightRail: false,
    });
    // Even if leftover right-hand flags were true, Documentation stays left-only.
    expect(
      editorWorkflowRailPlacement({ workflow: "export", hasRightContent: true }),
    ).toEqual({
      showLeftDocumentation: true,
      showLeftBuilding: false,
      showLeftRail: true,
      showRightRail: false,
    });
  });

  it("keeps the Building tree on the left and shows the right rail only when that tab has right content", () => {
    expect(
      editorWorkflowRailPlacement({ workflow: "construction", hasRightContent: false }),
    ).toEqual({
      showLeftDocumentation: false,
      showLeftBuilding: true,
      showLeftRail: true,
      showRightRail: false,
    });
    expect(
      editorWorkflowRailPlacement({ workflow: "construction", hasRightContent: true }),
    ).toEqual({
      showLeftDocumentation: false,
      showLeftBuilding: true,
      showLeftRail: true,
      showRightRail: true,
    });
    expect(
      editorWorkflowRailPlacement({ workflow: "light", hasRightContent: true }),
    ).toMatchObject({ showLeftBuilding: true, showLeftRail: true, showRightRail: true });
    expect(
      editorWorkflowRailPlacement({ workflow: "calculation", hasRightContent: true }),
    ).toMatchObject({ showLeftBuilding: true, showLeftRail: true, showRightRail: true });
  });
});

