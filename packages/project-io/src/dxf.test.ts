import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseDxfEntities } from "./dxf";
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

function lwpoly(points: { x: number; y: number }[], flags?: number, repeatClose = false): string {
  const pts = repeatClose && points[0] ? [...points, points[0]] : points;
  const flagBlock = flags == null ? "" : `  70\n${flags}\n`;
  const verts = pts.map((pt) => `  10\n${pt.x}\n  20\n${pt.y}\n`).join("");
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
