import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import {
  applyUnderlayCalibration,
  isDisplayableRasterUnderlay,
  isUnderlayScaleCalibrated,
  officialImportedUnderlay,
  officialDrawRoomAllowed,
  officialDrawRoomBlockedReason,
  UNCALIBRATED_DRAW_ROOM_STATUS,
  underlayCalibratedWorldSize,
} from "./underlay";
import { officialAppendDrawnRoom, appendOfficialNewRoom } from "./new-room-defaults";
import type { Underlay } from "./types";

function editorSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );
}

function topViewSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
    "utf8"
  );
}

function sceneWithUnderlay(underlay: Underlay) {
  const scene = defaultSceneV2();
  const storeyId = scene.ui.activeStoreyId;
  return {
    scene: {
      ...scene,
      underlays: [{ ...underlay, storeyId }],
    },
    underlay: { ...underlay, storeyId },
  };
}

function imageUnderlay(overrides: Partial<Underlay> = {}): Underlay {
  return {
    ...officialImportedUnderlay({
      id: "u-img",
      storeyId: "s1",
      assetId: "a-img",
      assetKind: "image",
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
    }),
    ...overrides,
  };
}

function pdfUnderlay(): Underlay {
  return officialImportedUnderlay({
    id: "u-pdf",
    storeyId: "s1",
    assetId: "a-pdf",
    assetKind: "pdf",
    sourceWidthPx: 1182,
    sourceHeightPx: 591,
    pageIndex: 0,
    pageRasterAssetId: "raster-1",
  });
}

function calibratedImage(): Underlay {
  const imported = imageUnderlay();
  const mpu = imported.metersPerUnit;
  const a = { x: 100 * mpu, y: 250 * mpu };
  const b = { x: 600 * mpu, y: 250 * mpu };
  const next = applyUnderlayCalibration(imported, a, b, 5);
  if (!next) throw new Error("calibration failed");
  return next;
}

function expectHelperAgreesWithOfficialCalibration(
  underlay: Parameters<typeof isUnderlayScaleCalibrated>[0]
) {
  const allowed = officialDrawRoomAllowed(underlay);
  const calibrated = isUnderlayScaleCalibrated(underlay);
  const world = underlayCalibratedWorldSize(underlay);
  if (isDisplayableRasterUnderlay(underlay)) {
    expect(allowed).toBe(calibrated);
    if (world) expect(allowed).toBe(true);
    if (!calibrated) {
      expect(world).toBeNull();
      expect(allowed).toBe(false);
    }
  } else {
    expect(allowed).toBe(true);
  }
}

function tryDraw(scene: ReturnType<typeof defaultSceneV2>) {
  return officialAppendDrawnRoom(scene, {
    id: "room-drawn",
    polygon: rectPolygon(0, 0, 4, 3),
    heightM: 2.8,
  });
}

