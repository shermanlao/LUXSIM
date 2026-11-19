import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  parseDxfEntities,
  parseDxfInsUnits,
  officialMetersPerUnitFromInsUnits,
  dxfBounds,
  DXF_CURVE_SEGMENTS_PER_TURN,
  DXF_SPLINE_MAX_SEGMENTS,
  dxfCurveSegmentCount,
  dxfEllipseSweepRad,
  dxfSplineSegmentCount,
  evaluateDxfSpline,
  interpolateDxfFitSpline,
  tessellateDxfBulgeIntermediates,
  dxfOcsToPlan,
  dxfExtrusionIsDefaultWorldZ,
  dxfArbitraryAxes,
} from "./dxf";
import { importIfcText } from "./ifc-import";

describe("parseDxfEntities", () => {
  it("parses sample plan", () => {
    const text = readFileSync(
      path.join(process.cwd(), "fixtures/sample-plan.dxf"),
      "utf8"
    );
    const entities = parseDxfEntities(text);
    expect(entities.length).toBeGreaterThan(0);
  });
});

describe("importIfcText", () => {
  it("extracts storeys and spaces", () => {
    const text = readFileSync(
      path.join(process.cwd(), "fixtures/sample-building.ifc"),
      "utf8"
    );
    const { scene, warnings } = importIfcText(text);
    expect(scene.version).toBe(2);
    expect(scene.storeys.map((storey) => storey.name)).toEqual([
      "Ground Floor",
      "Level 1",
    ]);
    expect(scene.rooms.map((room) => room.name)).toEqual([
      "Office A",
      "Meeting B",
      "Corridor",
    ]);
    expect(scene.storeys.some((storey) => storey.name === "0Storey1")).toBe(false);
    expect(scene.rooms.some((room) => room.name === "0Space1")).toBe(false);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });
});

function lwpoly(
  points: Array<{ x: number; y: number; bulge?: number }>,
  flags?: number,
  repeatClose = false
): string {
  const pts = repeatClose && points[0] ? [...points, points[0]] : points;
  const flagBlock = flags == null ? "" : `  70\n${flags}\n`;
  const verts = pts
    .map((pt) => {
      let s = `  10\n${pt.x}\n  20\n${pt.y}\n`;
      if (pt.bulge != null) s += `  42\n${pt.bulge}\n`;
      return s;
    })
    .join("");
  return (
    "  0\nSECTION\n  2\nENTITIES\n  0\nLWPOLYLINE\n" +
    flagBlock +
    `  90\n${pts.length}\n` +
    verts +
    "  0\nENDSEC\n  0\nEOF\n"
  );
}

function line(a: { x: number; y: number }, b: { x: number; y: number }): string {
  return (
    "  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n" +
    `  10\n${a.x}\n  20\n${a.y}\n  11\n${b.x}\n  21\n${b.y}\n` +
    "  0\nENDSEC\n  0\nEOF\n"
  );
}

describe("parseDxfEntities closed LWPOLYLINE flag", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("sets closed when group 70 bit 1 is set, including 70 = 129", () => {
    const flagged = parseDxfEntities(lwpoly(rect, 1));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ type: "polyline", closed: true });
    expect(flagged[0]!.points).toEqual(rect);

    const plinegen = parseDxfEntities(lwpoly(rect, 129));
    expect(plinegen[0]?.closed).toBe(true);
    expect(plinegen[0]?.points).toEqual(rect);
  });

  it("leaves a polyline open when group 70 bit 1 is clear or omitted", () => {
    const zero = parseDxfEntities(lwpoly(rect, 0));
    expect(zero[0]?.closed).toBeUndefined();
    expect(zero[0]?.points).toEqual(rect);

    const plinegenOnly = parseDxfEntities(lwpoly(rect, 128));
    expect(plinegenOnly[0]?.closed).toBeUndefined();
    expect(plinegenOnly[0]?.points).toEqual(rect);

    const omitted = parseDxfEntities(lwpoly(rect));
    expect(omitted[0]?.closed).toBeUndefined();
    expect(omitted[0]?.points).toEqual(rect);
  });

  it("treats first==last as closed and drops the duplicate closing vertex", () => {
    const coinc = parseDxfEntities(lwpoly(rect, 0, true));
    expect(coinc[0]?.closed).toBe(true);
    expect(coinc[0]?.points).toEqual(rect);
    expect(coinc[0]?.points[coinc[0]!.points.length - 1]).not.toEqual(
      coinc[0]?.points[0]
    );

    const flaggedAndRepeated = parseDxfEntities(lwpoly(rect, 1, true));
    expect(flaggedAndRepeated[0]?.closed).toBe(true);
    expect(flaggedAndRepeated[0]?.points).toEqual(rect);
  });

  it("does not mark LINE entities closed", () => {
    const entities = parseDxfEntities(line({ x: 0, y: 0 }, { x: 10, y: 0 }));
    expect(entities).toEqual([
      {
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      },
    ]);
  });
});

function dxfFile(body: string): string {
  return "  0\nSECTION\n  2\nENTITIES\n" + body + "  0\nENDSEC\n  0\nEOF\n";
}

function circleEnt(cx: number, cy: number, r: number): string {
  return `  0\nCIRCLE\n  10\n${cx}\n  20\n${cy}\n  40\n${r}\n`;
}

function arcEnt(cx: number, cy: number, r: number, start: number, end: number): string {
  return `  0\nARC\n  10\n${cx}\n  20\n${cy}\n  40\n${r}\n  50\n${start}\n  51\n${end}\n`;
}

function oldPoly(
  verts: Array<{ x: number; y: number; bulge?: number }>,
  flags?: number
): string {
  let s = "  0\nPOLYLINE\n";
  if (flags != null) s += `  70\n${flags}\n`;
  for (const v of verts) {
    s += `  0\nVERTEX\n  10\n${v.x}\n  20\n${v.y}\n`;
    if (v.bulge != null) s += `  42\n${v.bulge}\n`;
  }
  return s + "  0\nSEQEND\n";
}

