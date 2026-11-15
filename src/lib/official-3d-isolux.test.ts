import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildIsoluxModel,
  defaultDisplay3d,
  formatPointLux,
  officialIsoluxModelForRoom,
  pointInPolygon,
  rectPolygon,
} from "@luxsim/project-io";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import type { CalcResults } from "@luxsim/solver";
import {
  PLAN_ISOLUX_HINT,
  PLAN_ISOLUX_NO_RESULTS,
  PLAN_ISOLUX_NO_ROOM,
  planIsoluxControlState,
} from "./plan-isolux-display";
import {
  ISOLUX_LABEL_MIRROR_SCALE_X,
  ISOLUX_WORKPLANE_LIFT_M,
  isoluxLabelSpriteScale,
  isoluxWorkplaneHeightM,
  official3dIsoluxOverlayForRoom,
  official3dIsoluxOverlaysForRooms,
  planToThree,
} from "./scene-3d-isolux";

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function officeRoom(id = "r1"): RoomV2 {
  return {
    id,
    storeyId: "s1",
    name: id === "r1" ? "Office" : "Other",
    polygon: rectPolygon(0, 0, 6, 5),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
  };
}

function lShapedRoom(): RoomV2 {
  return {
    id: "r-l",
    storeyId: "s1",
    name: "Reception",
    polygon: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 7 },
      { x: 0, y: 7 },
    ],
    heightM: 2.8,
    workplaneHeightM: 0.8,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  };
}

function calcResults(lux: number[], opts?: { z?: number; nx?: number; ny?: number; spacing?: number }): CalcResults {
  const nx = opts?.nx ?? 2;
  const ny = opts?.ny ?? 2;
  return {
    version: 1,
    summary: {
      eave: 400,
      emin: Math.min(...lux),
      emax: Math.max(...lux),
      uo: 0.75,
      ugr: 16,
      lpd: 2,
      totalWatts: 30,
      areaM2: 30,
    },
    grid: {
      originX: 0.25,
      originY: 0.25,
      spacing: opts?.spacing ?? 0.5,
      nx,
      ny,
      z: opts?.z ?? 0.75,
      lux,
    },
    meta: {
      interreflection: true,
      bounces: 2,
      calculatedAt: "2026-11-15T04:00:00.000Z",
      disclaimer: "assist",
    },
  };
}

function lShapeGradientResults(): CalcResults {
  const nx = 12;
  const ny = 14;
  const spacing = 0.5;
  const lux: number[] = [];
  const inside: number[] = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x = 0.25 + i * spacing;
      const y = 0.25 + j * spacing;
      const inNotch = x > 3 && y > 4;
      // Invented-looking notch values must not leak into the overlay.
      const v = inNotch ? 9999 : 120 + 80 * x + 60 * y;
      lux.push(v);
      if (!inNotch) inside.push(v);
    }
  }
  const results = calcResults(lux, { nx, ny, spacing, z: 0.9 });
  results.summary.emin = Math.min(...inside);
  results.summary.emax = Math.max(...inside);
  results.summary.eave = inside.reduce((a, b) => a + b, 0) / inside.length;
  return results;
}

function officeScene(opts?: { withResults?: boolean }): { scene: ProjectSceneV2; results: ResultsV2; room: RoomV2 } {
  const room = officeRoom();
  const scene: ProjectSceneV2 = {
    version: 2,
    storeys: [{ id: "s1", name: "GF", elevationM: 3.2, heightM: 3 }],
    rooms: [room],
    underlays: [],
    fixtureLibraryIds: [],
    instances: [
      {
        instanceId: "i1",
        luminaireId: "lum",
        storeyId: "s1",
        roomId: "r1",
        name: "DL",
        position: { x: 3, y: 2.5, z: 2.6 },
        rotationDeg: 0,
      },
    ],
    ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "persp3d", tool: "select" },
  };
  const results: ResultsV2 = {
    version: 2,
    byRoomId: opts?.withResults === false ? {} : { r1: calcResults([200, 400, 350, 550]) },
  };
  return { scene, results, room };
}

function planXY(position: [number, number, number]): { x: number; y: number } {
  return { x: position[0], y: position[2] };
}

