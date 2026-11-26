import { describe, expect, it } from "vitest";
import type { FixtureInstance, RoomV2 } from "./types";
import { rectPolygon } from "./geometry";
import {
  choosePlanLayout,
  choosePlanScale,
  fixtureNumbers,
  typifiedPlanSizeMm,
  typicalMountingHeightLabel,
  unionRoomBounds,
  worldToPaper,
  splitPlanAndLegend,
  firstFixtureNumber,
  numberFontSizePt,
} from "./lighting-plan";

describe("lighting plan layout helpers", () => {
  it("picks the tightest standard scale that fits the paper box", () => {
    expect(choosePlanScale(28.475, 14.60, 245, 139)).toBe(125);
    expect(choosePlanScale(28.475, 14.60, 170, 200)).toBe(200);
  });

  it("prefers landscape when it allows a larger drawing", () => {
    const layout = choosePlanLayout(
      28.475,
      14.6,
      { w: 170, h: 225 },
      { w: 245, h: 139 }
    );
    expect(layout.orientation).toBe("landscape");
    expect(layout.scale).toBe(125);
  });

  it("flips world Y so a high-Y room sits at the top of the page", () => {
    const bounds = { minX: 0.5, minY: 0.5, maxX: 29, maxY: 15.1, width: 28.5, depth: 14.6 };
    const top = worldToPaper(5, 15.1, bounds, 20, 40, 8);
    const bottom = worldToPaper(5, 0.5, bounds, 20, 40, 8);
    expect(top.y).toBeLessThan(bottom.y);
    expect(top.y).toBeCloseTo(40, 5);
    expect(bottom.y).toBeCloseTo(40 + 14.6 * 8, 5);
  });

  it("keeps typified SILVERSUN symbols larger than V-TAC while staying readable", () => {
    const silversun = typifiedPlanSizeMm(0.244, 125);
    const vtac = typifiedPlanSizeMm(0.055, 125);
    expect(silversun).toBeGreaterThan(vtac);
    expect(vtac).toBeGreaterThanOrEqual(6.2);
    expect(silversun).toBeLessThanOrEqual(11);
    // Two-digit numbers (19, 33, 39) must fit inside the smaller circle.
    expect(numberFontSizePt(vtac, 2)).toBeGreaterThanOrEqual(4.8);
  });

  it("reserves the legend strip outside the floor plate with a clear gap", () => {
    const content = { x: 20, y: 40, w: 257, h: 151 };
    const layout = splitPlanAndLegend(content, 28.475, 14.6);
    expect(layout.scale).toBeLessThanOrEqual(150);
    expect(layout.scale).toBeGreaterThanOrEqual(125);
    if (layout.placement === "bottom") {
      expect(layout.legendBox.y).toBeGreaterThanOrEqual(layout.planBox.y + layout.planBox.h + layout.gapMm - 1e-6);
      expect(layout.legendBox.y + layout.legendBox.h).toBeLessThanOrEqual(content.y + content.h + 1e-6);
    } else {
      expect(layout.legendBox.x).toBeGreaterThanOrEqual(layout.planBox.x + layout.planBox.w + layout.gapMm - 1e-6);
    }
    // Floor at the chosen scale still fits in the reserved plan box (not the legend).
    const mmPerM = 1000 / layout.scale;
    expect(28.475 * mmPerM).toBeLessThanOrEqual(layout.planBox.w);
    expect(14.6 * mmPerM).toBeLessThanOrEqual(layout.planBox.h);
  });

  it("picks the first schedule number of each type for the legend sample", () => {
    const instances: FixtureInstance[] = [
      {
        instanceId: "v1",
        luminaireId: "v",
        storeyId: "s",
        roomId: "r",
        name: "A",
        position: { x: 0, y: 0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "s1",
        luminaireId: "s8",
        storeyId: "s",
        roomId: "r",
        name: "B",
        position: { x: 1, y: 1, z: 2.6 },
        rotationDeg: 0,
      },
    ];
    const numbers = fixtureNumbers(instances);
    expect(firstFixtureNumber("v", instances, numbers)).toBe(1);
    expect(firstFixtureNumber("s8", instances, numbers)).toBe(2);
  });

  it("numbers fixtures in scene order, matching the schedule appendix", () => {
    const instances: FixtureInstance[] = [
      {
        instanceId: "a",
        luminaireId: "v",
        storeyId: "s",
        roomId: "r",
        name: "A",
        position: { x: 0, y: 0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "b",
        luminaireId: "s8",
        storeyId: "s",
        roomId: "r",
        name: "B",
        position: { x: 1, y: 1, z: 2.6 },
        rotationDeg: 0,
      },
    ];
    const map = fixtureNumbers(instances);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
  });

  it("reports a single mounting height when all z values match", () => {
    const instances: FixtureInstance[] = [
      {
        instanceId: "a",
        luminaireId: "v",
        storeyId: "s",
        roomId: "r",
        name: "A",
        position: { x: 0, y: 0, z: 2.6 },
        rotationDeg: 0,
      },
      {
        instanceId: "b",
        luminaireId: "v",
        storeyId: "s",
        roomId: "r",
        name: "B",
        position: { x: 1, y: 1, z: 2.6 },
        rotationDeg: 0,
      },
    ];
    expect(typicalMountingHeightLabel(instances)).toBe("Mounting height 2.60 m");
    expect(typicalMountingHeightLabel([])).toBeNull();
  });

  it("unions room polygons into one floor plate", () => {
    const rooms: RoomV2[] = [
      {
        id: "r1",
        storeyId: "s1",
        name: "A",
        polygon: rectPolygon(0.5, 0.5, 6, 4),
        heightM: 2.8,
        workplaneHeightM: 0.75,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
      },
      {
        id: "r2",
        storeyId: "s1",
        name: "B",
        polygon: rectPolygon(10, 8, 5, 6),
        heightM: 2.8,
        workplaneHeightM: 0.75,
        reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
        calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
      },
    ];
    const b = unionRoomBounds(rooms)!;
    expect(b.minX).toBeCloseTo(0.5);
    expect(b.maxX).toBeCloseTo(15);
    expect(b.maxY).toBeCloseTo(14);
    expect(b.width).toBeCloseTo(14.5);
  });
});
