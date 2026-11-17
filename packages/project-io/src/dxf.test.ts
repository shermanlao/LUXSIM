import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  parseDxfEntities,
  dxfBounds,
  DXF_CURVE_SEGMENTS_PER_TURN,
  dxfCurveSegmentCount,
  tessellateDxfBulgeIntermediates,
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
