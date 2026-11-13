import { describe, expect, it } from "vitest";
import { rectPolygon } from "@luxsim/project-io";
import type { RoomV2 } from "@luxsim/project-io";
import {
  estimateFixtureCountForTargetEm,
  pickSquareishGrid,
  planTargetEmArrange,
} from "./arrange-by-em";

function room5x4(): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
  };
}

describe("estimateFixtureCountForTargetEm", () => {
  it("rounds n up with ceil", () => {
    // A=20 m², Em=500, Φ=2000, η=0.6, MF=0.8 → need 500*20/(0.6*0.8)=20833.33 lm → 2000 each → 10.416 → 11
    const n = estimateFixtureCountForTargetEm({
      areaM2: 20,
      targetEmMaintainedLx: 500,
      luminousFluxLm: 2000,
      utilance: 0.6,
      maintenanceFactor: 0.8,
    });
    expect(n).toBe(11);
  });

  it("returns at least 1 for small targets", () => {
    const n = estimateFixtureCountForTargetEm({
      areaM2: 4,
      targetEmMaintainedLx: 100,
      luminousFluxLm: 8000,
      utilance: 0.6,
      maintenanceFactor: 0.8,
    });
    expect(n).toBe(1);
  });
});

describe("pickSquareishGrid", () => {
  it("prefers near-square aspect for 6 fixtures", () => {
    const { rows, cols } = pickSquareishGrid(6);
    expect(rows * cols).toBe(6);
    expect(Math.min(rows, cols)).toBe(2);
    expect(Math.max(rows, cols)).toBe(3);
  });

  it("covers 11 fixtures without extreme strip", () => {
    const { rows, cols } = pickSquareishGrid(11);
    expect(rows * cols).toBeGreaterThanOrEqual(11);
    expect(cols / rows).toBeLessThan(3.5);
  });
});

describe("planTargetEmArrange", () => {
  it("derives spacing from room bounds and wall offset", () => {
    const est = planTargetEmArrange(room5x4(), {
      targetEmMaintainedLx: 500,
      luminousFluxLm: 2000,
      utilance: 0.6,
      maintenanceFactor: 0.8,
      wallOffset: 0.5,
      rotationDeg: 0,
    });
    expect(est).not.toBeNull();
    expect(est!.fixtureCount).toBe(11);
    expect(est!.rows * est!.cols).toBeGreaterThanOrEqual(11);
    expect(est!.spacingX).toBeCloseTo((5 - 1) / (est!.cols - 1), 3);
    expect(est!.spacingY).toBeCloseTo((4 - 1) / (est!.rows - 1), 3);
  });
});
