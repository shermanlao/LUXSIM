import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_SPAN_M,
  applyUnderlayCalibration,
  inferProjectAssetKind,
  initialMetersPerPixel,
  isDisplayableRasterUnderlay,
  isUnderlayScaleCalibrated,
  officialDwgHasConvertedLinework,
  officialHasParsedCadLinework,
  officialImportedUnderlay,
  legacyScaleToMetersPerPixel,
  projectAssetKindAllowed,
  underlayCalibratedWorldSize,
  underlayKindFromAssetKind,
  underlayWorldSize,
} from "./underlay";

describe("underlay aspect helpers", () => {
  it("keeps world size proportional to source pixels", () => {
    const mpu = initialMetersPerPixel(2000, 1000);
    expect(mpu).toBeCloseTo(DEFAULT_PLAN_SPAN_M / 2000);
    const size = underlayWorldSize({
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
      metersPerUnit: mpu,
    });
    expect(size).not.toBeNull();
    expect(size!.widthM / size!.heightM).toBeCloseTo(2);
    expect(Math.max(size!.widthM, size!.heightM)).toBeCloseTo(DEFAULT_PLAN_SPAN_M);
  });

  it("migrates legacy scale without changing intended width", () => {
    const widthPx = 1600;
    const legacy = 1.5;
    const mpu = legacyScaleToMetersPerPixel(legacy, widthPx);
    expect(widthPx * mpu).toBeCloseTo(DEFAULT_PLAN_SPAN_M * legacy);
  });
});