describe("parseDxfEntities CIRCLE, ARC, and old POLYLINE", () => {
  it("uses 48 segments per full turn, and a 90° arc uses 12", () => {
    expect(DXF_CURVE_SEGMENTS_PER_TURN).toBe(48);
    expect(dxfCurveSegmentCount(Math.PI * 2)).toBe(48);
    expect(dxfCurveSegmentCount(Math.PI / 2)).toBe(12);
    expect(dxfCurveSegmentCount(Math.PI / 2)).toBe(
      Math.max(2, Math.round((48 * (Math.PI / 2)) / (Math.PI * 2)))
    );
    // A 20° seam-crossing sweep is still at least 2, typically 3.
    expect(dxfCurveSegmentCount((20 * Math.PI) / 180)).toBe(3);
    expect(dxfCurveSegmentCount(0)).toBe(0);
  });

  it("parses a CIRCLE as a closed 48-vertex polygonal loop", () => {
    const entities = parseDxfEntities(dxfFile(circleEnt(1, 2, 3)));
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe("polyline");
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(4);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(2);
    const mid = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 4]!;
    expect(mid.x).toBeCloseTo(1);
    expect(mid.y).toBeCloseTo(5);
    expect(entities[0]!.points[0]).not.toEqual(
      entities[0]!.points[entities[0]!.points.length - 1]
    );
    const b = dxfBounds(entities)!;
    expect(b.minX).toBeCloseTo(-2);
    expect(b.maxX).toBeCloseTo(4);
    expect(b.minY).toBeCloseTo(-1);
    expect(b.maxY).toBeCloseTo(5);
  });

  it("parses an ARC, including one that crosses the 0° seam, as an open polyline", () => {
    const quarter = parseDxfEntities(dxfFile(arcEnt(0, 0, 2, 0, 90)));
    expect(quarter).toHaveLength(1);
    expect(quarter[0]?.type).toBe("polyline");
    expect(quarter[0]?.closed).toBeUndefined();
    expect(quarter[0]?.points).toHaveLength(13);
    expect(quarter[0]!.points[0]!.x).toBeCloseTo(2);
    expect(quarter[0]!.points[0]!.y).toBeCloseTo(0);
    const end = quarter[0]!.points[quarter[0]!.points.length - 1]!;
    expect(end.x).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(2);

    const seam = parseDxfEntities(dxfFile(arcEnt(0, 0, 1, 350, 10)));
    expect(seam).toHaveLength(1);
    expect(seam[0]?.closed).toBeUndefined();
    expect(seam[0]?.points).toHaveLength(4);
    expect(seam[0]!.points[0]!.x).toBeCloseTo(Math.cos((350 * Math.PI) / 180));
    expect(seam[0]!.points[0]!.y).toBeCloseTo(Math.sin((350 * Math.PI) / 180));
    const seamEnd = seam[0]!.points[seam[0]!.points.length - 1]!;
    expect(seamEnd.x).toBeCloseTo(Math.cos((10 * Math.PI) / 180));
    expect(seamEnd.y).toBeCloseTo(Math.sin((10 * Math.PI) / 180));
    // CCW 20° sweep stays in the first and fourth quadrants, not the long way.
    for (const p of seam[0]!.points) {
      expect(p.x).toBeGreaterThan(0.9);
    }
  });

  it("treats an ARC with equal start and end angles as a closed full circle", () => {
    const full = parseDxfEntities(dxfFile(arcEnt(0, 0, 1, 45, 45)));
    expect(full[0]?.closed).toBe(true);
    expect(full[0]?.points).toHaveLength(48);
    expect(full[0]!.points[0]!.x).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(full[0]!.points[0]!.y).toBeCloseTo(Math.sin(Math.PI / 4));
  });

  it("parses open and closed old-style POLYLINE entities", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const closed = parseDxfEntities(dxfFile(oldPoly(rect, 1)));
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ type: "polyline", closed: true });
    expect(closed[0]!.points).toEqual(rect);

    const open = parseDxfEntities(dxfFile(oldPoly(rect, 0)));
    expect(open[0]?.closed).toBeUndefined();
    expect(open[0]?.points).toEqual(rect);

    const coinc = parseDxfEntities(dxfFile(oldPoly([...rect, rect[0]!], 0)));
    expect(coinc[0]?.closed).toBe(true);
    expect(coinc[0]?.points).toEqual(rect);
  });

  it("tessellates an old POLYLINE bulge (including a semicircle)", () => {
    expect(Math.tan(Math.PI / 4)).toBeCloseTo(1);
    const entities = parseDxfEntities(
      dxfFile(
        oldPoly(
          [
            { x: 1, y: 0, bulge: 1 },
            { x: -1, y: 0 },
          ],
          0
        )
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBeUndefined();
    // 180° → 24 segments, 25 points including endpoints.
    expect(entities[0]?.points).toHaveLength(25);
    expect(entities[0]!.points[0]).toEqual({ x: 1, y: 0 });
    expect(entities[0]!.points[entities[0]!.points.length - 1]).toEqual({
      x: -1,
      y: 0,
    });
    const apex = entities[0]!.points[12]!;
    expect(apex.x).toBeCloseTo(0);
    expect(apex.y).toBeCloseTo(1);
    for (const p of entities[0]!.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9);
    }

    const intermediates = tessellateDxfBulgeIntermediates(
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      -1
    );
    expect(intermediates).toHaveLength(23);
    const cwApex = intermediates[11]!;
    expect(cwApex.x).toBeCloseTo(0);
    expect(cwApex.y).toBeCloseTo(-1);
  });

  it("skips a zero-radius CIRCLE, an empty POLYLINE, and a mesh POLYLINE", () => {
    const empty = parseDxfEntities(
      dxfFile(
        circleEnt(0, 0, 0) +
          oldPoly([{ x: 1, y: 1 }]) +
          oldPoly(
            [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
            ],
            16
          )
      )
    );
    expect(empty).toEqual([]);
  });
});

