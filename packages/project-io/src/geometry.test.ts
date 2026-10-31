import { describe, expect, it } from "vitest";
import {
  isCloseToStart,
  orthoPoint,
  pointOnCircle,
  polarOrthoPoint,
  resolveDraftPoint,
  translatePolygon,
} from "./geometry";

describe("draw geometry", () => {
  it("projects a cursor onto a radius circle", () => {
    const p = pointOnCircle({ x: 0, y: 0 }, 15, { x: 30, y: 0 });
    expect(p.x).toBeCloseTo(15);
    expect(p.y).toBeCloseTo(0);
    const q = pointOnCircle({ x: 1, y: 1 }, 2, { x: 1, y: 5 });
    expect(q.x).toBeCloseTo(1);
    expect(q.y).toBeCloseTo(3);
  });

  it("snaps to the nearer axis", () => {
    expect(orthoPoint({ x: 0, y: 0 }, { x: 8, y: 1 })).toEqual({ x: 8, y: 0 });
    expect(orthoPoint({ x: 0, y: 0 }, { x: 1, y: 8 })).toEqual({ x: 0, y: 8 });
  });

  it("picks the nearest cardinal point on a locked radius", () => {
    const p = polarOrthoPoint({ x: 0, y: 0 }, 5, { x: 4, y: 0.2 });
    expect(p).toEqual({ x: 5, y: 0 });
  });

  it("closes when within tolerance of the start", () => {
    expect(isCloseToStart({ x: 0.1, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(isCloseToStart({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it("translates a polygon", () => {
    expect(translatePolygon([{ x: 1, y: 2 }], 3, -1)).toEqual([{ x: 4, y: 1 }]);
  });

  it("resolves polar + ortho together", () => {
    const p = resolveDraftPoint({ x: 0, y: 0 }, { x: 3, y: 0.4 }, 10, true);
    expect(p).toEqual({ x: 10, y: 0 });
  });
});