describe("official 3D isolux model wiring", () => {
  it("builds workplane contours from officialIsoluxModelForRoom / buildIsoluxModel", () => {
    const { room, results } = officeScene();
    const calc = results.byRoomId.r1!;
    const model = officialIsoluxModelForRoom(room, calc, { mode: "isolines", targetLongSide: 800 });
    expect(model).not.toBeNull();
    expect(buildIsoluxModel(room, calc, { mode: "isolines" })).not.toBeNull();
    const overlay = official3dIsoluxOverlayForRoom(room, calc, 0);
    expect(overlay).not.toBeNull();
    expect(overlay!.model.width).toBe(model!.width);
    expect(overlay!.model.height).toBe(model!.height);
    expect(overlay!.model.contours).toEqual(model!.contours);
    expect(overlay!.model.valueLabels).toEqual(model!.valueLabels);
    const contourCount = model!.contours.reduce((n, c) => n + c.polylines.filter((l) => l.length >= 2).length, 0);
    const overlayCount = overlay!.contours.reduce((n, c) => n + c.polylines.length, 0);
    expect(overlayCount).toBe(contourCount);
    expect(overlayCount).toBeGreaterThan(0);
    expect(overlay!.valueLabels.map((l) => l.text).sort()).toEqual(model!.valueLabels.map((l) => l.text).sort());
    expect(overlay!.valueLabels.some((l) => l.text === "9999")).toBe(false);
    for (const label of overlay!.valueLabels) {
      expect(label.text).toBe(formatPointLux(Number(label.text)));
    }
  });

  it("returns no overlay and invents no numbers when the room has no results", () => {
    const room = officeRoom();
    expect(official3dIsoluxOverlayForRoom(room, undefined, 0)).toBeNull();
    expect(official3dIsoluxOverlayForRoom(room, null, 1)).toBeNull();
    expect(
      official3dIsoluxOverlayForRoom(room, {
        ...calcResults([100, 100, 100, 100]),
        grid: { ...calcResults([100, 100, 100, 100]).grid, lux: [], nx: 0, ny: 0 },
      })
    ).toBeNull();
    expect(official3dIsoluxOverlaysForRooms([room], { version: 2, byRoomId: {} }, 0)).toEqual([]);
    expect(official3dIsoluxOverlaysForRooms([room], null, 0)).toEqual([]);
  });

  it("places contours on the workplane with the official plan→Three mapping", () => {
    const room = lShapedRoom();
    const calc = lShapeGradientResults();
    const elev = 3.2;
    const expectedH = elev + (calc.grid.z ?? room.workplaneHeightM) + ISOLUX_WORKPLANE_LIFT_M;
    expect(isoluxWorkplaneHeightM(room, calc, elev)).toBe(expectedH);
    expect(expectedH).toBe(3.2 + 0.9 + 0.02);
    expect(planToThree(1.25, 4.5, expectedH)).toEqual([1.25, expectedH, 4.5]);

    const overlay = official3dIsoluxOverlayForRoom(room, calc, elev);
    expect(overlay).not.toBeNull();
    expect(overlay!.heightM).toBe(expectedH);
    let points = 0;
    for (const contour of overlay!.contours) {
      for (const line of contour.polylines) {
        for (const p of line) {
          expect(p[1]).toBeCloseTo(expectedH, 8);
          expect(p).toEqual(planToThree(p[0], p[2], expectedH));
          points += 1;
        }
      }
    }
    expect(points).toBeGreaterThan(8);
    for (const label of [...overlay!.contourLabels, ...overlay!.valueLabels]) {
      expect(label.position[1]).toBeCloseTo(expectedH, 8);
    }
    expect(isoluxLabelSpriteScale(0.2)[0]).toBe(ISOLUX_LABEL_MIRROR_SCALE_X * 0.2 * 2.6);
  });

  it("keeps L-shape isolines out of the cut-out, even if the AABB grid has invented notch values", () => {
    const room = lShapedRoom();
    const calc = lShapeGradientResults();
    const overlay = official3dIsoluxOverlayForRoom(room, calc, 0);
    expect(overlay).not.toBeNull();
    expect(overlay!.contours.some((c) => c.polylines.length > 0)).toBe(true);

    const inNotchInterior = (p: { x: number; y: number }) =>
      p.x > 3.08 && p.y > 4.08 && !pointInPolygon(p, room.polygon);

    let outside = 0;
    for (const contour of overlay!.contours) {
      for (const line of contour.polylines) {
        for (const pos of line) {
          const p = planXY(pos);
          if (inNotchInterior(p)) outside += 1;
        }
      }
    }
    for (const label of [...overlay!.contourLabels, ...overlay!.valueLabels]) {
      if (inNotchInterior(planXY(label.position))) outside += 1;
    }
    expect(outside).toBe(0);
    expect(overlay!.valueLabels.some((l) => l.text === "9999")).toBe(false);
    expect(overlay!.contourLabels.some((l) => l.text === "9999")).toBe(false);
  });
});

