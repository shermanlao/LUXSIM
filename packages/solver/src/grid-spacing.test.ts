import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import {
  DEFAULT_GRID_SPACING_M,
  GRID_SPACING_MAX_M,
  GRID_SPACING_MIN_M,
  clampGridSpacingM,
  clampReflectance,
  clampWorkplaneHeightM,
  wallZoneFromSpacingM,
} from "./grid-spacing";

const emptyRoom = {
  width: 5,
  depth: 4,
  height: 2.8,
  reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
  workplaneHeight: 0.75,
};

describe("clampGridSpacingM", () => {
  it("clamps to the solver range 0.25–2 m and defaults missing values to 0.5 m", () => {
    expect(clampGridSpacingM(0.2)).toBe(GRID_SPACING_MIN_M);
    expect(clampGridSpacingM(0.1)).toBe(0.25);
    expect(clampGridSpacingM(3)).toBe(GRID_SPACING_MAX_M);
    expect(clampGridSpacingM(0.5)).toBe(0.5);
    expect(clampGridSpacingM(0)).toBe(DEFAULT_GRID_SPACING_M);
    expect(clampGridSpacingM(undefined)).toBe(0.5);
    expect(clampGridSpacingM(Number.NaN)).toBe(0.5);
    expect(clampGridSpacingM(-1)).toBe(0.25);
  });

  it("derives the wall-zone / start-point from the clamped spacing", () => {
    expect(wallZoneFromSpacingM(0.2)).toBeCloseTo(0.125, 10);
    expect(wallZoneFromSpacingM(0.2)).not.toBeCloseTo(0.1, 10);
    expect(wallZoneFromSpacingM(3)).toBeCloseTo(1, 10);
    expect(wallZoneFromSpacingM(0.5)).toBeCloseTo(0.25, 10);
  });
});

describe("calculate grid start uses the same clamp as wallZoneFromSpacingM", () => {
  it("treats a historically stored 0.2 m spacing as 0.25 m with origin 0.125 m", () => {
    const results = calculate({
      room: emptyRoom,
      luminaires: [],
      grid: { spacing: 0.2 },
      interreflection: false,
      computeUgr: false,
    });
    expect(results.grid.spacing).toBe(0.25);
    expect(results.grid.originX).toBeCloseTo(0.125, 10);
    expect(results.grid.originY).toBeCloseTo(0.125, 10);
    expect(results.grid.originX).toBeCloseTo(wallZoneFromSpacingM(0.2), 10);
    expect(results.grid.originX).not.toBeCloseTo(0.1, 10);
  });

  it("treats a stored 3 m spacing as 2 m with origin 1 m", () => {
    const results = calculate({
      room: emptyRoom,
      luminaires: [],
      grid: { spacing: 3 },
      interreflection: false,
      computeUgr: false,
    });
    expect(results.grid.spacing).toBe(2);
    expect(results.grid.originX).toBeCloseTo(1, 10);
    expect(results.grid.originY).toBeCloseTo(wallZoneFromSpacingM(3), 10);
  });
});

describe("workplane height and reflectance write clamps", () => {
  it("caps workplane height at clear height minus 0.05 m and at 0", () => {
    expect(clampWorkplaneHeightM(0.75, 2.8)).toBeCloseTo(0.75, 10);
    expect(clampWorkplaneHeightM(3, 2.8)).toBeCloseTo(2.75, 10);
    expect(clampWorkplaneHeightM(-0.2, 2.8)).toBe(0);
  });

  it("clamps reflectance to 0–1", () => {
    expect(clampReflectance(0.5)).toBe(0.5);
    expect(clampReflectance(1.2)).toBe(1);
    expect(clampReflectance(-0.1)).toBe(0);
    expect(clampReflectance(Number.NaN)).toBe(0);
  });
});
