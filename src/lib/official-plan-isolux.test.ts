import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildFullReportPdf,
  buildIsoluxModel,
  collectOfficialIsoluxSnapshots,
  formatPointLux,
  hasCalcGrid,
  officialIsoluxModelForRoom,
  officialIsoluxModelsByRoom,
  OFFICIAL_FALSE_COLOR_SCALE,
  OFFICIAL_PDF_ISOLUX_RENDER,
  rectPolygon,
  renderIsoluxModelPngDataUrl,
} from "@luxsim/project-io";
import type { IsoluxModel, ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import type { CalcResults } from "@luxsim/solver";
import {
  DEFAULT_PLAN_ISOLUX_MODE,
  PLAN_ISOLUX_HINT,
  PLAN_ISOLUX_NO_RESULTS,
  PLAN_ISOLUX_NO_ROOM,
  normalizePlanIsoluxMode,
  planIsoluxControlState,
  planIsoluxHasResults,
} from "./plan-isolux-display";
import {
  captureOfficialReport3dViews,
  REPORT_3D_OMITTED_STATUS,
} from "./official-pdf-3d-capture";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=";


const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgADADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2OiiigAooooAKKKKACiiigAooooAKKKKAP//Z";

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

function calcResults(lux: number[]): CalcResults {
  const nx = 2;
  const ny = 2;
  return {
    version: 1,
    summary: {
      eave: 400,
      emin: 300,
      emax: 500,
      uo: 0.75,
      ugr: 16,
      lpd: 2,
      totalWatts: 30,
      areaM2: 30,
    },
    grid: {
      originX: 0.25,
      originY: 0.25,
      spacing: 0.5,
      nx,
      ny,
      z: 0.75,
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

function officeScene(opts?: { withResults?: boolean; secondRoom?: boolean }): {
  scene: ProjectSceneV2;
  results: ResultsV2;
  room: RoomV2;
} {
  const room = officeRoom();
  const rooms = opts?.secondRoom ? [room, officeRoom("r2")] : [room];
  const scene: ProjectSceneV2 = {
    version: 2,
    storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
    rooms,
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
    ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
  };
  const results: ResultsV2 = {
    version: 2,
    byRoomId: opts?.withResults === false ? {} : { r1: calcResults([300, 400, 400, 500]) },
  };
  return { scene, results, room };
}

function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

describe("plan isolux control state", () => {
  it("defaults to false colour and treats only isolines as the other official mode", () => {
    expect(DEFAULT_PLAN_ISOLUX_MODE).toBe("falsecolor");
    expect(normalizePlanIsoluxMode(undefined)).toBe("falsecolor");
    expect(normalizePlanIsoluxMode("isolines")).toBe("isolines");
    expect(normalizePlanIsoluxMode("greyscale")).toBe("falsecolor");
  });

  it("disables the official plan toggles when the selected room has no results", () => {
    const { results } = officeScene({ withResults: true });
    expect(planIsoluxControlState(results, null)).toEqual({
      enabled: false,
      reason: PLAN_ISOLUX_NO_ROOM,
    });
    expect(planIsoluxControlState(results, "missing")).toEqual({
      enabled: false,
      reason: PLAN_ISOLUX_NO_RESULTS,
    });
    expect(planIsoluxHasResults({ version: 2, byRoomId: {} }, "r1")).toBe(false);
    expect(hasCalcGrid(undefined)).toBe(false);
    const ok = planIsoluxControlState(results, "r1");
    expect(ok.enabled).toBe(true);
    expect(ok.reason).toBeNull();
  });
});

describe("isolux model-to-view wiring", () => {
  it("builds contours and value labels from the official model, and invents nothing without results", () => {
    const { room, results } = officeScene({ withResults: true });
    expect(officialIsoluxModelForRoom(room, undefined)).toBeNull();
    expect(officialIsoluxModelForRoom(room, results.byRoomId.r2)).toBeNull();
    expect(
      officialIsoluxModelForRoom(room, {
        ...results.byRoomId.r1!,
        grid: { ...results.byRoomId.r1!.grid, lux: [], nx: 0, ny: 0 },
      })
    ).toBeNull();

    const model = officialIsoluxModelForRoom(room, results.byRoomId.r1, {
      mode: "isolines",
      fixtures: officeScene().scene.instances,
    });
    expect(model).not.toBeNull();
    expect(model!.valueLabels.length).toBeGreaterThan(0);
    const lux = results.byRoomId.r1!.grid.lux.filter((v) => v > 0);
    for (const label of model!.valueLabels) {
      expect(lux.map(formatPointLux)).toContain(label.text);
    }
    expect(model!.contours.every((c) => Number.isFinite(c.level))).toBe(true);
    expect(model!.valueLabels.some((l) => l.text === "9999")).toBe(false);
  });

  it("keeps official false-colour pixels on the absolute ramp and can skip contours", () => {
    const { room, results } = officeScene({ withResults: true });
    const calc = results.byRoomId.r1!;
    const absolute = officialIsoluxModelForRoom(room, calc, {
      mode: "falsecolor",
      targetLongSide: 80,
      includeContours: false,
      includeValueLabels: false,
    });
    const official = officialIsoluxModelForRoom(room, calc, {
      mode: "falsecolor",
      colorScale: OFFICIAL_FALSE_COLOR_SCALE,
      targetLongSide: 80,
      includeContours: false,
      includeValueLabels: false,
    });
    expect(absolute).not.toBeNull();
    expect(official).not.toBeNull();
    expect(absolute!.contours).toEqual([]);
    expect(absolute!.valueLabels).toEqual([]);
    expect(official!.field).toEqual(absolute!.field);
    expect(absolute!.field.some((v) => v > 0)).toBe(true);
  });

  it("uses formatPointLux text for grid labels and omits non-positive cells", () => {
    expect(formatPointLux(150)).toBe("150");
    expect(formatPointLux(25)).toBe("25");
    expect(formatPointLux(9.4)).toBe("9.4");
    const { room } = officeScene();
    const mixed = calcResults([0, 300, 0, 500]);
    const model = buildIsoluxModel(room, mixed, { mode: "isolines" });
    expect(model).not.toBeNull();
    const texts = model!.valueLabels.map((l) => l.text).sort();
    expect(texts).toEqual(["300", "500"]);
  });
});

describe("official isolux snapshot generation and PDF wiring", () => {
  it("collects isolux snapshots only for rooms that already have results", () => {
    const { scene, results } = officeScene({ withResults: true, secondRoom: true });
    const render = vi.fn((model: IsoluxModel) => {
      expect(model.valueLabels.length).toBeGreaterThan(0);
      expect(model.contours.length).toBeGreaterThanOrEqual(0);
      return `data:image/png;base64,${model.valueLabels[0]!.text}`;
    });
    const snaps = collectOfficialIsoluxSnapshots(scene, results, render);
    expect(Object.keys(snaps)).toEqual(["r1"]);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0]![1]).toEqual(OFFICIAL_PDF_ISOLUX_RENDER);
    expect(OFFICIAL_PDF_ISOLUX_RENDER.mode).toBe("isolines");
    expect(OFFICIAL_PDF_ISOLUX_RENDER.showValueLabels).toBe(true);

    const empty = collectOfficialIsoluxSnapshots(scene, { version: 2, byRoomId: {} }, render);
    expect(empty).toEqual({});
    expect(render).toHaveBeenCalledTimes(1);
    expect(officialIsoluxModelsByRoom(scene, { version: 2, byRoomId: {} })).toEqual({});
  });

  it("does not invent a snapshot when the renderer cannot produce an image", () => {
    const { scene, results } = officeScene({ withResults: true });
    const snaps = collectOfficialIsoluxSnapshots(scene, results, () => null);
    expect(snaps).toEqual({});
    expect(renderIsoluxModelPngDataUrl(officialIsoluxModelForRoom(officeRoom(), results.byRoomId.r1)!)).toBeNull();
  });

  it("puts isolux snapshots on the official Summary page without dropping false-colour or 3D chapters", () => {
    const { scene, results, room } = officeScene({ withResults: true });
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => false,
      render: () => {
        throw new Error("must not invent headless 3D images");
      },
    });
    expect(captured.omitted).toBe(true);
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);

    const isoluxSnapshots = collectOfficialIsoluxSnapshots(scene, results, () => TINY_JPEG);
    const doc = buildFullReportPdf({
      projectName: "Isolux wiring",
      scene,
      results,
      photometry: {},
      wattsById: {},
      luxsimVersion: "0.1.0",
      falseColorSnapshots: { [room.id]: TINY_JPEG },
      isoluxSnapshots,
      // 3D omitted on purpose — isolux figures must still appear.
      ...captured.views,
    });
    const text = pdfText(doc);
    expect(text).toMatch(/Working plane .{1,3}isolux diagram/);
    expect(text).toContain("isolux diagram");
    expect(text).toMatch(/Working plane \\\(Office\\\)/);
    expect(text).toContain("6. Per-room summary and working plane");
    expect(text).not.toContain("3D views");
    expect(isoluxSnapshots[room.id]).toBe(TINY_JPEG);

    const with3d = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => ({
        projectGreyscale: TINY_JPEG,
        projectFalseColor: TINY_JPEG,
        roomGreyscale: { r1: TINY_JPEG },
        roomFalseColor: { r1: TINY_JPEG },
      }),
    });
    const both = pdfText(
      buildFullReportPdf({
        projectName: "Isolux wiring",
        scene,
        results,
        photometry: {},
        wattsById: {},
        luxsimVersion: "0.1.0",
        falseColorSnapshots: { [room.id]: TINY_JPEG },
        isoluxSnapshots,
        ...with3d.views,
      })
    );
    expect(both).toMatch(/Working plane .{1,3}isolux diagram/);
    expect(both).toContain("3D greyscale");
    expect(both).toContain("3D false colour");

    const without = buildFullReportPdf({
      projectName: "No isolux",
      scene,
      results,
      photometry: {},
      wattsById: {},
    });
    expect(pdfText(without)).not.toContain("isolux diagram");
  });
});

