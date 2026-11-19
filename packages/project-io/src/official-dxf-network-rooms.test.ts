import { describe, expect, it } from "vitest";
import type { DxfEntity } from "./types";
import { roomAreaM2 } from "./geometry";
import type { RoomV2 } from "./types";
import {
  officialDxfHasNetworkFace,
  officialDxfNetworkFaceRings,
  officialDxfNetworkSegments,
  officialDxfDropContainingRings,
  officialDxfRingFullyContains,
} from "./official-dxf-network-rooms";
import { officialDxfHasSimpleLineLoop } from "./official-dxf-line-loops";
import { officialDxfPolylineClosed } from "./official-dxf-polyline";

function line(x1: number, y1: number, x2: number, y2: number): DxfEntity {
  return { type: "line", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
}

function area(ring: { x: number; y: number }[]): number {
  return roomAreaM2({ polygon: ring } as RoomV2);
}

function areas(rings: { x: number; y: number }[][]): number[] {
  return rings.map((r) => area(r)).sort((a, b) => a - b);
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

/** Two 4×3 rectangles sharing the wall x=4. */
const SHARED_WALL: DxfEntity[] = [
  ...RECT_LINES,
  line(4, 0, 8, 0),
  line(8, 0, 8, 3),
  line(8, 3, 4, 3),
  line(4, 3, 4, 0),
];

/**
 * Classic T-junction partition: one 10×4 outer of LINEs, plus a partition
 * that meets the long walls mid-segment and cuts out an 8 m² room, leaving
 * a 32 m² remainder.
 *
 *   (0,4)-----------------(10,4)
 *     |                      |
 *   (0,2)----(4,2)           |
 *     | small  |    large    |
 *   (0,0)----(4,0)--------(10,0)
 */
const T_PARTITION: DxfEntity[] = [
  line(0, 0, 10, 0),
  line(10, 0, 10, 4),
  line(10, 4, 0, 4),
  line(0, 4, 0, 0),
  line(0, 2, 4, 2),
  line(4, 2, 4, 0),
];

/**
 * Three-room T network: rooms A and B above a corridor stem C.
 *
 *   (0,6)----(4,6) (6,6)----(10,6)
 *     |   A    |    |    B    |
 *   (0,2)----(4,2) (6,2)----(10,2)
 *              | C  |
 *            (4,0)-(6,0)
 */
const THREE_ROOM_T: DxfEntity[] = [
  line(0, 2, 4, 2),
  line(4, 2, 4, 6),
  line(4, 6, 0, 6),
  line(0, 6, 0, 2),
  line(6, 2, 10, 2),
  line(10, 2, 10, 6),
  line(10, 6, 6, 6),
  line(6, 6, 6, 2),
  line(4, 0, 6, 0),
  line(6, 0, 6, 2),
  line(4, 2, 4, 0),
  line(4, 6, 6, 6),
];

/** Two 2×2 loops sharing only the vertex (2,2). */
const FIGURE8: DxfEntity[] = [
  line(0, 0, 2, 0),
  line(2, 0, 2, 2),
  line(2, 2, 0, 2),
  line(0, 2, 0, 0),
  line(2, 2, 4, 2),
  line(4, 2, 4, 4),
  line(4, 4, 2, 4),
  line(2, 4, 2, 2),
];

const CLOSED_8X4: DxfEntity = {
  type: "polyline",
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 0, y: 4 },
  ],
};

describe("officialDxfNetworkSegments", () => {
  it("includes LINE, open LWPOLYLINE, and closed-polyline closing edges", () => {
    const openPoly: DxfEntity = {
      type: "polyline",
      points: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 2 },
      ],
    };
    const segs = officialDxfNetworkSegments([CLOSED_RECT, openPoly, line(12, 2, 10, 2)]);
    expect(officialDxfPolylineClosed(CLOSED_RECT)).toBe(true);
    expect(segs).toHaveLength(7);
  });

  it("does not invent a closing edge on an open path", () => {
    const open: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const segs = officialDxfNetworkSegments([open]);
    expect(segs).toHaveLength(3);
  });
});