describe("parseDxfEntities LWPOLYLINE bulges", () => {
  it("tessellates a closed LWPOLYLINE with a non-zero bulge, not a straight chord", () => {
    const entities = parseDxfEntities(
      lwpoly(
        [
          { x: 1, y: 0, bulge: 1 },
          { x: -1, y: 0, bulge: 1 },
        ],
        1
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe("polyline");
    expect(entities[0]?.closed).toBe(true);
    // Two 180° bulges → 24 + 24 segments, 48 unique vertices (no closing chord).
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(entities[0]!.points[0]).toEqual({ x: 1, y: 0 });
    const apex = entities[0]!.points[12]!;
    expect(apex.x).toBeCloseTo(0);
    expect(apex.y).toBeCloseTo(1);
    const south = entities[0]!.points[36]!;
    expect(south.x).toBeCloseTo(0);
    expect(south.y).toBeCloseTo(-1);
    for (const p of entities[0]!.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 9);
    }
    const b = dxfBounds(entities)!;
    expect(b.minX).toBeCloseTo(-1);
    expect(b.maxX).toBeCloseTo(1);
    expect(b.minY).toBeCloseTo(-1);
    expect(b.maxY).toBeCloseTo(1);
  });

  it("keeps a bulge of 0 or an omitted bulge as a straight edge", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const omitted = parseDxfEntities(lwpoly(rect, 1));
    expect(omitted[0]?.closed).toBe(true);
    expect(omitted[0]?.points).toEqual(rect);

    const zero = parseDxfEntities(
      lwpoly(
        rect.map((pt, i) => (i === 0 ? { ...pt, bulge: 0 } : pt)),
        1
      )
    );
    expect(zero[0]?.closed).toBe(true);
    expect(zero[0]?.points).toEqual(rect);
  });

  it("does not invent a closing chord on an open LWPOLYLINE, even with a last-vertex bulge", () => {
    const entities = parseDxfEntities(
      lwpoly(
        [
          { x: 1, y: 0, bulge: 1 },
          { x: -1, y: 0, bulge: 1 },
        ],
        0
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBeUndefined();
    // 180° bulge only on the first-to-last segment; last bulge is unused because it is open.
    expect(entities[0]?.points).toHaveLength(25);
    expect(entities[0]!.points[0]).toEqual({ x: 1, y: 0 });
    expect(entities[0]!.points[entities[0]!.points.length - 1]).toEqual({
      x: -1,
      y: 0,
    });
    const apex = entities[0]!.points[12]!;
    expect(apex.x).toBeCloseTo(0);
    expect(apex.y).toBeCloseTo(1);
    expect(entities[0]!.points.some((p) => p.y < -1e-9)).toBe(false);
  });

  it("applies group 42 even when it is written between group 10 and 20", () => {
    const body =
      "  0\nSECTION\n  2\nENTITIES\n  0\nLWPOLYLINE\n  70\n0\n" +
      "  10\n1\n  42\n1\n  20\n0\n" +
      "  10\n-1\n  20\n0\n" +
      "  0\nENDSEC\n  0\nEOF\n";
    const entities = parseDxfEntities(body);
    expect(entities[0]?.points).toHaveLength(25);
    const apex = entities[0]!.points[12]!;
    expect(apex.x).toBeCloseTo(0);
    expect(apex.y).toBeCloseTo(1);
  });
});


function ellipseEnt(
  cx: number,
  cy: number,
  mx: number,
  my: number,
  ratio?: number,
  start?: number,
  end?: number
): string {
  let s =
    `  0\nELLIPSE\n  10\n${cx}\n  20\n${cy}\n  11\n${mx}\n  21\n${my}\n`;
  if (ratio != null) s += `  40\n${ratio}\n`;
  if (start != null) s += `  41\n${start}\n`;
  if (end != null) s += `  42\n${end}\n`;
  return s;
}

describe("parseDxfEntities ELLIPSE", () => {
  it("parses an axis-aligned full ellipse as a closed 48-vertex loop with known extents", () => {
    const entities = parseDxfEntities(dxfFile(ellipseEnt(0, 0, 2, 0, 0.5, 0, Math.PI * 2)));
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe("polyline");
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(2);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(0);
    const q = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 4]!;
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(1);
    const half = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 2]!;
    expect(half.x).toBeCloseTo(-2);
    expect(half.y).toBeCloseTo(0);
    const three = entities[0]!.points[(3 * DXF_CURVE_SEGMENTS_PER_TURN) / 4]!;
    expect(three.x).toBeCloseTo(0);
    expect(three.y).toBeCloseTo(-1);
    expect(entities[0]!.points[0]).not.toEqual(
      entities[0]!.points[entities[0]!.points.length - 1]
    );
    const b = dxfBounds(entities)!;
    expect(b.minX).toBeCloseTo(-2);
    expect(b.maxX).toBeCloseTo(2);
    expect(b.minY).toBeCloseTo(-1);
    expect(b.maxY).toBeCloseTo(1);
  });

  it("treats omitted start/end parameters as a full ellipse (DXF defaults 0 and 2π)", () => {
    const omitted = parseDxfEntities(dxfFile(ellipseEnt(0, 0, 2, 0, 0.5)));
    expect(omitted[0]?.closed).toBe(true);
    expect(omitted[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(dxfEllipseSweepRad(0, Math.PI * 2).sweepRad).toBe(Math.PI * 2);
  });

  it("tessellates a ratio-1 ELLIPSE as a 48-vertex circle and does not drop it", () => {
    const entities = parseDxfEntities(dxfFile(ellipseEnt(0, 0, 2, 0, 1, 0, Math.PI * 2)));
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(2);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(0);
    const q = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 4]!;
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(2);
    for (const p of entities[0]!.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(2, 9);
    }
    const b = dxfBounds(entities)!;
    expect(b.minX).toBeCloseTo(-2);
    expect(b.maxX).toBeCloseTo(2);
    expect(b.minY).toBeCloseTo(-2);
    expect(b.maxY).toBeCloseTo(2);
  });

  it("tessellates a quarter and a half elliptical arc without a closing chord", () => {
    const quarter = parseDxfEntities(
      dxfFile(ellipseEnt(0, 0, 2, 0, 0.5, 0, Math.PI / 2))
    );
    expect(quarter).toHaveLength(1);
    expect(quarter[0]?.type).toBe("polyline");
    expect(quarter[0]?.closed).toBeUndefined();
    expect(quarter[0]?.points).toHaveLength(13);
    expect(quarter[0]!.points[0]!.x).toBeCloseTo(2);
    expect(quarter[0]!.points[0]!.y).toBeCloseTo(0);
    const qEnd = quarter[0]!.points[quarter[0]!.points.length - 1]!;
    expect(qEnd.x).toBeCloseTo(0);
    expect(qEnd.y).toBeCloseTo(1);
    // No invented closing chord through the interior or the missing quadrants.
    expect(quarter[0]!.points.some((p) => p.x < -1e-9 || p.y < -1e-9)).toBe(false);

    const half = parseDxfEntities(dxfFile(ellipseEnt(0, 0, 2, 0, 0.5, 0, Math.PI)));
    expect(half[0]?.closed).toBeUndefined();
    expect(half[0]?.points).toHaveLength(25);
    expect(half[0]!.points[0]!.x).toBeCloseTo(2);
    expect(half[0]!.points[0]!.y).toBeCloseTo(0);
    const apex = half[0]!.points[12]!;
    expect(apex.x).toBeCloseTo(0);
    expect(apex.y).toBeCloseTo(1);
    const hEnd = half[0]!.points[half[0]!.points.length - 1]!;
    expect(hEnd.x).toBeCloseTo(-2);
    expect(hEnd.y).toBeCloseTo(0);
    expect(half[0]!.points.some((p) => p.y < -1e-9)).toBe(false);
  });

  it("skips a missing, zero, or non-finite ratio, and a degenerate or missing major axis", () => {
    const skipped = parseDxfEntities(
      dxfFile(
        ellipseEnt(0, 0, 2, 0) + // no group 40
          ellipseEnt(0, 0, 2, 0, 0) +
          ellipseEnt(0, 0, 2, 0, Number.NaN) +
          ellipseEnt(0, 0, 2, 0, Number.POSITIVE_INFINITY) +
          ellipseEnt(0, 0, 0, 0, 0.5) +
          "  0\nELLIPSE\n  10\n0\n  20\n0\n  40\n0.5\n"
      )
    );
    expect(skipped).toEqual([]);
    expect(parseDxfEntities("")).toEqual([]);
    expect(parseDxfEntities(dxfFile(""))).toEqual([]);
  });
});

function splineEnt(opts: {
  flags?: number;
  degree: number;
  knots?: number[];
  points?: Array<{ x: number; y: number }>;
  weights?: number[];
  fitPoints?: Array<{ x: number; y: number }>;
  startTangent?: { x: number; y: number };
  endTangent?: { x: number; y: number };
}): string {
  const flags = opts.flags ?? 0;
  const knots = opts.knots ?? [];
  const points = opts.points ?? [];
  let s =
    `  0\nSPLINE\n  70\n${flags}\n  71\n${opts.degree}\n` +
    `  72\n${knots.length}\n  73\n${points.length}\n`;
  if (opts.fitPoints) s += `  74\n${opts.fitPoints.length}\n`;
  for (const k of knots) s += `  40\n${k}\n`;
  if (opts.weights) {
    for (const w of opts.weights) s += `  41\n${w}\n`;
  }
  for (const pt of points) s += `  10\n${pt.x}\n  20\n${pt.y}\n  30\n0\n`;
  if (opts.fitPoints) {
    for (const pt of opts.fitPoints) s += `  11\n${pt.x}\n  21\n${pt.y}\n`;
  }
  if (opts.startTangent) {
    s += `  12\n${opts.startTangent.x}\n  22\n${opts.startTangent.y}\n`;
  }
  if (opts.endTangent) {
    s += `  13\n${opts.endTangent.x}\n  23\n${opts.endTangent.y}\n`;
  }
  return s;
}

function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function minDistanceToPolyline(
  p: { x: number; y: number },
  pts: Array<{ x: number; y: number }>,
  closed: boolean
): number {
  let min = Infinity;
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    min = Math.min(min, pointToSegmentDistance(p, pts[i]!, pts[(i + 1) % n]!));
  }
  return min;
}

