import { describe, expect, it } from "vitest";
import { rectPolygon } from "@luxsim/project-io";
import type { RoomV2 } from "@luxsim/project-io";
import { planFixtureArray, pointsRoughlyEqual } from "./arrange-array";

function testRoom(): RoomV2 {
  return {
    id: "room_a",
    storeyId: "gf",
    name: "Office",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.5,
      maintenanceFactor: 0.8,
      en12464TemplateId: "",
    },
  };
}

describe("planFixtureArray rect", () => {
  it("places 2×3 grid at 1.5 m spacing with 0.5 m wall offset in 5×4 m room", () => {
    const plan = planFixtureArray(testRoom(), {
      mode: "rect",
      rows: 2,
      cols: 3,
      count: 1,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0.5,
      rotationDeg: 0,
    });
    expect(plan.inside).toHaveLength(6);
    expect(plan.skippedOutside).toBe(0);
    const expected = [
      { x: 0.5, y: 0.5 },
      { x: 2.0, y: 0.5 },
      { x: 3.5, y: 0.5 },
      { x: 0.5, y: 2.0 },
      { x: 2.0, y: 2.0 },
      { x: 3.5, y: 2.0 },
    ];
    for (let i = 0; i < expected.length; i += 1) {
      expect(pointsRoughlyEqual(plan.inside[i]!, expected[i]!)).toBe(true);
    }
  });

  it("skips points outside polygon", () => {
    const plan = planFixtureArray(testRoom(), {
      mode: "rect",
      rows: 5,
      cols: 5,
      count: 1,
      spacingX: 1.0,
      spacingY: 1.0,
      wallOffset: 0,
      rotationDeg: 0,
    });
    expect(plan.inside.length).toBeLessThan(plan.proposed.length);
    expect(plan.skippedOutside).toBeGreaterThan(0);
  });
});

describe("planFixtureArray line", () => {
  it("centers count along spacing axis", () => {
    const plan = planFixtureArray(testRoom(), {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 3,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
    });
    expect(plan.inside).toHaveLength(3);
    expect(plan.inside[1]!.x).toBeCloseTo(2.5, 3);
    expect(plan.inside[1]!.y).toBeCloseTo(2, 3);
  });
});

function lShapedRoom(): RoomV2 {
  return {
    ...testRoom(),
    id: "room_l",
    name: "L lounge",
    // 8×8 m AABB with a 4×4 m north-east notch.
    polygon: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ],
  };
}

function trapezoidRoom(): RoomV2 {
  return {
    ...testRoom(),
    id: "room_t",
    name: "Trapezoid",
    polygon: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 6, y: 4 },
      { x: 2, y: 4 },
    ],
  };
}

describe("planFixtureArray line without picked endpoints", () => {
  it("keeps the centred Spacing X line when lineStart or lineEnd is missing", () => {
    const base = {
      mode: "line" as const,
      rows: 1,
      cols: 1,
      count: 3,
      spacingX: 1.5,
      spacingY: 9,
      wallOffset: 0.5,
      rotationDeg: 0,
    };
    const noPick = planFixtureArray(testRoom(), base);
    const onlyStart = planFixtureArray(testRoom(), {
      ...base,
      lineStart: { x: 0, y: 0 },
      lineEnd: null,
    });
    expect(noPick.inside).toHaveLength(3);
    expect(noPick.inside[0]!.x).toBeCloseTo(1.0, 3);
    expect(noPick.inside[1]!.x).toBeCloseTo(2.5, 3);
    expect(noPick.inside[2]!.x).toBeCloseTo(4.0, 3);
    expect(noPick.inside.every((p) => Math.abs(p.y - 2) < 1e-9)).toBe(true);
    expect(onlyStart.inside.map((p) => [p.x, p.y])).toEqual(noPick.inside.map((p) => [p.x, p.y]));
    // Spacing Y must not shift a 1-D line, even if a value is present.
    expect(noPick.inside[0]!.y).toBeCloseTo(2, 5);
  });
});

describe("planFixtureArray line with picked endpoints", () => {
  it("places count fixtures equally from start to end, ignoring Spacing X and Spacing Y", () => {
    const plan = planFixtureArray(testRoom(), {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 3,
      spacingX: 9,
      spacingY: 9,
      wallOffset: 0.5,
      rotationDeg: 15,
      lineStart: { x: 1, y: 1 },
      lineEnd: { x: 4, y: 1 },
    });
    expect(plan.proposed).toHaveLength(3);
    expect(plan.inside).toHaveLength(3);
    expect(plan.skippedOutside).toBe(0);
    expect(pointsRoughlyEqual(plan.inside[0]!, { x: 1, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(plan.inside[1]!, { x: 2.5, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(plan.inside[2]!, { x: 4, y: 1 })).toBe(true);
    expect(plan.inside.every((p) => p.rotationDeg === 15)).toBe(true);
  });

  it("places a single fixture at the segment midpoint", () => {
    const plan = planFixtureArray(testRoom(), {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 1,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
      lineStart: { x: 1, y: 1 },
      lineEnd: { x: 3, y: 3 },
    });
    expect(plan.inside).toHaveLength(1);
    expect(pointsRoughlyEqual(plan.inside[0]!, { x: 2, y: 2 })).toBe(true);
  });

  it("keeps only in-polygon points when a picked segment leaves an L-shaped room", () => {
    const plan = planFixtureArray(lShapedRoom(), {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 4,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
      // Across the north arm and through the north-east notch, then outside the AABB.
      lineStart: { x: 1, y: 6 },
      lineEnd: { x: 7, y: 6 },
    });
    expect(plan.proposed).toHaveLength(4);
    expect(pointsRoughlyEqual(plan.proposed[0]!, { x: 1, y: 6 })).toBe(true);
    expect(pointsRoughlyEqual(plan.proposed[1]!, { x: 3, y: 6 })).toBe(true);
    expect(pointsRoughlyEqual(plan.proposed[2]!, { x: 5, y: 6 })).toBe(true);
    expect(pointsRoughlyEqual(plan.proposed[3]!, { x: 7, y: 6 })).toBe(true);
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 1, y: 6 }))).toBe(true);
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 3, y: 6 }))).toBe(true);
    // (5,6) is in the missing north-east rectangle; (7,6) is outside the AABB.
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 5, y: 6 }))).toBe(false);
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 7, y: 6 }))).toBe(false);
    expect(plan.inside).toHaveLength(2);
    expect(plan.skippedOutside).toBe(2);
  });

  it("places a diagonal line inside a non-orthogonal trapezoid and drops points that leave it", () => {
    const plan = planFixtureArray(trapezoidRoom(), {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 4,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
      lineStart: { x: 1, y: 0.5 },
      lineEnd: { x: 7, y: 3.5 },
    });
    expect(plan.proposed).toHaveLength(4);
    expect(pointsRoughlyEqual(plan.proposed[0]!, { x: 1, y: 0.5 })).toBe(true);
    expect(pointsRoughlyEqual(plan.proposed[3]!, { x: 7, y: 3.5 })).toBe(true);
    expect(plan.inside.length).toBeLessThan(plan.proposed.length);
    expect(plan.skippedOutside).toBeGreaterThan(0);
    // The last point (7, 3.5) is outside the tapering top edge (x=6 at y=4).
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 7, y: 3.5 }))).toBe(false);
    expect(plan.inside.some((p) => pointsRoughlyEqual(p, { x: 1, y: 0.5 }))).toBe(true);
  });
});