describe("official editor and export path wiring", () => {
  it("wires plan toggles and official PDF isoluxSnapshots in the editor", () => {
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const toggle = readSrc("src/components/editor/PlanIsoluxToggle.tsx");
    const overlay = readSrc("src/components/editor/PlanIsoluxOverlay.tsx");

    expect(editor).toContain("collectOfficialIsoluxSnapshots(scene, results)");
    expect(editor).toContain("isoluxSnapshots,");
    expect(editor).toContain("PlanIsoluxToggle");
    expect(editor).toContain("viewMode === \"top\" || viewMode === \"bottom\"");
    expect(editor).toContain("planIsoluxControlState(results, scene.ui.activeRoomId)");
    expect(editor).toContain("planIsoluxMode={planIsoluxMode}");
    expect(editor).toContain("showValueLabels={planValueLabels}");
    const exportFn = editor.slice(editor.indexOf("async function exportFullPdf"));
    expect(exportFn).toContain("const isoluxSnapshots = collectOfficialIsoluxSnapshots(scene, results)");
    expect(exportFn.indexOf("const isoluxSnapshots = collectOfficialIsoluxSnapshots")).toBeLessThan(
      exportFn.indexOf("captureOfficialReport3dViews")
    );
    expect(exportFn.indexOf("isoluxSnapshots,")).toBeLessThan(
      exportFn.indexOf("doc.save(")
    );
    expect(editor).toContain("falseColorSnapshots,");
    expect(editor).toContain("Display3dToggle");

    expect(top).toContain("PlanIsoluxOverlay");
    expect(top).toContain("planIsoluxMode");
    expect(top).toContain("showValueLabels");
    expect(overlay).toContain("officialIsoluxModelForRoom");
    expect(overlay).toContain("isoluxPxToWorld");
    expect(overlay).toContain("valueLabels");
    expect(overlay).toContain("contours");
    expect(overlay).toContain("data-plan-falsecolor-canvas");
    expect(overlay).toContain("isoluxFieldScreenRect");
    expect(overlay).not.toContain("isoluxFieldPngDataUrl");
    expect(top).toContain("falseColorScale");
    expect(editor).toContain("OFFICIAL_FALSE_COLOR_SCALE");
    expect(editor).toContain("falseColorScale={scale}");
    expect(toggle).toContain("Isolines");
    expect(toggle).toContain("Value labels");
    expect(toggle).toContain("False colour");
    expect(toggle).toContain('helpKey="view.planIsolux"');
    expect(toggle).toContain("disabled={!enabled}");
  });

  it("documents isolines and value labels on the official path", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const gap = readSrc("docs/DIALUX_GAP.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/等照度線與數值圖 \/ Isolines and value labels/);
    expect(guide).toMatch(/False colour/);
    expect(guide).toMatch(/Isolines/);
    expect(guide).toMatch(/Value labels/);
    expect(guide).toMatch(/不會發明數字/);
    expect(guide).toMatch(/do not invent numbers/);
    expect(guide).toMatch(/Full PDF report/);
    expect(guide).toMatch(/即使 3D 視圖未能擷取/);
    expect(guide).toMatch(/if 3D views cannot be captured/);
    expect(gap).not.toMatch(/isolines \/ value charts no/i);
    expect(gap).toMatch(/official Top\/Bottom plan/);
    expect(gap).toMatch(/official Full PDF isolux diagram/);
    expect(gap).toMatch(/official 3D can also show isolines/);
    expect(tips).toContain('helpKey: "view.planIsolux"');
    expect(tips).toContain("PLAN_ISOLUX_HINT");
    expect(PLAN_ISOLUX_HINT).toMatch(/Full PDF report/);
  });
});