describe("officialDxfNetworkFaceRings", () => {
  it("finds one face from a 4-LINE rectangle", () => {
    const rings = officialDxfNetworkFaceRings(RECT_LINES);
    expect(rings).toHaveLength(1);
    expect(rings[0]!).toHaveLength(4);
    expect(area(rings[0]!)).toBe(12);
    expect(officialDxfHasNetworkFace(RECT_LINES)).toBe(true);
  });

  it("finds a triangle of three LINEs", () => {
    const rings = officialDxfNetworkFaceRings(TRI_LINES);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(6);
  });

  it("finds a face from an open LWPOLYLINE plus one closing LINE", () => {
    const open: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const rings = officialDxfNetworkFaceRings([open, line(0, 3, 0, 0)]);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(12);
  });

  it("finds one face from a closed polyline", () => {
    const rings = officialDxfNetworkFaceRings([CLOSED_RECT]);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(12);
  });

  it("creates two rooms from two rectangles that share a wall, not a union", () => {
    const rings = officialDxfNetworkFaceRings(SHARED_WALL);
    expect(rings).toHaveLength(2);
    expect(areas(rings)).toEqual([12, 12]);
    expect(officialDxfHasNetworkFace(SHARED_WALL)).toBe(true);
  });

  it("splits a T-junction mid-segment wall into two rooms", () => {
    // The unsplit outer is still a degree-2 loop until mid-segment T points
    // are inserted; the network faces, not that outer, are the rooms.
    const rings = officialDxfNetworkFaceRings(T_PARTITION);
    expect(rings).toHaveLength(2);
    expect(areas(rings)).toEqual([8, 32]);
    expect(officialDxfHasNetworkFace(T_PARTITION)).toBe(true);
  });

  it("creates three rooms from a corridor T-junction network", () => {
    expect(officialDxfHasSimpleLineLoop(THREE_ROOM_T)).toBe(false);
    const rings = officialDxfNetworkFaceRings(THREE_ROOM_T);
    expect(rings).toHaveLength(3);
    expect(areas(rings)).toEqual([12, 16, 16]);
  });

  it("creates two rooms from a figure-8 / degree-4 shared vertex, not one 8-shape", () => {
    expect(officialDxfHasSimpleLineLoop(FIGURE8)).toBe(false);
    const rings = officialDxfNetworkFaceRings(FIGURE8);
    expect(rings).toHaveLength(2);
    expect(areas(rings)).toEqual([4, 4]);
    for (const ring of rings) {
      expect(ring.length).toBe(4);
    }
  });

  it("creates only the face rooms from a closed polyline with an interior T-wall", () => {
    const entities: DxfEntity[] = [CLOSED_8X4, line(4, 0, 4, 4)];
    const rings = officialDxfNetworkFaceRings(entities);
    expect(rings).toHaveLength(2);
    expect(areas(rings)).toEqual([16, 16]);
    expect(rings.some((r) => area(r) === 32)).toBe(false);
  });

  it("keeps the inner of two nested disjoint rectangles and drops the overlapping outer", () => {
    const outer: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    const inner: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ],
    };
    const rings = officialDxfNetworkFaceRings([outer, inner]);
    expect(rings).toHaveLength(1);
    expect(areas(rings)).toEqual([16]);
    expect(officialDxfRingFullyContains(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ]
    )).toBe(true);
  });

  it("does not treat two adjacent shared-wall rooms as containing one another", () => {
    const left = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const right = [
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 3 },
      { x: 4, y: 3 },
    ];
    expect(officialDxfRingFullyContains(left, right)).toBe(false);
    expect(officialDxfRingFullyContains(right, left)).toBe(false);
    expect(officialDxfDropContainingRings([left, right])).toHaveLength(2);
  });

  it("creates one room from a rectangle with an exterior dangling T, not two", () => {
    const dangling: DxfEntity[] = [
      ...RECT_LINES.slice(0, 1),
      line(4, 0, 4, 1.5),
      line(4, 1.5, 4, 3),
      line(4, 3, 0, 3),
      line(0, 3, 0, 0),
      line(4, 1.5, 6, 1.5),
    ];
    const rings = officialDxfNetworkFaceRings(dangling);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(12);
    expect(rings[0]!).toHaveLength(4);
  });

  it("splits an X-crossing pair of interior walls into four rooms", () => {
    const crossed: DxfEntity[] = [
      line(0, 0, 4, 0),
      line(4, 0, 4, 4),
      line(4, 4, 0, 4),
      line(0, 4, 0, 0),
      line(0, 0, 4, 4),
      line(4, 0, 0, 4),
    ];
    const rings = officialDxfNetworkFaceRings(crossed);
    expect(rings).toHaveLength(4);
    const sum = areas(rings).reduce((s, a) => s + a, 0);
    expect(sum).toBeCloseTo(16, 6);
    expect(areas(rings).every((a) => a === 4 || Math.abs(a - 4) < 1e-9)).toBe(true);
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
    expect(officialDxfNetworkFaceRings(dangling)).toEqual([]);
    expect(officialDxfHasNetworkFace(dangling)).toBe(false);
  });

  it("does not let a sub-threshold inner speck suppress a valid outer room", () => {
    const outer: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const speck: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 1, y: 1 },
        { x: 1.05, y: 1 },
        { x: 1.05, y: 1.05 },
        { x: 1, y: 1.05 },
      ],
    };
    const rings = officialDxfNetworkFaceRings([outer, speck]);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(12);
  });

  it("does not double-count a closed polyline that is also a simple loop of LINEs", () => {
    const rings = officialDxfNetworkFaceRings([CLOSED_RECT, ...RECT_LINES]);
    expect(rings).toHaveLength(1);
    expect(area(rings[0]!)).toBe(12);
  });
});
