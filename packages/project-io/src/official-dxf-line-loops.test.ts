import { describe, expect, it } from "vitest";
import type { DxfEntity } from "./types";
import { roomAreaM2 } from "./geometry";
import type { RoomV2 } from "./types";
import {
  officialDxfHasSimpleLineLoop,
  officialDxfOpenPathSegments,
  officialDxfSimpleLineLoopRings,
} from "./official-dxf-line-loops";
import { officialDxfPolylineClosed } from "./official-dxf-polyline";

function line(x1: number, y1: number, x2: number, y2: number): DxfEntity {
  return { type: "line", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
}

function area(ring: { x: number; y: number }[]): number {
  return roomAreaM2({ polygon: ring } as RoomV2);
}

const RECT_LINES: DxfEntity[] = [
  line(0, 0, 4, 0),
  line(4, 0, 4, 3),
  line(4, 3, 0, 3),
  line(0, 3, 0, 0),
];

const TRI_LINES: DxfEntity[] = [
  line(0, 0, 4, 0),
  line(4, 0, 0, 3),
  line(0, 3, 0, 0),
];

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

describe("officialDxfOpenPathSegments", () => {
  it("collects LINE and open LWPOLYLINE segments and skips closed polylines", () => {
    const openPoly: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const closing = line(0, 3, 0, 0);
    const segs = officialDxfOpenPathSegments([CLOSED_RECT, openPoly, closing]);
    expect(officialDxfPolylineClosed(CLOSED_RECT)).toBe(true);
    expect(segs).toHaveLength(4);
    expect(segs[0]).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(segs[3]).toEqual([
      { x: 0, y: 3 },
      { x: 0, y: 0 },
    ]);
  });
});

describe("officialDxfSimpleLineLoopRings", () => {
  it("finds a simple loop from a 4-LINE rectangle", () => {
    const rings = officialDxfSimpleLineLoopRings(RECT_LINES);
    expect(rings).toHaveLength(1);
    expect(rings[0]!).toHaveLength(4);
    expect(area(rings[0]!)).toBe(12);
    expect(officialDxfHasSimpleLineLoop(RECT_LINES)).toBe(true);
  });

  it("finds a triangle of three LINEs", () => {
    const rings = officialDxfSimpleLineLoopRings(TRI_LINES);
    expect(rings).toHaveLength(1);
    expect(rings[0]!).toHaveLength(3);
    expect(area(rings[0]!)).toBe(6);
  });

  it("finds a loop from an open LWPOLYLINE plus one closing LINE", () => {
    const open: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const rings = officialDxfSimpleLineLoopRings([open, line(0, 3, 0, 0)]);
    expect(rings).toHaveLength(1);
    expect(rings[0]!).toHaveLength(4);
    expect(area(rings[0]!)).toBe(12);
  });

  it("joins endpoints within the official tight metre epsilon", () => {
    const rings = officialDxfSimpleLineLoopRings([
      line(0, 0, 4, 0),
      line(4, 0, 4, 3),
      line(4, 3, 0, 3),
      line(0, 3, 1e-7, 0),
    ]);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBeCloseTo(12, 5);
  });

  it("yields no loop when a T-junction / degree-3 vertex is present", () => {
    const tee: DxfEntity[] = [
      line(0, 0, 4, 0),
      line(4, 0, 4, 1.5),
      line(4, 1.5, 4, 3),
      line(4, 3, 0, 3),
      line(0, 3, 0, 0),
      line(4, 1.5, 6, 1.5),
    ];
    expect(officialDxfSimpleLineLoopRings(tee)).toEqual([]);
    expect(officialDxfHasSimpleLineLoop(tee)).toBe(false);
  });

  it("yields no loop from a figure-8 / degree-4 shared vertex", () => {
    const figure8: DxfEntity[] = [
      line(0, 0, 2, 0),
      line(2, 0, 2, 2),
      line(2, 2, 0, 2),
      line(0, 2, 0, 0),
      line(2, 2, 4, 2),
      line(4, 2, 4, 4),
      line(4, 4, 2, 4),
      line(2, 4, 2, 2),
    ];
    expect(officialDxfSimpleLineLoopRings(figure8)).toEqual([]);
    expect(officialDxfHasSimpleLineLoop(figure8)).toBe(false);
  });

  it("does not treat a closed polyline as a line loop", () => {
    expect(officialDxfOpenPathSegments([CLOSED_RECT])).toEqual([]);
    expect(officialDxfSimpleLineLoopRings([CLOSED_RECT])).toEqual([]);
    expect(officialDxfHasSimpleLineLoop([CLOSED_RECT])).toBe(false);
  });

  it("finds nothing from only dangling open lines", () => {
    const dangling: DxfEntity[] = [
      {
        type: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 3 },
        ],
      },
      line(0, 0, 10, 0),
    ];
    expect(officialDxfSimpleLineLoopRings(dangling)).toEqual([]);
    expect(officialDxfHasSimpleLineLoop(dangling)).toBe(false);
  });

  it("finds two disjoint simple rectangles as two loops", () => {
    const other = [
      line(10, 0, 12, 0),
      line(12, 0, 12, 2),
      line(12, 2, 10, 2),
      line(10, 2, 10, 0),
    ];
    const rings = officialDxfSimpleLineLoopRings([...RECT_LINES, ...other]);
    expect(rings).toHaveLength(2);
    const areas = rings.map((r) => area(r)).sort((a, b) => a - b);
    expect(areas).toEqual([4, 12]);
  });
});
