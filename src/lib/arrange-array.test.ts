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