function finiteSecondDerivative(
  interp: { degree: number; control: { x: number; y: number }[]; knots: number[] },
  u: number,
  towardEnd: boolean
): { x: number; y: number } {
  const h = 1e-5;
  const u0 = towardEnd ? u : u;
  const u1 = towardEnd ? u - h : u + h;
  const u2 = towardEnd ? u - 2 * h : u + 2 * h;
  const a = evaluateDxfSpline(interp.degree, interp.control, interp.knots, u0)!;
  const b = evaluateDxfSpline(interp.degree, interp.control, interp.knots, u1)!;
  const c = evaluateDxfSpline(interp.degree, interp.control, interp.knots, u2)!;
  return { x: (c.x - 2 * b.x + a.x) / (h * h), y: (c.y - 2 * b.y + a.y) / (h * h) };
}

describe("parseDxfEntities SPLINE", () => {
  const cubicPts = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 0 },
  ];
  const cubicKnots = [0, 0, 0, 0, 1, 1, 1, 1];

  it("evaluates a clamped cubic open spline through known De Boor points", () => {
    const mid = evaluateDxfSpline(3, cubicPts, cubicKnots, 0.5);
    // Cubic Bézier at t=0.5: 0.125 P0 + 0.375 P1 + 0.375 P2 + 0.125 P3 = (2, 1.5)
    expect(mid?.x).toBeCloseTo(2, 10);
    expect(mid?.y).toBeCloseTo(1.5, 10);
    const start = evaluateDxfSpline(3, cubicPts, cubicKnots, 0);
    expect(start?.x).toBeCloseTo(0, 10);
    expect(start?.y).toBeCloseTo(0, 10);
    const end = evaluateDxfSpline(3, cubicPts, cubicKnots, 1);
    expect(end?.x).toBeCloseTo(4, 10);
    expect(end?.y).toBeCloseTo(0, 10);

    const entities = parseDxfEntities(dxfFile(splineEnt({
      degree: 3,
      knots: cubicKnots,
      points: cubicPts,
    })));
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBeUndefined();
    expect(entities[0]?.type).toBe("polyline");
    // Open spline includes endpoints: 48 segments → 49 vertices.
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN + 1);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(0);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(0);
    const midPt = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 2]!;
    expect(midPt.x).toBeCloseTo(2, 10);
    expect(midPt.y).toBeCloseTo(1.5, 10);
    const last = entities[0]!.points[entities[0]!.points.length - 1]!;
    expect(last.x).toBeCloseTo(4);
    expect(last.y).toBeCloseTo(0);
    // No invented closing chord back to the origin.
    expect(
      entities[0]!.points.some((p, i) => {
        if (i === 0) return false;
        return p.x < 0 || (p.x < 1e-9 && p.y < 1e-9);
      })
    ).toBe(false);
  });

  it("tessellates a rational quadratic quarter circle and does not close it with a chord", () => {
    const w = Math.SQRT1_2;
    const pts = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const knots = [0, 0, 0, 1, 1, 1];
    const mid = evaluateDxfSpline(2, pts, knots, 0.5, [1, w, 1]);
    expect(mid?.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(mid?.y).toBeCloseTo(Math.SQRT1_2, 10);

    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          flags: 4,
          degree: 2,
          knots,
          points: pts,
          weights: [1, w, 1],
        })
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBeUndefined();
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN + 1);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(1);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(0);
    const midPt = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 2]!;
    expect(midPt.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(midPt.y).toBeCloseTo(Math.SQRT1_2, 10);
    const last = entities[0]!.points[entities[0]!.points.length - 1]!;
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(1);
    // Quarter circle stays in the first quadrant — no invented chord through the interior.
    expect(entities[0]!.points.some((p) => p.x < -1e-9 || p.y < -1e-9)).toBe(false);
    for (const p of entities[0]!.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 8);
    }
  });

  it("parses a closed rational quadratic circle as a closed 48-vertex loop", () => {
    const w = Math.SQRT1_2;
    const pts = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
    ];
    const knots = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4];
    const weights = [1, w, 1, w, 1, w, 1, w, 1];
    const entities = parseDxfEntities(
      dxfFile(splineEnt({ flags: 1 | 4, degree: 2, knots, points: pts, weights }))
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(1);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(0);
    // No duplicate closing corner.
    const last = entities[0]!.points[entities[0]!.points.length - 1]!;
    expect(last.x).not.toBeCloseTo(1, 6);
    for (const p of entities[0]!.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 8);
    }
    const bounds = dxfBounds(entities)!;
    expect(bounds.minX).toBeCloseTo(-1, 6);
    expect(bounds.maxX).toBeCloseTo(1, 6);
    expect(bounds.minY).toBeCloseTo(-1, 6);
    expect(bounds.maxY).toBeCloseTo(1, 6);
  });

  it("parses a periodic closed quadratic spline and does not invent a chord", () => {
    const pts = [
      { x: 3, y: 3 },
      { x: -3, y: 3 },
      { x: -3, y: -3 },
      { x: 3, y: -3 },
    ];
    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          flags: 1 | 2,
          degree: 2,
          knots: [0, 1, 2, 3, 4],
          points: pts,
        })
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points.length).toBeGreaterThanOrEqual(DXF_CURVE_SEGMENTS_PER_TURN);
    const first = entities[0]!.points[0]!;
    const last = entities[0]!.points[entities[0]!.points.length - 1]!;
    // Closed without a duplicate closing corner.
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeGreaterThan(1e-3);
    const bounds = dxfBounds(entities)!;
    expect(bounds.minX).toBeGreaterThanOrEqual(-3 - 1e-9);
    expect(bounds.maxX).toBeLessThanOrEqual(3 + 1e-9);
    expect(bounds.minY).toBeGreaterThanOrEqual(-3 - 1e-9);
    expect(bounds.maxY).toBeLessThanOrEqual(3 + 1e-9);
  });

  it("raises the sample count on a multi-span spline and caps at the documented maximum", () => {
    // Degree 3, 20 control points, clamped: 17 non-empty spans → max(48, 4×17) = 68.
    const n = 20;
    const degree = 3;
    const points = Array.from({ length: n }, (_, i) => ({ x: i, y: i % 3 === 1 ? 1 : 0 }));
    const knots = [0, 0, 0, 0, ...Array.from({ length: n - degree - 1 }, (_, i) => i + 1), n - degree, n - degree, n - degree, n - degree];
    expect(knots).toHaveLength(n + degree + 1);
    expect(dxfSplineSegmentCount(17)).toBe(68);
    const entities = parseDxfEntities(dxfFile(splineEnt({ degree, knots, points })));
    expect(entities[0]?.points).toHaveLength(68 + 1);

    // Many spans cap at 384 (open: 384 segments + endpoint).
    const n2 = 120;
    const points2 = Array.from({ length: n2 }, (_, i) => ({ x: i, y: 0 }));
    const knots2 = [0, 0, 0, 0, ...Array.from({ length: n2 - degree - 1 }, (_, i) => i + 1), n2 - degree, n2 - degree, n2 - degree, n2 - degree];
    expect(dxfSplineSegmentCount(n2 - degree)).toBe(DXF_SPLINE_MAX_SEGMENTS);
    const many = parseDxfEntities(dxfFile(splineEnt({ degree, knots: knots2, points: points2 })));
    expect(many[0]?.points).toHaveLength(DXF_SPLINE_MAX_SEGMENTS + 1);
  });

  it("skips degenerate, missing-knot, too-few-control, and non-finite control-point splines", () => {
    const skipped = parseDxfEntities(
      dxfFile(
        splineEnt({ degree: 0, knots: [0, 1], points: cubicPts }) +
          splineEnt({ degree: 3, knots: cubicKnots, points: cubicPts.slice(0, 3) }) +
          splineEnt({ degree: 3, knots: [], points: cubicPts }) +
          splineEnt({ degree: 3, knots: [0, 0, 0, 1, 1, 1], points: cubicPts }) +
          splineEnt({
            degree: 3,
            knots: cubicKnots,
            points: [
              { x: Number.NaN, y: 0 },
              { x: 1, y: 2 },
              { x: 3, y: 2 },
              { x: 4, y: 0 },
            ],
          }) +
          splineEnt({
            degree: 3,
            knots: [0, 0, 0, 0, Number.POSITIVE_INFINITY, 1, 1, 1],
            points: cubicPts,
          }) +
          splineEnt({
            flags: 4,
            degree: 3,
            knots: cubicKnots,
            points: cubicPts,
            weights: [0, 0, 0, 0],
          })
      )
    );
    expect(skipped).toEqual([]);
    expect(parseDxfEntities("")).toEqual([]);
    expect(parseDxfEntities(dxfFile(""))).toEqual([]);
  });

  const openFitPts = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 0 },
  ];

  it("traces an open fit-point-only cubic through every fit point", () => {
    const interp = interpolateDxfFitSpline(openFitPts, 3);
    expect(interp).not.toBeNull();
    expect(interp!.closed).toBe(false);
    expect(interp!.params).toHaveLength(openFitPts.length);
    expect(interp!.params[0]).toBeCloseTo(0, 12);
    expect(interp!.params[openFitPts.length - 1]).toBeCloseTo(1, 12);
    // Parameters are centripetal (α = 1/2) on [0, 1].
    const chords = openFitPts.slice(1).map((p, i) =>
      Math.sqrt(Math.hypot(p.x - openFitPts[i]!.x, p.y - openFitPts[i]!.y))
    );
    const total = chords.reduce((s, d) => s + d, 0);
    let acc = 0;
    for (let i = 0; i < chords.length; i++) {
      acc += chords[i]!;
      expect(interp!.params[i + 1]).toBeCloseTo(acc / total, 12);
    }
    for (let i = 0; i < openFitPts.length; i++) {
      const pt = evaluateDxfSpline(
        interp!.degree,
        interp!.control,
        interp!.knots,
        interp!.params[i]!
      );
      expect(pt).not.toBeNull();
      expect(pt!.x).toBeCloseTo(openFitPts[i]!.x, 10);
      expect(pt!.y).toBeCloseTo(openFitPts[i]!.y, 10);
    }
    // Natural (C'' = 0) ends: a one-sided second difference at each end is
    // near zero, and much smaller than the mid-domain curvature.
    const c0 = finiteSecondDerivative(interp!, 0, false);
    const c1 = finiteSecondDerivative(interp!, 1, true);
    const cMid = finiteSecondDerivative(interp!, 0.5, false);
    const midMag = Math.hypot(cMid.x, cMid.y);
    expect(Math.hypot(c0.x, c0.y)).toBeLessThan(Math.max(0.05, midMag / 20));
    expect(Math.hypot(c1.x, c1.y)).toBeLessThan(Math.max(0.05, midMag / 20));

    const entities = parseDxfEntities(
      dxfFile(splineEnt({ degree: 3, fitPoints: openFitPts }))
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBeUndefined();
    expect(entities[0]?.type).toBe("polyline");
    expect(entities[0]!.points.length).toBeGreaterThanOrEqual(
      DXF_CURVE_SEGMENTS_PER_TURN + 1
    );
    const first = entities[0]!.points[0]!;
    const last = entities[0]!.points[entities[0]!.points.length - 1]!;
    expect(first.x).toBeCloseTo(0, 10);
    expect(first.y).toBeCloseTo(0, 10);
    expect(last.x).toBeCloseTo(4, 10);
    expect(last.y).toBeCloseTo(0, 10);
    for (const q of openFitPts) {
      expect(minDistanceToPolyline(q, entities[0]!.points, false)).toBeLessThan(1e-6);
    }
  });

  it("traces a closed fit-point-only cubic with no invented chord at the join", () => {
    const fitPts = [
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
      { x: 0, y: -2 },
    ];
    const interp = interpolateDxfFitSpline(fitPts, 3, { closed: true });
    expect(interp).not.toBeNull();
    expect(interp!.closed).toBe(true);
    for (let i = 0; i < fitPts.length; i++) {
      const pt = evaluateDxfSpline(
        interp!.degree,
        interp!.control,
        interp!.knots,
        interp!.params[i]!
      );
      expect(pt).not.toBeNull();
      expect(pt!.x).toBeCloseTo(fitPts[i]!.x, 10);
      expect(pt!.y).toBeCloseTo(fitPts[i]!.y, 10);
    }
    const entities = parseDxfEntities(
      dxfFile(splineEnt({ flags: 1, degree: 3, fitPoints: fitPts }))
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBe(true);
    const pts = entities[0]!.points;
    expect(pts.length).toBeGreaterThanOrEqual(DXF_CURVE_SEGMENTS_PER_TURN);
    for (const q of fitPts) {
      expect(minDistanceToPolyline(q, pts, true)).toBeLessThan(1e-6);
    }
    const joinChord = Math.hypot(
      fitPts[0]!.x - fitPts[fitPts.length - 1]!.x,
      fitPts[0]!.y - fitPts[fitPts.length - 1]!.y
    );
    let maxEdge = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      maxEdge = Math.max(maxEdge, Math.hypot(b.x - a.x, b.y - a.y));
    }
    // A periodic interpolant tessellates the join; it must not close with a
    // single straight chord between the last and first fit points.
    expect(maxEdge).toBeLessThan(joinChord * 0.5);
  });

  it("uses start and end fit tangents when they are present", () => {
    const startTangent = { x: 0, y: 5 };
    const endTangent = { x: 0, y: -5 };
    const withT = interpolateDxfFitSpline(openFitPts, 3, { startTangent, endTangent });
    const noT = interpolateDxfFitSpline(openFitPts, 3);
    expect(withT).not.toBeNull();
    expect(noT).not.toBeNull();
    const h = 1e-6;
    const a0 = evaluateDxfSpline(withT!.degree, withT!.control, withT!.knots, 0)!;
    const b0 = evaluateDxfSpline(withT!.degree, withT!.control, withT!.knots, h)!;
    expect((b0.x - a0.x) / h).toBeCloseTo(startTangent.x, 3);
    expect((b0.y - a0.y) / h).toBeCloseTo(startTangent.y, 3);
    const a1 = evaluateDxfSpline(withT!.degree, withT!.control, withT!.knots, 1)!;
    const b1 = evaluateDxfSpline(withT!.degree, withT!.control, withT!.knots, 1 - h)!;
    expect((a1.x - b1.x) / h).toBeCloseTo(endTangent.x, 3);
    expect((a1.y - b1.y) / h).toBeCloseTo(endTangent.y, 3);

    const tracedT = parseDxfEntities(
      dxfFile(
        splineEnt({
          degree: 3,
          fitPoints: openFitPts,
          startTangent,
          endTangent,
        })
      )
    );
    const tracedN = parseDxfEntities(
      dxfFile(splineEnt({ degree: 3, fitPoints: openFitPts }))
    );
    expect(tracedT).toHaveLength(1);
    expect(tracedN).toHaveLength(1);
    const midT = tracedT[0]!.points[1]!;
    const midN = tracedN[0]!.points[1]!;
    expect(Math.hypot(midT.x - midN.x, midT.y - midN.y)).toBeGreaterThan(1e-3);
  });

  it("ignores fit points when usable control points are present", () => {
    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          degree: 3,
          knots: cubicKnots,
          points: cubicPts,
          fitPoints: [
            { x: 9, y: 9 },
            { x: 8, y: 8 },
            { x: 7, y: 7 },
            { x: 6, y: 6 },
          ],
        })
      )
    );
    const controlOnly = parseDxfEntities(
      dxfFile(splineEnt({ degree: 3, knots: cubicKnots, points: cubicPts }))
    );
    expect(entities).toHaveLength(1);
    expect(controlOnly).toHaveLength(1);
    expect(entities[0]!.points).toHaveLength(controlOnly[0]!.points.length);
    for (let i = 0; i < entities[0]!.points.length; i++) {
      expect(entities[0]!.points[i]!.x).toBeCloseTo(controlOnly[0]!.points[i]!.x, 12);
      expect(entities[0]!.points[i]!.y).toBeCloseTo(controlOnly[0]!.points[i]!.y, 12);
    }
    const mid = entities[0]!.points[DXF_CURVE_SEGMENTS_PER_TURN / 2]!;
    expect(mid.x).toBeCloseTo(2, 10);
    expect(mid.y).toBeCloseTo(1.5, 10);
  });

  it("skips an unusable fit-point-only spline", () => {
    const skipped = parseDxfEntities(
      dxfFile(
        splineEnt({ degree: 3, fitPoints: [{ x: 1, y: 1 }] }) +
          splineEnt({
            degree: 3,
            fitPoints: [
              { x: 0, y: 0 },
              { x: Number.NaN, y: 1 },
              { x: 2, y: 0 },
            ],
          })
      )
    );
    expect(skipped).toEqual([]);
  });
});


