import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { officialImportedUnderlay } from "./underlay";
import { officialDxfEntityToWorld } from "./official-dxf-world";
import { mToMm } from "./units";
import {
  officialMetersPerUnitFromAssetMeta,
  officialRecoverCadMetersPerUnit,
} from "./official-underlay-units";

describe("official CAD metresPerUnit from asset meta", () => {
  it("prefers stored metersPerUnit, then $INSUNITS 4 → 0.001", () => {
    expect(officialMetersPerUnitFromAssetMeta({ metersPerUnit: 0.001 })).toBe(0.001);
    expect(officialMetersPerUnitFromAssetMeta({ insunits: 4 })).toBe(0.001);
    expect(officialMetersPerUnitFromAssetMeta({ metersPerUnit: 1, insunits: 4 })).toBe(1);
    expect(officialMetersPerUnitFromAssetMeta({})).toBeUndefined();
  });

  it("maps a 5582-unit millimetre DXF segment to 5582 mm, not 5,582,000 mm", () => {
    const underlay = officialImportedUnderlay({
      id: "u1",
      storeyId: "s1",
      assetId: "a1",
      assetKind: "dwg",
      dxfEntities: [
        {
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 5582, y: 0 },
          ],
        },
      ],
      metersPerUnit: officialMetersPerUnitFromAssetMeta({ metersPerUnit: 0.001, insunits: 4 }),
    });
    expect(underlay.metersPerUnit).toBe(0.001);
    const a = officialDxfEntityToWorld({ x: 0, y: 0 }, underlay);
    const b = officialDxfEntityToWorld({ x: 5582, y: 0 }, underlay);
    const liveMm = Math.round(mToMm(Math.hypot(b.x - a.x, b.y - a.y)));
    expect(liveMm).toBe(5582);
    expect(liveMm).not.toBe(5_582_000);
    expect(liveMm).not.toBe(5_582_448);
  });

  it("does not drop metersPerUnit 0.001 on the official import underlay path", () => {
    const underlay = officialImportedUnderlay({
      id: "u1",
      storeyId: "s1",
      assetId: "a1",
      assetKind: "dxf",
      metersPerUnit: officialMetersPerUnitFromAssetMeta({
        metersPerUnit: 0.001,
        insunits: 4,
      }),
    });
    expect(underlay.metersPerUnit).toBe(0.001);
    expect(underlay.scaleCalibrated).toBe(true);
  });

  it("recovers a dropped default mpu=1 from asset meta 0.001", () => {
    expect(officialRecoverCadMetersPerUnit(1, { metersPerUnit: 0.001 })).toBe(0.001);
    expect(officialRecoverCadMetersPerUnit(1, { insunits: 4 })).toBe(0.001);
    expect(officialRecoverCadMetersPerUnit(0.001, { metersPerUnit: 0.001 })).toBeUndefined();
    expect(officialRecoverCadMetersPerUnit(1, { metersPerUnit: 1 })).toBeUndefined();
  });

  it("keeps importPlan wired to officialMetersPerUnitFromAssetMeta", () => {
    const editor = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(editor).toContain("officialMetersPerUnitFromAssetMeta(meta) ?? meta.metersPerUnit");
    expect(editor).toContain("officialRecoverCadMetersPerUnit");
  });
});
