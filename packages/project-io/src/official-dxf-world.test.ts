import { describe, expect, it } from "vitest";
import type { DxfEntity } from "./types";
import { applyUnderlayCalibration, officialImportedUnderlay } from "./underlay";
import {
  officialDxfEntitiesToWorld,
  officialDxfEntityToWorld,
  officialDxfMetersPerUnit,
} from "./official-dxf-world";

const LINE: DxfEntity = {
  type: "line",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

const L_POLY: DxfEntity = {
  type: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ],
};

describe("official DXF entity→world mapping", () => {
  it("leaves points unchanged when metersPerUnit is 1 and the origin is 0", () => {
    const underlay = officialImportedUnderlay({
      id: "u-dxf",
      storeyId: "s1",
      assetId: "a-dxf",
      assetKind: "dxf",
    });
    expect(underlay.metersPerUnit).toBe(1);
    expect(underlay.offsetX).toBe(0);
    expect(underlay.offsetY).toBe(0);
    expect(officialDxfMetersPerUnit(underlay)).toBe(1);
    expect(officialDxfEntityToWorld({ x: 3, y: -2 }, underlay)).toEqual({ x: 3, y: -2 });
    expect(officialDxfEntityToWorld({ x: 3, y: -2 })).toEqual({ x: 3, y: -2 });
    const same = [LINE, L_POLY];
    expect(officialDxfEntitiesToWorld(same, underlay)).toBe(same);
    expect(officialDxfEntitiesToWorld(same, undefined)).toBe(same);
    expect(officialDxfEntitiesToWorld(same, null)).toBe(same);
    expect(officialDxfEntitiesToWorld(same, { metersPerUnit: 0 })).toBe(same);
    expect(officialDxfEntitiesToWorld(same, { metersPerUnit: Number.NaN })).toBe(same);
  });

  it("scales points by metersPerUnit 2 and 0.001, then adds the world origin", () => {
    const twice = officialDxfEntityToWorld({ x: 10, y: -4 }, { metersPerUnit: 2 });
    expect(twice).toEqual({ x: 20, y: -8 });
    const mm = officialDxfEntityToWorld({ x: 8000, y: 2500 }, { metersPerUnit: 0.001 });
    expect(mm.x).toBeCloseTo(8);
    expect(mm.y).toBeCloseTo(2.5);
    const shifted = officialDxfEntityToWorld(
      { x: 10, y: 5 },
      { metersPerUnit: 2, offsetX: 1, offsetY: -3 }
    );
    expect(shifted).toEqual({ x: 21, y: 7 });

    const mapped = officialDxfEntitiesToWorld([LINE, L_POLY], { metersPerUnit: 2 });
    expect(mapped).not.toBe([LINE, L_POLY]);
    expect(mapped[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(mapped[1]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 6 },
    ]);
    expect(LINE.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("measures official Calibrate scale clicks in the same world space the user sees", () => {
    const imported = officialImportedUnderlay({
      id: "u-dxf",
      storeyId: "s1",
      assetId: "a-dxf",
      assetKind: "dxf",
    });
    const aEnt = { x: 0, y: 0 };
    const bEnt = { x: 10, y: 0 };
    const a0 = officialDxfEntityToWorld(aEnt, imported);
    const b0 = officialDxfEntityToWorld(bEnt, imported);
    expect(Math.hypot(b0.x - a0.x, b0.y - a0.y)).toBeCloseTo(10);

    const calibrated = applyUnderlayCalibration(imported, a0, b0, 5);
    expect(calibrated).not.toBeNull();
    expect(calibrated!.metersPerUnit).toBeCloseTo(0.5);
    expect(calibrated!.scaleCalibrated).toBe(true);

    const a1 = officialDxfEntityToWorld(aEnt, calibrated);
    const b1 = officialDxfEntityToWorld(bEnt, calibrated);
    expect(a1).toEqual({ x: 0, y: 0 });
    expect(b1.x).toBeCloseTo(5);
    expect(b1.y).toBeCloseTo(0);

    const again = applyUnderlayCalibration(calibrated!, a1, b1, 10);
    expect(again).not.toBeNull();
    expect(again!.metersPerUnit).toBeCloseTo(1);
    const a2 = officialDxfEntityToWorld(aEnt, again);
    const b2 = officialDxfEntityToWorld(bEnt, again);
    expect(Math.hypot(b2.x - a2.x, b2.y - a2.y)).toBeCloseTo(10);
  });
});