describe("official underlay import kind and uncalibrated scale", () => {
  it("does not store or treat a DWG as a displayable image kind", () => {
    expect(inferProjectAssetKind("plan.dwg")).toBe("dwg");
    expect(inferProjectAssetKind("plan.DWG")).toBe("dwg");
    expect(projectAssetKindAllowed("plan.dwg")).toEqual({ ok: true, kind: "dwg" });
    expect(underlayKindFromAssetKind("dwg")).toBe("dwg");
    expect(underlayKindFromAssetKind("dwg")).not.toBe("image");

    const dummy = Buffer.from("AC1024-dummy-dwg");
    expect(dummy.length).toBeGreaterThan(0);

    const underlay = officialImportedUnderlay({
      id: "u-dwg",
      storeyId: "s1",
      assetId: "a-dwg",
      assetKind: "dwg",
    });
    expect(underlay.kind).toBe("dwg");
    expect(underlay.kind).not.toBe("image");
    expect(isDisplayableRasterUnderlay(underlay)).toBe(false);
    expect(underlay.offsetX).toBe(0);
    expect(underlay.offsetY).toBe(0);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
    expect(underlayWorldSize(underlay)).toBeNull();
    expect(officialHasParsedCadLinework(underlay)).toBe(false);
    expect(officialDwgHasConvertedLinework(underlay)).toBe(false);
  });

  it("treats a converted DWG with parsed entities as calibrated like DXF", () => {
    const entities = [
      {
        type: "line" as const,
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
      },
    ];
    const underlay = officialImportedUnderlay({
      id: "u-dwg-converted",
      storeyId: "s1",
      assetId: "a-dwg",
      assetKind: "dwg",
      dxfEntities: entities,
    });
    expect(underlay.kind).toBe("dwg");
    expect(underlay.metersPerUnit).toBe(1);
    expect(underlay.scaleCalibrated).toBe(true);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(true);
    expect(officialHasParsedCadLinework(underlay)).toBe(true);
    expect(officialDwgHasConvertedLinework(underlay)).toBe(true);
    expect(isDisplayableRasterUnderlay(underlay)).toBe(false);

    const unparsed = officialImportedUnderlay({
      id: "u-dwg-legacy",
      storeyId: "s1",
      assetId: "a-dwg",
      assetKind: "dwg",
    });
    expect(isUnderlayScaleCalibrated({ ...unparsed, dxfEntities: entities })).toBe(
      true
    );
    expect(officialHasParsedCadLinework({ kind: "image", dxfEntities: entities })).toBe(
      false
    );
    expect(officialHasParsedCadLinework({ kind: "dxf", dxfEntities: [] })).toBe(true);
  });

  it("keeps a converted DWG as parsed linework when every layer is hidden", () => {
    const hiddenAll = {
      kind: "dwg" as const,
      dxfEntities: [] as const,
      hiddenLayers: ["WALL", "DIM"],
    };
    expect(officialHasParsedCadLinework(hiddenAll)).toBe(true);
    expect(officialDwgHasConvertedLinework(hiddenAll)).toBe(true);
    expect(
      officialDwgHasConvertedLinework({
        kind: "dwg",
        dxfEntities: [],
        dxfLayers: [{ name: "WALL", on: true, frozen: false }],
      })
    ).toBe(true);
    expect(officialHasParsedCadLinework({ kind: "dwg", dxfEntities: [] })).toBe(false);
    expect(officialDwgHasConvertedLinework({ kind: "dwg" })).toBe(false);
  });

  it("rejects off-list image formats that cannot become a usable underlay", () => {
    for (const name of ["plan.bmp", "plan.tif", "plan.tiff", "plan.gif"]) {
      const allowed = projectAssetKindAllowed(name);
      expect(allowed.ok, name).toBe(false);
      expect(allowed.error).toMatch(/Unexpected extension for kind image/);
    }
    expect(projectAssetKindAllowed("plan.png").ok).toBe(true);
    expect(projectAssetKindAllowed("plan.png").kind).toBe("image");
  });

  it("does not treat an uncalibrated raster as already having a real 12 m calibrated span", () => {
    const underlay = officialImportedUnderlay({
      id: "u-img",
      storeyId: "s1",
      assetId: "a-img",
      assetKind: "image",
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
    });
    expect(underlay.kind).toBe("image");
    expect(underlay.offsetX).toBe(0);
    expect(underlay.offsetY).toBe(0);
    expect(underlay.scaleCalibrated).toBe(false);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();

    const preview = underlayWorldSize(underlay);
    expect(preview).not.toBeNull();
    expect(preview!.widthM / preview!.heightM).toBeCloseTo(2);
    expect(Math.max(preview!.widthM, preview!.heightM)).toBeCloseTo(
      DEFAULT_PLAN_SPAN_M
    );
  });

  it("keeps a new PDF uncalibrated until Calibrate scale, with origin 0,0", () => {
    const underlay = officialImportedUnderlay({
      id: "u-pdf",
      storeyId: "s1",
      assetId: "a-pdf",
      assetKind: "pdf",
      sourceWidthPx: 1182,
      sourceHeightPx: 591,
      pageIndex: 0,
      pageRasterAssetId: "raster-1",
    });
    expect(underlay.kind).toBe("pdf");
    expect(underlay.pageIndex).toBe(0);
    expect(underlay.offsetX).toBe(0);
    expect(underlay.offsetY).toBe(0);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(false);
    expect(underlayCalibratedWorldSize(underlay)).toBeNull();
  });

  it("calibrates a 5 m wall on both axes without changing aspect", () => {
    const imported = officialImportedUnderlay({
      id: "u-img",
      storeyId: "s1",
      assetId: "a-img",
      assetKind: "image",
      sourceWidthPx: 1000,
      sourceHeightPx: 500,
    });
    const mpu = imported.metersPerUnit;
    const a = { x: 100 * mpu, y: 250 * mpu };
    const b = { x: 600 * mpu, y: 250 * mpu };
    const calibrated = applyUnderlayCalibration(imported, a, b, 5);
    expect(calibrated).not.toBeNull();
    expect(calibrated!.scaleCalibrated).toBe(true);
    expect(isUnderlayScaleCalibrated(calibrated!)).toBe(true);
    expect(calibrated!.offsetX).toBe(0);
    expect(calibrated!.offsetY).toBe(0);

    const size = underlayCalibratedWorldSize(calibrated!);
    expect(size).not.toBeNull();
    expect(size!.widthM / size!.heightM).toBeCloseTo(2);
    const measured = 500 * calibrated!.metersPerUnit;
    const relErr = Math.abs(measured - 5) / 5;
    expect(relErr).toBeLessThanOrEqual(0.01);
    expect(calibrated!.metersPerUnit).toBeCloseTo(0.01);
    expect(size!.widthM).toBeCloseTo(10);
    expect(size!.heightM).toBeCloseTo(5);
  });

  it("keeps DXF default metersPerUnit = 1 when entities are already in metres", () => {
    const underlay = officialImportedUnderlay({
      id: "u-dxf",
      storeyId: "s1",
      assetId: "a-dxf",
      assetKind: "dxf",
    });
    expect(underlay.kind).toBe("dxf");
    expect(underlay.metersPerUnit).toBe(1);
    expect(underlay.scaleCalibrated).toBe(true);
    expect(isUnderlayScaleCalibrated(underlay)).toBe(true);
    expect(underlay.offsetX).toBe(0);
    expect(underlay.offsetY).toBe(0);
    expect(isDisplayableRasterUnderlay(underlay)).toBe(false);
  });

  it("applies a declared $INSUNITS metres-per-unit on a DXF or converted DWG underlay", () => {
    const dxf = officialImportedUnderlay({
      id: "u-dxf-mm",
      storeyId: "s1",
      assetId: "a-dxf-mm",
      assetKind: "dxf",
      metersPerUnit: 0.001,
    });
    expect(dxf.metersPerUnit).toBe(0.001);
    expect(dxf.scaleCalibrated).toBe(true);
    const dwg = officialImportedUnderlay({
      id: "u-dwg-mm",
      storeyId: "s1",
      assetId: "a-dwg-mm",
      assetKind: "dwg",
      dxfEntities: [
        {
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
        },
      ],
      metersPerUnit: 0.001,
    });
    expect(dwg.kind).toBe("dwg");
    expect(dwg.metersPerUnit).toBe(0.001);
    expect(dwg.scaleCalibrated).toBe(true);
  });

  it("treats a legacy image still at the 12 m preview span as uncalibrated", () => {
    const legacy = {
      kind: "image" as const,
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
      metersPerUnit: initialMetersPerPixel(2000, 1000),
    };
    expect(isUnderlayScaleCalibrated(legacy)).toBe(false);
    expect(underlayCalibratedWorldSize(legacy)).toBeNull();
  });
});