describe("parseDxfEntities paperspace and 3D POLYLINE", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  function spaceGroup(space?: number): string {
    return space == null ? "" : `  67\n${space}\n`;
  }

  function circleWithSpace(cx: number, cy: number, r: number, space?: number): string {
    return `  0\nCIRCLE\n${spaceGroup(space)}  10\n${cx}\n  20\n${cy}\n  40\n${r}\n`;
  }

  function oldPoly3d(
    verts: Array<{ x: number; y: number; z?: number }>,
    flags?: number,
    space?: number
  ): string {
    let s = "  0\nPOLYLINE\n";
    s += spaceGroup(space);
    if (flags != null) s += `  70\n${flags}\n`;
    for (const v of verts) {
      s += `  0\nVERTEX\n  10\n${v.x}\n  20\n${v.y}\n`;
      if (v.z != null) s += `  30\n${v.z}\n`;
    }
    return s + "  0\nSEQEND\n";
  }

  /** Row-major 2×2 polygon mesh of a 4×3 plan rectangle. */
  const meshGrid = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
    { x: 4, y: 3 },
  ];

  function polygonMesh(
    verts: Array<{ x: number; y: number; z?: number }>,
    m: number,
    n: number,
    flags: number,
    space?: number
  ): string {
    let s = "  0\nPOLYLINE\n";
    s += spaceGroup(space);
    s += `  70\n${flags}\n  71\n${m}\n  72\n${n}\n`;
    for (const v of verts) {
      s += `  0\nVERTEX\n  10\n${v.x}\n  20\n${v.y}\n`;
      if (v.z != null) s += `  30\n${v.z}\n`;
    }
    return s + "  0\nSEQEND\n";
  }

  function polyfaceMesh(
    verts: Array<{ x: number; y: number; z?: number }>,
    faces: number[][],
    flags: number = 64,
    space?: number
  ): string {
    let s = "  0\nPOLYLINE\n";
    s += spaceGroup(space);
    s += `  70\n${flags}\n  71\n${verts.length}\n  72\n${faces.length}\n`;
    for (const v of verts) {
      s += "  0\nVERTEX\n  70\n192\n";
      s += `  10\n${v.x}\n  20\n${v.y}\n`;
      if (v.z != null) s += `  30\n${v.z}\n`;
    }
    for (const face of faces) {
      s += "  0\nVERTEX\n  70\n128\n";
      for (let i = 0; i < face.length; i++) {
        s += `  ${71 + i}\n${face[i]}\n`;
      }
    }
    return s + "  0\nSEQEND\n";
  }

  it("keeps a model-space CIRCLE when group 67 is omitted or 0", () => {
    for (const space of [undefined, 0]) {
      const entities = parseDxfEntities(dxfFile(circleWithSpace(1, 2, 3, space)));
      expect(entities).toHaveLength(1);
      expect(entities[0]?.closed).toBe(true);
      expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
      const b = dxfBounds(entities)!;
      expect(b.minX).toBeCloseTo(-2);
      expect(b.maxX).toBeCloseTo(4);
      expect(b.minY).toBeCloseTo(-1);
      expect(b.maxY).toBeCloseTo(5);
    }
  });

  it("skips a paperspace CIRCLE with group 67 = 1, including from bounds", () => {
    const entities = parseDxfEntities(dxfFile(circleWithSpace(1, 2, 3, 1)));
    expect(entities).toEqual([]);
    expect(dxfBounds(entities)).toBeNull();
  });

  it("keeps only model-space entities in a mixed file, and invents none from paperspace-only input", () => {
    const mixed = parseDxfEntities(
      dxfFile(
        circleWithSpace(0, 0, 2, 0) +
          "  0\nLINE\n  67\n1\n  10\n100\n  20\n100\n  11\n200\n  21\n200\n" +
          "  0\nLWPOLYLINE\n  67\n1\n  70\n1\n  90\n4\n" +
          "  10\n100\n  20\n0\n  10\n110\n  20\n0\n  10\n110\n  20\n10\n  10\n100\n  20\n10\n" +
          "  0\nARC\n  67\n1\n  10\n50\n  20\n50\n  40\n5\n  50\n0\n  51\n90\n" +
          "  0\nELLIPSE\n  67\n1\n  10\n80\n  20\n80\n  11\n4\n  21\n0\n  40\n0.5\n" +
          "  0\nSPLINE\n  67\n1\n  70\n0\n  71\n3\n  72\n8\n  73\n4\n" +
          "  40\n0\n  40\n0\n  40\n0\n  40\n0\n  40\n1\n  40\n1\n  40\n1\n  40\n1\n" +
          "  10\n90\n  20\n90\n  10\n91\n  20\n92\n  10\n93\n  20\n92\n  10\n94\n  20\n90\n" +
          oldPoly3d(rect, 1, 1)
      )
    );
    expect(mixed).toHaveLength(1);
    expect(mixed[0]?.closed).toBe(true);
    expect(mixed[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const b = dxfBounds(mixed)!;
    expect(b.minX).toBeCloseTo(-2);
    expect(b.maxX).toBeCloseTo(2);
    expect(b.minY).toBeCloseTo(-2);
    expect(b.maxY).toBeCloseTo(2);

    const onlyPaper = parseDxfEntities(
      dxfFile(
        circleWithSpace(100, 100, 10, 1) +
          "  0\nLINE\n  67\n1\n  10\n0\n  20\n0\n  11\n10\n  21\n0\n"
      )
    );
    expect(onlyPaper).toEqual([]);
    expect(dxfBounds(onlyPaper)).toBeNull();
  });

  it("traces a closed non-mesh 3D POLYLINE in plan and ignores Z", () => {
    const verts = rect.map((p) => ({ ...p, z: 5 }));
    const closed = parseDxfEntities(dxfFile(oldPoly3d(verts, 9)));
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ type: "polyline", closed: true });
    expect(closed[0]!.points).toEqual(rect);
    expect(closed[0]!.points.every((p) => !("z" in p))).toBe(true);
    const b = dxfBounds(closed)!;
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 3 });

    const open = parseDxfEntities(dxfFile(oldPoly3d(verts, 8)));
    expect(open[0]?.closed).toBeUndefined();
    expect(open[0]?.points).toEqual(rect);
  });

  it("does not invent linework from a mesh POLYLINE that has no usable faces", () => {
    const skipped = parseDxfEntities(
      dxfFile(
        oldPoly3d(rect, 16) +
          oldPoly3d(rect, 64) +
          oldPoly3d(rect.map((p) => ({ ...p, z: 5 })), 24) +
          oldPoly3d(rect.map((p) => ({ ...p, z: 5 })), 72)
      )
    );
    expect(skipped).toEqual([]);
  });

  it("traces a 2×2 polygon mesh as a closed plan quad and ignores Z", () => {
    const raised = meshGrid.map((p) => ({ ...p, z: 5 }));
    const entities = parseDxfEntities(dxfFile(polygonMesh(raised, 2, 2, 16)));
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ type: "polyline", closed: true });
    expect(entities[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 0 },
    ]);
    expect(entities[0]!.points.every((p) => !("z" in p))).toBe(true);
    expect(dxfBounds(entities)).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 3 });
  });

  it("traces a polyface mesh face, including a hidden-edge index, and ignores Z", () => {
    const verts = [
      { x: 0, y: 0, z: 5 },
      { x: 4, y: 0, z: 5 },
      { x: 4, y: 3, z: 5 },
      { x: 0, y: 3, z: 5 },
    ];
    const one = parseDxfEntities(dxfFile(polyfaceMesh(verts, [[1, -2, 3, 4]])));
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ type: "polyline", closed: true });
    expect(one[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]);
    expect(dxfBounds(one)).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 3 });

    const two = parseDxfEntities(
      dxfFile(
        polyfaceMesh(
          [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
            { x: 8, y: 0 },
            { x: 8, y: 3 },
          ],
          [
            [1, 2, 3, 4],
            [2, 5, 6, 3],
          ]
        )
      )
    );
    expect(two).toHaveLength(2);
    expect(two.every((e) => e.closed === true)).toBe(true);
  });

  it("skips a paperspace mesh and an invalid or empty mesh", () => {
    const paper = parseDxfEntities(dxfFile(polygonMesh(meshGrid, 2, 2, 16, 1)));
    expect(paper).toEqual([]);
    expect(dxfBounds(paper)).toBeNull();

    const empty = parseDxfEntities(dxfFile(polygonMesh([], 2, 2, 16)));
    expect(empty).toEqual([]);

    const badFace = parseDxfEntities(
      dxfFile(polyfaceMesh(meshGrid, [[1, 2, 99]]))
    );
    expect(badFace).toEqual([]);
  });
});

