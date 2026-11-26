import { describe, expect, it } from "vitest";
import type { DxfEntity, Vec2 } from "./types";
import { officialDxfEntitiesToWorld } from "./official-dxf-world";
import {
  officialDxfClosedRingVertices,
  officialDxfEntitySegments,
  officialDxfPolylineClosed,
  officialDxfPolylineStrokePoints,
} from "./official-dxf-polyline";

const OPEN_L: DxfEntity = {
  type: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ],
};

const CLOSED_RECT: DxfEntity = {
  type: "polyline",
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ],
};

const REPEATED_CLOSE: DxfEntity = {
  type: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
    { x: 0, y: 0 },
  ],
};

const LINE: DxfEntity = {
  type: "line",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

describe("officialDxfPolylineClosed", () => {
  it("honours the closed flag and first==last coincidence", () => {
    expect(officialDxfPolylineClosed(CLOSED_RECT)).toBe(true);
    expect(officialDxfPolylineClosed(REPEATED_CLOSE)).toBe(true);
    expect(officialDxfPolylineClosed(OPEN_L)).toBe(false);
    expect(officialDxfPolylineClosed(LINE)).toBe(false);
    expect(
      officialDxfPolylineClosed({
        type: "line",
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      })
    ).toBe(false);
  });

  it("treats first==last as closed after world mapping when the entity flag was omitted", () => {
    const raw: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
        { x: 0, y: 5e-4 },
      ],
    };
    expect(officialDxfPolylineClosed(raw)).toBe(false);
    const world = officialDxfEntitiesToWorld([raw], { metersPerUnit: 0.001 })[0]!;
    expect(world.points[world.points.length - 1]!.y).toBeCloseTo(5e-7);
    expect(officialDxfPolylineClosed(world)).toBe(true);
  });
});

describe("official DXF display and snap segments", () => {
  it("does not invent a closing edge for an open polyline", () => {
    expect(officialDxfPolylineStrokePoints(OPEN_L)).toEqual(OPEN_L.points);
    const segs = officialDxfEntitySegments(OPEN_L);
    expect(segs).toHaveLength(2);
    expect(segs.map(([a, b]) => [a, b])).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ],
    ]);
    expect(segs.some(([a, b]) => a.x === 0 && a.y === 3 && b.x === 0 && b.y === 0)).toBe(
      false
    );
    const midClose = mid({ x: 0, y: 3 }, { x: 0, y: 0 });
    expect(segs.map(([a, b]) => mid(a, b))).not.toEqual(
      expect.arrayContaining([midClose])
    );
  });

  it("includes the official closing segment on a flagged or first==last polyline", () => {
    const flaggedStroke = officialDxfPolylineStrokePoints(CLOSED_RECT);
    expect(flaggedStroke[0]).toEqual({ x: 0, y: 0 });
    expect(flaggedStroke[flaggedStroke.length - 1]).toEqual({ x: 0, y: 0 });
    expect(flaggedStroke).toHaveLength(5);
    const flaggedSegs = officialDxfEntitySegments(CLOSED_RECT);
    expect(flaggedSegs).toHaveLength(4);
    expect(flaggedSegs[3]).toEqual([
      { x: 0, y: 3 },
      { x: 0, y: 0 },
    ]);
    expect(mid(flaggedSegs[3]![0], flaggedSegs[3]![1])).toEqual({ x: 0, y: 1.5 });

    const repeatStroke = officialDxfPolylineStrokePoints(REPEATED_CLOSE);
    expect(repeatStroke).toEqual(flaggedStroke);
    expect(officialDxfClosedRingVertices(REPEATED_CLOSE)).toEqual(CLOSED_RECT.points);
    expect(officialDxfEntitySegments(REPEATED_CLOSE)).toEqual(flaggedSegs);
  });
});