describe("officialDrawRoomAllowed", () => {
  it("allows drawing when there is no underlay", () => {
    expect(officialDrawRoomAllowed(undefined)).toBe(true);
    expect(officialDrawRoomAllowed(null)).toBe(true);
    expect(officialDrawRoomBlockedReason(undefined)).toBeNull();
  });

  it("blocks an uncalibrated image underlay and agrees with official calibrated-flag logic", () => {
    const underlay = imageUnderlay();
    expect(underlay.scaleCalibrated).toBe(false);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
    expect(officialDrawRoomAllowed(underlay)).toBe(false);
    expect(officialDrawRoomBlockedReason(underlay)).toBe(
      UNCALIBRATED_DRAW_ROOM_STATUS
    );
    expect(UNCALIBRATED_DRAW_ROOM_STATUS).toMatch(/Calibrate scale first/i);
    expectHelperAgreesWithOfficialCalibration(underlay);
  });

  it("blocks an uncalibrated PDF underlay", () => {
    const underlay = pdfUnderlay();
    expect(isDisplayableRasterUnderlay(underlay)).toBe(true);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
    expect(officialDrawRoomAllowed(underlay)).toBe(false);
    expectHelperAgreesWithOfficialCalibration(underlay);
  });

  it("allows drawing after applyUnderlayCalibration", () => {
    const underlay = calibratedImage();
    expect(underlay.scaleCalibrated).toBe(true);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(true);
    expect(underlayCalibratedWorldSize(underlay)).not.toBeNull();
    expect(officialDrawRoomAllowed(underlay)).toBe(true);
    expect(officialDrawRoomBlockedReason(underlay)).toBeNull();
    expectHelperAgreesWithOfficialCalibration(underlay);
  });

  it("allows a DXF underlay (already in metres, calibrated)", () => {
    const underlay = officialImportedUnderlay({
      id: "u-dxf",
      storeyId: "s1",
      assetId: "a-dxf",
      assetKind: "dxf",
    });
    expect(isDisplayableRasterUnderlay(underlay)).toBe(false);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(true);
    expect(officialDrawRoomAllowed(underlay)).toBe(true);
    // DXF has no pixel size, so calibrated world size may be null — must not block.
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
    expectHelperAgreesWithOfficialCalibration(underlay);
  });

  it("does not block a DWG-only underlay (not a displayable tracing raster)", () => {
    const underlay = officialImportedUnderlay({
      id: "u-dwg",
      storeyId: "s1",
      assetId: "a-dwg",
      assetKind: "dwg",
    });
    expect(isDisplayableRasterUnderlay(underlay)).toBe(false);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
    expect(officialDrawRoomAllowed(underlay)).toBe(true);
    expect(officialDrawRoomBlockedReason(underlay)).toBeNull();
    expectHelperAgreesWithOfficialCalibration(underlay);
  });

  it("treats a legacy image still at the 12 m preview span as blocked", () => {
    const legacy = {
      kind: "image" as const,
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
      metersPerUnit: officialImportedUnderlay({
        id: "u",
        storeyId: "s",
        assetId: "a",
        assetKind: "image",
        sourceWidthPx: 2000,
        sourceHeightPx: 1000,
      }).metersPerUnit,
    };
    expect(isUnderlayScaleCalibrated(legacy)).toBe(false);
    expect(underlayCalibratedWorldSize(legacy)).toBeNull();
    expect(officialDrawRoomAllowed(legacy)).toBe(false);
    expectHelperAgreesWithOfficialCalibration(legacy);
  });
});

describe("officialAppendDrawnRoom", () => {
  it("refuses to add a room on an uncalibrated image underlay", () => {
    const { scene } = sceneWithUnderlay(imageUnderlay());
    const before = scene.rooms.length;
    const out = tryDraw(scene);
    expect(out.created).toBe(false);
    expect(out.scene.rooms).toHaveLength(before);
    expect(out.scene).toBe(scene);
    expect(out.status).toBe(UNCALIBRATED_DRAW_ROOM_STATUS);
  });

  it("refuses to add a room on an uncalibrated PDF underlay", () => {
    const { scene } = sceneWithUnderlay(pdfUnderlay());
    const out = tryDraw(scene);
    expect(out.created).toBe(false);
    expect(out.scene.rooms).toHaveLength(0);
    expect(out.status).toBe(UNCALIBRATED_DRAW_ROOM_STATUS);
  });

  it("adds a room after the raster is officially calibrated", () => {
    const { scene } = sceneWithUnderlay(calibratedImage());
    const out = tryDraw(scene);
    expect(out.created).toBe(true);
    expect(out.scene.rooms).toHaveLength(1);
    expect(out.scene.rooms[0]!.id).toBe("room-drawn");
    expect(out.status).toBe("Room created");
  });

  it("adds a room when there is no underlay", () => {
    const scene = defaultSceneV2();
    const out = tryDraw(scene);
    expect(out.created).toBe(true);
    expect(out.scene.rooms).toHaveLength(1);
  });

  it("adds a room when the underlay is DXF", () => {
    const { scene } = sceneWithUnderlay(
      officialImportedUnderlay({
        id: "u-dxf",
        storeyId: "s1",
        assetId: "a-dxf",
        assetKind: "dxf",
      })
    );
    const out = tryDraw(scene);
    expect(out.created).toBe(true);
    expect(out.scene.rooms).toHaveLength(1);
  });

  it("adds a room when the underlay is DWG-only", () => {
    const { scene } = sceneWithUnderlay(
      officialImportedUnderlay({
        id: "u-dwg",
        storeyId: "s1",
        assetId: "a-dwg",
        assetKind: "dwg",
      })
    );
    const out = tryDraw(scene);
    expect(out.created).toBe(true);
    expect(out.scene.rooms).toHaveLength(1);
  });

  it("does not change how appendOfficialNewRoom itself writes when allowed", () => {
    const scene = defaultSceneV2();
    const direct = appendOfficialNewRoom(scene, {
      id: "room-direct",
      polygon: rectPolygon(0, 0, 4, 3),
      heightM: 2.8,
    });
    const gated = officialAppendDrawnRoom(scene, {
      id: "room-direct",
      polygon: rectPolygon(0, 0, 4, 3),
      heightM: 2.8,
    });
    expect(gated.created).toBe(true);
    expect(gated.scene.rooms[0]!.calc.maintenanceFactor).toBe(
      direct.rooms[0]!.calc.maintenanceFactor
    );
    expect(gated.scene.rooms[0]!.calc.en12464TemplateId).toBe("");
  });
});