describe("DXF 3D extrusion in plan", () => {
  it("maps OCS points with the Autodesk Arbitrary Axis Algorithm", () => {
    expect(dxfExtrusionIsDefaultWorldZ({ x: 0, y: 0, z: 1 })).toBe(true);
    expect(dxfExtrusionIsDefaultWorldZ({ x: 0, y: 0, z: -1 })).toBe(false);
    const plusZ = dxfArbitraryAxes({ x: 0, y: 0, z: 1 })!;
    expect(plusZ.ax.x).toBeCloseTo(1);
    expect(plusZ.ax.y).toBeCloseTo(0);
    expect(plusZ.ax.z).toBeCloseTo(0);
    expect(plusZ.ay.x).toBeCloseTo(0);
    expect(plusZ.ay.y).toBeCloseTo(1);
    expect(plusZ.ay.z).toBeCloseTo(0);
    expect(dxfOcsToPlan(1, 2, 0, { x: 0, y: 0, z: 1 })).toEqual({ x: 1, y: 2 });
    const flipped = dxfOcsToPlan(1, 2, 0, { x: 0, y: 0, z: -1 })!;
    expect(flipped.x).toBeCloseTo(-1);
    expect(flipped.y).toBeCloseTo(2);
  });

  it("flips LWPOLYLINE and CIRCLE plan X when extrusion is (0,0,-1)", () => {
    const poly = parseDxfEntities(
      lwpoly(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 3 },
          { x: 0, y: 3 },
        ],
        1
      ).replace(
        "  0\nLWPOLYLINE\n",
        "  0\nLWPOLYLINE\n  210\n0\n  220\n0\n  230\n-1\n"
      )
    );
    expect(poly).toHaveLength(1);
    expect(poly[0]!.points.map((pt) => [pt.x, pt.y])).toEqual([
      [0, 0],
      [-4, 0],
      [-4, 3],
      [0, 3],
    ]);
    const bounds = dxfBounds(poly)!;
    expect(bounds).toEqual({ minX: -4, minY: 0, maxX: 0, maxY: 3 });

    const circle = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nCIRCLE\n  10\n1\n  20\n2\n  40\n2\n  210\n0\n  220\n0\n  230\n-1\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(circle[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const cb = dxfBounds(circle)!;
    // Centre (1,2) in OCS becomes (-1, 2) in plan; radius 2.
    expect(cb.minX).toBeCloseTo(-3);
    expect(cb.maxX).toBeCloseTo(1);
    expect(cb.minY).toBeCloseTo(0);
    expect(cb.maxY).toBeCloseTo(4);
  });

  it("leaves LINE, SPLINE, and 3D POLYLINE in WCS when extrusion is (0,0,-1)", () => {
    const ln = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n  10\n1\n  20\n2\n  11\n4\n  21\n2\n  210\n0\n  220\n0\n  230\n-1\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(ln[0]?.points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]);

    const spline = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nSPLINE\n  70\n0\n  71\n1\n  72\n4\n  73\n2\n  40\n0\n  40\n0\n  40\n1\n  40\n1\n  10\n1\n  20\n2\n  10\n4\n  20\n2\n  210\n0\n  220\n0\n  230\n-1\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(spline.length).toBeGreaterThan(0);
    expect(spline[0]!.points[0]!.x).toBeCloseTo(1);
    expect(spline[0]!.points[0]!.y).toBeCloseTo(2);
    const last = spline[0]!.points[spline[0]!.points.length - 1]!;
    expect(last.x).toBeCloseTo(4);
    expect(last.y).toBeCloseTo(2);

    const poly3d = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nPOLYLINE\n  70\n8\n  210\n0\n  220\n0\n  230\n-1\n" +
        "  0\nVERTEX\n  10\n1\n  20\n2\n  30\n5\n" +
        "  0\nVERTEX\n  10\n4\n  20\n2\n  30\n9\n" +
        "  0\nSEQEND\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(poly3d[0]?.points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("still skips a paperspace LWPOLYLINE even when it has a non-default extrusion", () => {
    const entities = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nLWPOLYLINE\n  67\n1\n  70\n1\n  210\n0\n  220\n0\n  230\n-1\n" +
        "  10\n0\n  20\n0\n  10\n4\n  20\n0\n  10\n4\n  20\n3\n  10\n0\n  20\n3\n" +
        "  0\nENDSEC\n  0\nEOF\n"
    );
    expect(entities).toEqual([]);
    expect(dxfBounds(entities)).toBeNull();
  });

  it("projects an OCS circle with extrusion (0,1,0) to a line in plan", () => {
    const circle = parseDxfEntities(
      "  0\nSECTION\n  2\nENTITIES\n  0\nCIRCLE\n  10\n0\n  20\n0\n  40\n2\n  210\n0\n  220\n1\n  230\n0\n  0\nENDSEC\n  0\nEOF\n"
    );
    expect(circle).toHaveLength(1);
    const bounds = dxfBounds(circle)!;
    // OCS (x,y,0) with N=(0,1,0) becomes WCS (-x, 0, y); plan is the X axis.
    expect(bounds.minY).toBeCloseTo(0);
    expect(bounds.maxY).toBeCloseTo(0);
    expect(bounds.minX).toBeCloseTo(-2);
    expect(bounds.maxX).toBeCloseTo(2);
  });
});

