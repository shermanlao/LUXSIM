import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WORKFLOW_MODES } from "@luxsim/project-io";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official editor view chrome", () => {
  const editor = read("components/editor/BuildingEditor.tsx");
  const css = read("app/globals.css");

  it("clusters view tabs, fullscreen, and isolux/3D toggles on the viewport", () => {
    expect(editor).toContain("editor-view-cluster");
    expect(editor).toContain('aria-label="View and fullscreen"');
    expect(editor).toContain("editor-viewbar__fullscreen");
    expect(editor).toMatch(/\{fullscreen \? "Exit fullscreen" : "Fullscreen"\}/);
    expect(editor).toContain("<Display3dToggle");
    expect(editor).toContain("<PlanIsoluxToggle");
    const clusterIdx = editor.indexOf("editor-view-cluster");
    const fullscreenIdx = editor.indexOf('editor-viewbar__fullscreen');
    const isoluxIdx = editor.indexOf("<PlanIsoluxToggle");
    const displayIdx = editor.indexOf("<Display3dToggle");
    expect(clusterIdx).toBeGreaterThan(0);
    expect(fullscreenIdx).toBeGreaterThan(clusterIdx);
    expect(isoluxIdx).toBeGreaterThan(clusterIdx);
    expect(displayIdx).toBeGreaterThan(clusterIdx);
    // The old isolated right-hand fullscreen slot and the view bar above the
    // canvas must not come back.
    expect(editor).not.toContain("absolute top-3 right-3");
    expect(editor).not.toMatch(
      /className="cad-center"[\s\S]*className="editor-viewbar"[\s\S]*cad-viewport-wrap/
    );
    expect(css).toContain(".editor-view-cluster");
    expect(css).toMatch(/\.cad-viewport-wrap\s*\{[^}]*padding:\s*0;/);
    expect(css).toContain(".cad-chrome");
    expect(editor).toContain('className="cad-chrome"');
    expect(editor).toContain("cad-ribbon__actions");
  });
});

describe("app UI does not show DIALux wording", () => {
  it("renames the verification pack and drops DIALux from user-visible app chrome", () => {
    const editor = read("components/editor/BuildingEditor.tsx");
    const tips = read("lib/ui-tips.ts");
    const home = read("app/page.tsx");
    const layout = read("app/layout.tsx");
    const exportsClient = read("lib/exports-client.ts");

    expect(editor).toContain("Verification pack (zip)");
    expect(editor).toContain("Verification pack downloaded");
    expect(editor).toContain("Design assist · not tender-certified");
    expect(editor).not.toContain("DIALux verification (zip)");
    expect(editor).not.toContain("verify in DIALux");
    expect(editor).not.toContain("DIALux verification zip downloaded");
    expect(editor).not.toContain("desktop DIALux");

    expect(WORKFLOW_MODES.find((m) => m.id === "export")?.hint).toBe(
      "Reports, .lux, verification pack."
    );
    expect(WORKFLOW_MODES.find((m) => m.id === "export")?.hint).not.toMatch(/DIALux/i);

    expect(tips).toContain('title: "Verification pack"');
    expect(tips).toContain("helpKey: \"export.dialuxVerification\"");
    expect(tips).not.toMatch(/title: "DIALux/);
    expect(tips).not.toMatch(/desktop DIALux/);

    expect(home).toContain("verification pack");
    expect(home).not.toMatch(/DIALux/);
    expect(layout).toContain("export PDF and a verification pack.");
    expect(layout).not.toMatch(/DIALux/);

    expect(exportsClient).toContain("-verification-pack.zip");
    expect(exportsClient).not.toContain("-dialux-verification.zip");
    expect(exportsClient).toContain(
      "Verify critical projects in a certified lighting calculation tool."
    );
    expect(exportsClient).not.toMatch(/in DIALux/);
  });
});

describe("Front, Side, and 3D navigation wiring", () => {
  it("zooms and middle-button pans the official elevation views", () => {
    const src = read("components/editor/ElevationView2D.tsx");
    expect(src).toContain("usePlanPointerNav");
    expect(src).toContain("useViewElementSize");
    expect(src).toContain("PLAN_PAN_BUTTON");
    expect(src).toContain("planViewTransform");
    expect(src).toContain("OFFICIAL_PLAN_FIT_MARGIN");
    expect(src).toMatch(/e\.button === PLAN_PAN_BUTTON \|\| e\.button !== 0 \|\| panningRef\.current/);
    expect(src).toContain("setPlanView(DEFAULT_PLAN_ZOOM)");
  });

  it("keeps 3D wheel zoom and pans with the middle button, not the left button", () => {
    const src = read("components/editor/BuildingScene3D.tsx");
    expect(src).toContain("enableZoom");
    expect(src).toContain("enablePan");
    expect(src).toMatch(/LEFT:\s*THREE\.MOUSE\.ROTATE/);
    expect(src).toMatch(/MIDDLE:\s*THREE\.MOUSE\.PAN/);
    expect(src).not.toMatch(/LEFT:\s*THREE\.MOUSE\.PAN/);
    expect(src).not.toMatch(/MIDDLE:\s*THREE\.MOUSE\.DOLLY/);
  });
});