describe("official editor create-room paths use the same helper", () => {
  it("gates drawRoomPolygon, createRectRoom, and choosing the Draw room tool", () => {
    const src = editorSrc();
    expect(src).toContain("officialDrawRoomAllowed");
    expect(src).toContain("officialDrawRoomBlockedReason");
    expect(src).toContain("officialAppendDrawnRoom");
    expect(src).toContain("UNCALIBRATED_DRAW_ROOM_STATUS");
    expect(src).toContain("selectEditorTool");
    expect(src).toContain("refuseUncalibratedDrawRoom");

    const drawStart = src.indexOf("function drawRoomPolygon");
    const createStart = src.indexOf("function createRectRoom");
    const uploadStart = src.indexOf("async function onUploadPhotometry");
    expect(drawStart).toBeGreaterThan(-1);
    expect(createStart).toBeGreaterThan(drawStart);
    const drawFn = src.slice(drawStart, createStart);
    const createFn = src.slice(createStart, uploadStart);
    expect(drawFn).toContain("refuseUncalibratedDrawRoom");
    expect(drawFn).toContain("officialAppendDrawnRoom");
    expect(drawFn).not.toMatch(/appendOfficialNewRoom\(/);
    expect(createFn).toContain("refuseUncalibratedDrawRoom");
    expect(createFn).toContain("drawRoomPolygon(");

    const selectStart = src.indexOf("function selectEditorTool");
    const refuseStart = src.indexOf("function refuseUncalibratedDrawRoom");
    expect(selectStart).toBeGreaterThan(-1);
    expect(refuseStart).toBeGreaterThan(-1);
    const selectFn = src.slice(
      selectStart,
      src.indexOf("function drawRoomPolygon")
    );
    expect(selectFn).toContain('tool === "drawRoom"');
    expect(selectFn).toContain("refuseUncalibratedDrawRoom");
    expect(selectFn).toContain("patchSceneUi");
    // Select and Calibrate must still be choosable without the draw-room gate.
    expect(selectFn).not.toMatch(/tool === "select"/);
    expect(selectFn).not.toMatch(/tool === "calibrate"/);

    expect(src).toContain("onClick={() => selectEditorTool(tool)}");
    // Must not still assign the tool unconditionally.
    expect(src).not.toMatch(
      /onClick=\{\(\) => patchSceneUi\(\(s\) => \(\{ \.\.\.s, ui: \{ \.\.\.s\.ui, tool \} \}\)\)\}/
    );
  });

  it("does not lock Select, Calibrate scale, or fixture placement tools", () => {
    const src = editorSrc();
    expect(src).toContain('["select", "Select / move"');
    expect(src).toContain('["calibrate", "Calibrate scale"');
    expect(src).toContain("placeAt");
    expect(src).toContain("onCalibrate");
    expect(src).toContain("applyUnderlayCalibration");
    // Calibrate and select are not passed through the draw-room refuse path.
    const selectFn = src.slice(
      src.indexOf("function selectEditorTool"),
      src.indexOf("function drawRoomPolygon")
    );
    expect(selectFn).toMatch(/if \(tool === "drawRoom"/);
  });

  it("uses the same helper for click/keyboard polygon close in Top view", () => {
    const src = topViewSrc();
    expect(src).toContain("officialDrawRoomAllowed");
    expect(src).toMatch(
      /const drawing =\s*scene\.ui\.tool === "drawRoom" && officialDrawRoomAllowed\(underlay\);/
    );
    expect(src).toContain("onDrawRoomPolygon(draft)");
    expect(src).toContain('if (e.key === "Enter")');
  });
});