describe("parseDxfInsUnits and officialMetersPerUnitFromInsUnits", () => {
  it("reads $INSUNITS and maps millimetres to 0.001 m per unit", () => {
    const text =
      "  0\nSECTION\n  2\nHEADER\n  9\n$INSUNITS\n  70\n4\n  0\nENDSEC\n  0\nEOF\n";
    expect(parseDxfInsUnits(text)).toBe(4);
    expect(officialMetersPerUnitFromInsUnits(4)).toBe(0.001);
    expect(officialMetersPerUnitFromInsUnits(6)).toBe(1);
    expect(officialMetersPerUnitFromInsUnits(1)).toBeCloseTo(0.0254);
    expect(officialMetersPerUnitFromInsUnits(null)).toBe(1);
    expect(officialMetersPerUnitFromInsUnits(undefined)).toBe(1);
    expect(officialMetersPerUnitFromInsUnits(99)).toBe(1);
    expect(parseDxfInsUnits("  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n")).toBeNull();
  });
});

describe("parseDxfEntities INSERT and BLOCKS", () => {
  function wrapped(inner: string): string {
    return `  0\nSECTION\n  2\nENTITIES\n${inner}  0\nENDSEC\n  0\nEOF\n`;
  }

  it("does not draw BLOCKS-table geometry at definition coordinates", () => {
    const text =
      "  0\nSECTION\n  2\nBLOCKS\n" +
      "  0\nBLOCK\n  2\nSYMB\n  10\n0\n  20\n0\n" +
      "  0\nLINE\n  10\n0\n  20\n0\n  11\n1\n  21\n0\n" +
      "  0\nENDBLK\n" +
      "  0\nENDSEC\n" +
      wrapped("  0\nLINE\n  10\n10\n  20\n20\n  11\n11\n  21\n20\n");
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(1);
    expect(entities[0]!.points).toEqual([
      { x: 10, y: 20 },
      { x: 11, y: 20 },
    ]);
  });

  it("explodes a model-space INSERT at the insertion point, scale, and rotation", () => {
    const text =
      "  0\nSECTION\n  2\nBLOCKS\n" +
      "  0\nBLOCK\n  2\nLAMP\n  10\n0\n  20\n0\n" +
      "  0\nLINE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n" +
      "  0\nENDBLK\n" +
      "  0\nENDSEC\n" +
      "  0\nSECTION\n  2\nENTITIES\n" +
      "  0\nINSERT\n  2\nLAMP\n  10\n100\n  20\n50\n  41\n3\n  42\n3\n  50\n90\n" +
      "  0\nENDSEC\n  0\nEOF\n";
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(1);
    // 90° CCW, scale 3: (2,0) → (0,6), then + (100,50)
    expect(entities[0]!.points[0]!.x).toBeCloseTo(100);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(50);
    expect(entities[0]!.points[1]!.x).toBeCloseTo(100);
    expect(entities[0]!.points[1]!.y).toBeCloseTo(56);
  });

  it("applies the block base point and a 2×1 column array", () => {
    const text =
      "  0\nSECTION\n  2\nBLOCKS\n" +
      "  0\nBLOCK\n  2\nMARK\n  10\n1\n  20\n0\n" +
      "  0\nLINE\n  10\n1\n  20\n0\n  11\n1\n  21\n1\n" +
      "  0\nENDBLK\n" +
      "  0\nENDSEC\n" +
      "  0\nSECTION\n  2\nENTITIES\n" +
      "  0\nINSERT\n  2\nMARK\n  10\n10\n  20\n0\n  70\n2\n  44\n5\n" +
      "  0\nENDSEC\n  0\nEOF\n";
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(2);
    const starts = entities.map((e) => e.points[0]!).sort((a, b) => a.x - b.x);
    expect(starts[0]!.x).toBeCloseTo(10);
    expect(starts[0]!.y).toBeCloseTo(0);
    expect(starts[1]!.x).toBeCloseTo(15);
    expect(starts[1]!.y).toBeCloseTo(0);
  });

  it("explodes a nested INSERT and ignores a cyclic block", () => {
    const text =
      "  0\nSECTION\n  2\nBLOCKS\n" +
      "  0\nBLOCK\n  2\nINNER\n  10\n0\n  20\n0\n" +
      "  0\nLINE\n  10\n0\n  20\n0\n  11\n1\n  21\n0\n" +
      "  0\nENDBLK\n" +
      "  0\nBLOCK\n  2\nOUTER\n  10\n0\n  20\n0\n" +
      "  0\nINSERT\n  2\nINNER\n  10\n4\n  20\n0\n" +
      "  0\nINSERT\n  2\nOUTER\n  10\n0\n  20\n0\n" +
      "  0\nENDBLK\n" +
      "  0\nENDSEC\n" +
      "  0\nSECTION\n  2\nENTITIES\n" +
      "  0\nINSERT\n  2\nOUTER\n  10\n20\n  20\n30\n" +
      "  0\nENDSEC\n  0\nEOF\n";
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(1);
    expect(entities[0]!.points[0]!.x).toBeCloseTo(24);
    expect(entities[0]!.points[0]!.y).toBeCloseTo(30);
    expect(entities[0]!.points[1]!.x).toBeCloseTo(25);
    expect(entities[0]!.points[1]!.y).toBeCloseTo(30);
  });

  it("does not treat *MODEL_SPACE contents as an insertable block definition", () => {
    const text =
      "  0\nSECTION\n  2\nBLOCKS\n" +
      "  0\nBLOCK\n  2\n*MODEL_SPACE\n  10\n0\n  20\n0\n" +
      "  0\nLINE\n  10\n0\n  20\n0\n  11\n999\n  21\n0\n" +
      "  0\nENDBLK\n" +
      "  0\nENDSEC\n" +
      "  0\nSECTION\n  2\nENTITIES\n" +
      "  0\nINSERT\n  2\n*MODEL_SPACE\n  10\n0\n  20\n0\n" +
      "  0\nLINE\n  10\n5\n  20\n5\n  11\n6\n  21\n5\n" +
      "  0\nENDSEC\n  0\nEOF\n";
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(1);
    expect(entities[0]!.points[0]).toEqual({ x: 5, y: 5 });
  });
});
