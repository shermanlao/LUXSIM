import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { calculate } from "../../solver/src/calculate";
import {
  GRID_SPACING_MAX_M,
  GRID_SPACING_MIN_M,
  clampGridSpacingM,
  clampReflectance,
  clampWorkplaneHeightM,
} from "../../solver/src/grid-spacing";
import { rectPolygon } from "./geometry";
import { wallZoneM } from "./report-model";
import { calculateRoomWalls } from "./wall-surfaces";
import type { RoomV2 } from "./types";

function roomWithSpacing(gridSpacing: number): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing,
      interreflection: false,
      bounces: 0,
      computeUgr: false,
    },
  };
}

describe("wallZoneM uses the same grid-spacing clamp as the solver", () => {
  it("treats a historically stored 0.2 m spacing as a 0.125 m wall zone, not 0.1 m", () => {
    const room = roomWithSpacing(0.2);
    expect(wallZoneM(room)).toBeCloseTo(0.125, 10);
    expect(wallZoneM(room)).not.toBeCloseTo(0.1, 10);

    const results = calculate({
      room: {
        width: 5,
        depth: 4,
        height: room.heightM,
        reflectance: room.reflectance,
        workplaneHeight: room.workplaneHeightM,
      },
      luminaires: [],
      grid: { spacing: room.calc.gridSpacing },
      interreflection: false,
      computeUgr: false,
    });
    expect(results.grid.spacing).toBe(0.25);
    expect(results.grid.originX).toBeCloseTo(wallZoneM(room), 10);
    expect(results.grid.originY).toBeCloseTo(wallZoneM(room), 10);
  });

  it("clamps an oversized stored spacing to 2 m so wall zone and origin stay at 1 m", () => {
    const room = roomWithSpacing(3);
    expect(wallZoneM(room)).toBeCloseTo(1, 10);
    const results = calculate({
      room: {
        width: 5,
        depth: 4,
        height: room.heightM,
        reflectance: room.reflectance,
        workplaneHeight: room.workplaneHeightM,
      },
      luminaires: [],
      grid: { spacing: room.calc.gridSpacing },
      interreflection: false,
      computeUgr: false,
    });
    expect(results.grid.spacing).toBe(2);
    expect(results.grid.originX).toBeCloseTo(wallZoneM(room), 10);
  });

  it("uses the clamped spacing and wall zone on automatic wall surfaces", () => {
    const walls = calculateRoomWalls({
      room: roomWithSpacing(0.2),
      instances: [],
      photometry: {},
    });
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) {
      expect(wall.grid.spacing).toBe(0.25);
      expect(wall.grid.originU).toBeCloseTo(0.125, 10);
      expect(wall.grid.originU).not.toBeCloseTo(0.1, 10);
      expect(wall.insetM).toBeCloseTo(0.125, 10);
    }
  });
});

describe("property-panel writes use the same clamps as calculation", () => {
  it("cannot store a grid spacing outside the solver range", () => {
    // The editor writes clampGridSpacingM(v), so these are the values that
    // would be stored. A regression that wrote the raw 0.2 / 3 would fail.
    expect(clampGridSpacingM(0.2)).toBe(GRID_SPACING_MIN_M);
    expect(clampGridSpacingM(0.2)).not.toBe(0.2);
    expect(clampGridSpacingM(3)).toBe(GRID_SPACING_MAX_M);
    expect(clampGridSpacingM(3)).not.toBe(3);
    expect(clampGridSpacingM(0.5)).toBe(0.5);
  });

  it("cannot store a workplane height above clear height minus 0.05 m, or a ρ outside 0–1", () => {
    expect(clampWorkplaneHeightM(3, 2.8)).toBeCloseTo(2.75, 10);
    expect(clampWorkplaneHeightM(-1, 2.8)).toBe(0);
    expect(clampReflectance(1.4)).toBe(1);
    expect(clampReflectance(-0.2)).toBe(0);
  });

  it("wires the property panel to the shared clamp and no longer invites a 0.2 m minimum", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain("clampGridSpacingM");
    expect(src).toContain("min={GRID_SPACING_MIN_M}");
    expect(src).toContain("max={GRID_SPACING_MAX_M}");
    expect(src).toContain("clampWorkplaneHeightM");
    expect(src).toContain("clampReflectance");
    expect(src).not.toMatch(/min=\{0\.2\}/);
    expect(src).not.toMatch(/if\s*\(!\(v\s*>=\s*0\.2\)\)/);
  });
});