describe("official 3D isolux editor and PDF path wiring", () => {
  it("adds Isolines as a 3D display mode without removing greyscale or false colour", () => {
    const results: ResultsV2 = { version: 2, byRoomId: { r1: calcResults([200, 400, 350, 550]) } };
    expect(defaultDisplay3d(results, undefined)).toBe("falsecolor");
    expect(defaultDisplay3d(results, "greyscale")).toBe("greyscale");
    expect(defaultDisplay3d(results, "falsecolor")).toBe("falsecolor");
    expect(defaultDisplay3d(results, "isolines")).toBe("isolines");
    expect(defaultDisplay3d({ version: 2, byRoomId: {} }, undefined)).toBe("greyscale");

    const toggle = readSrc("src/components/editor/Display3dToggle.tsx");
    expect(toggle).toContain('btn("greyscale", "Greyscale")');
    expect(toggle).toContain('btn("falsecolor", "False colour")');
    expect(toggle).toContain('btn("isolines", "Isolines", isolinesEnabled)');
    expect(toggle).toContain("Value labels");
    expect(toggle).toContain('helpKey="view.planIsolux"');
    expect(toggle).toContain("disabled={!isolinesEnabled}");

    const scene3d = readSrc("src/components/editor/BuildingScene3D.tsx");
    expect(scene3d).toContain('display3d === "falsecolor"');
    expect(scene3d).toContain("FalseColorPlane");
    expect(scene3d).toContain('display3d === "isolines"');
    expect(scene3d).toContain("Scene3dIsoluxOverlay");
    expect(scene3d).toContain("scale={[-1, 1, 1]}");
    expect(scene3d).toContain("setMirroredFrontFace");
    expect(scene3d).toContain("planToThree");
    expect(scene3d.indexOf("scale={[-1, 1, 1]}")).toBeLessThan(scene3d.indexOf("<Scene3dIsoluxOverlay"));

    const overlay = readSrc("src/components/editor/Scene3dIsoluxOverlay.tsx");
    expect(overlay).toContain("official3dIsoluxOverlaysForRooms");
    expect(overlay).toContain("showValueLabels");
    expect(overlay).toContain("isoluxLabelSpriteScale");
    expect(overlay).toContain("valueLabels");

    const helper = readSrc("src/lib/scene-3d-isolux.ts");
    expect(helper).toContain("officialIsoluxModelForRoom");
    expect(helper).toContain('mode: "isolines"');
    expect(helper).toContain("isoluxPxToWorld");
    expect(helper).toContain("planToThree");

    const types = readSrc("packages/project-io/src/types.ts");
    expect(types).toMatch(/Display3dMode = "greyscale" \| "falsecolor" \| "isolines"/);
    expect(readSrc("packages/project-io/src/migrate.ts")).toContain('raw === "isolines"');
  });

  it("wires official 3D isoline controls in the editor and keeps the official PDF isolux path", () => {
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("showIsolines");
    expect(editor).toContain("isolinesEnabled={planIsoluxControls.enabled}");
    expect(editor).toContain("isolinesReason={planIsoluxControls.reason}");
    expect(editor).toContain("showValueLabels={planValueLabels}");
    expect(editor).toContain("planValueLabels: show");
    expect(editor).toContain("showValueLabels={planValueLabels}");
    expect(editor).toContain("collectOfficialIsoluxSnapshots(scene, results)");
    expect(editor).toContain("isoluxSnapshots,");
    const exportFn = editor.slice(editor.indexOf("async function exportFullPdf"));
    expect(exportFn).toContain("const isoluxSnapshots = collectOfficialIsoluxSnapshots(scene, results)");
    expect(exportFn.indexOf("const isoluxSnapshots = collectOfficialIsoluxSnapshots")).toBeLessThan(
      exportFn.indexOf("captureOfficialReport3dViews")
    );
    expect(exportFn.indexOf("isoluxSnapshots,")).toBeLessThan(exportFn.indexOf("doc.save("));
    expect(exportFn).not.toMatch(/3[Dd].*isoline chapter|isoluxSnapshots3d|collectOfficial3dIsolux/);

    const capture = readSrc("src/lib/render-scene-3d.ts");
    expect(capture).toContain('greyscale: renderMode(opts, "greyscale", camera)');
    expect(capture).toContain('falsecolor: renderMode(opts, "falsecolor", camera)');
    expect(capture).not.toMatch(/renderMode\(opts, "isolines"/);

    const { results } = officeScene();
    expect(planIsoluxControlState(results, null)).toEqual({
      enabled: false,
      reason: PLAN_ISOLUX_NO_ROOM,
    });
    expect(planIsoluxControlState(results, "missing")).toEqual({
      enabled: false,
      reason: PLAN_ISOLUX_NO_RESULTS,
    });
    expect(planIsoluxControlState(results, "r1").enabled).toBe(true);
  });

  it("documents official 3D isolines and value labels", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const gap = readSrc("docs/DIALUX_GAP.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/在 \*\*3D\*\* 視圖/);
    expect(guide).toMatch(/On the \*\*3D\*\* view/);
    expect(guide).toMatch(/同一個 \*\*Value labels\*\* 開關/);
    expect(guide).toMatch(/same \*\*Value labels\*\* control/);
    expect(guide).toMatch(/不會另增一章 3D 等照度線/);
    expect(guide).toMatch(/does not add a separate 3D-isoline chapter/);
    expect(guide).toMatch(/沒有自訂等照度線預設/);
    expect(guide).toMatch(/no custom isoline presets/i);
    expect(gap).toMatch(/official 3D can also show isolines/);
    expect(tips).toContain("PLAN_ISOLUX_HINT");
    expect(PLAN_ISOLUX_HINT).toMatch(/3D view/);
    expect(PLAN_ISOLUX_HINT).toMatch(/Full PDF report/);
  });
});
