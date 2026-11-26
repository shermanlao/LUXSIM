import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { OFFICIAL_DWG_IMPORTED_STATUS } from "@luxsim/project-io";

function readSrc(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("official Import plan panel and DWG status", () => {
  const editor = readSrc("src/components/editor/BuildingEditor.tsx");

  it("places the Import plan section at the top of the left panel, before Building", () => {
    const aside = editor.indexOf('data-cad-left-rail=""');
    const importTitle = editor.indexOf(
      '<p className="cad-section-title">Import plan</p>'
    );
    const buildingTitle = editor.indexOf(
      '<p className="cad-section-title">Building</p>'
    );
    expect(aside).toBeGreaterThan(-1);
    expect(importTitle).toBeGreaterThan(aside);
    expect(buildingTitle).toBeGreaterThan(importTitle);
    const window = editor.slice(aside, buildingTitle);
    expect(window).toContain("showConstructionPlan && !readOnly");
    expect(window).toContain("showConstructionPlan && readOnly && underlay");
    expect(window).not.toContain("cad-panel-hidden");
    expect(window).toContain('accept=".png,.jpg,.jpeg,.webp,.pdf,.dxf,.dwg,.ifc"');
    expect(window).toContain("Image / PDF / DXF / DWG / IFC");
    expect(window).toContain("void importPlan(");
    expect(editor.indexOf('<p className="cad-section-title">Import plan</p>', importTitle + 1)).toBe(-1);
  });

  it("keeps the official importing-plan wait and shows a DWG success status", () => {
    expect(editor).toContain("officialWait.run(OFFICIAL_WAIT_COPY.importingPlan");
    expect(editor).toContain("OFFICIAL_DWG_IMPORTED_STATUS");
    expect(OFFICIAL_DWG_IMPORTED_STATUS).toBe("Plan imported from DWG.");
    expect(editor).not.toContain("DWG stored — upload DXF for linework");
    expect(editor).not.toContain("conversion is not available in this build");
    const fnStart = editor.indexOf("async function importPlan");
    const fnEnd = editor.indexOf("function onCalibrate", fnStart);
    const fn = editor.slice(fnStart, fnEnd);
    expect(fn).toContain("if (!res.ok)");
    expect(fn).toContain("setStatus(data.error || \"Import failed\")");
    expect(fn).toContain("dxfEntities: meta.entities");
  });
});
