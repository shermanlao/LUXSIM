import { describe, expect, it } from "vitest";
import { parseDxfEntities } from "./dxf";
import {
  officialCadLayerNames,
  officialDxfLayerName,
  officialExtractVisibleCadEntities,
  officialInsertExplodedLayer,
  parseDxfLayers,
} from "./official-dxf-layers";
import {
  OFFICIAL_CAD_COMPRESS_TOL_M,
  officialCadEntityPointCount,
  officialCompressCadEntities,
} from "./official-cad-compress";
import { rectPolygon } from "./geometry";
import type { DxfEntity } from "./types";

function dxfFile(body: string): string {
  return "  0\nSECTION\n  2\nENTITIES\n" + body + "  0\nENDSEC\n  0\nEOF\n";
}

describe("DXF layer parse and visibility", () => {
  it("parses group 8 onto entities and treats a missing name as 0", () => {
    const text = dxfFile(
      "  0\nLINE\n  8\nWALL\n 10\n0\n 20\n0\n 11\n1\n 21\n0\n  0\nLINE\n 10\n2\n 20\n0\n 11\n3\n 21\n0\n"
    );
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(2);
    expect(entities[0]?.layer).toBe("WALL");
    expect(entities[1]?.layer).toBeUndefined();
    expect(officialDxfLayerName(entities[1]?.layer)).toBe("0");
  });

  it("parses the LAYER table name, on/off, and frozen flags", () => {
    const text = [
      "  0", "SECTION", "  2", "TABLES",
      "  0", "TABLE", "  2", "LAYER",
      "  0", "LAYER", "  2", "0", " 70", "0", " 62", "7",
      "  0", "LAYER", "  2", "WALL", " 70", "0", " 62", "7",
      "  0", "LAYER", "  2", "HIDDEN", " 70", "1", " 62", "-7",
      "  0", "ENDTAB",
      "  0", "ENDSEC",
      "  0", "SECTION", "  2", "ENTITIES",
      "  0", "LINE", "  8", "WALL", " 10", "0", " 20", "0", " 11", "1", " 21", "0",
      "  0", "ENDSEC", "  0", "EOF",
    ].join("\n");
    const layers = parseDxfLayers(text);
    expect(layers).toEqual([
      { name: "0", on: true, frozen: false },
      { name: "WALL", on: true, frozen: false },
      { name: "HIDDEN", on: false, frozen: true },
    ]);
  });

  it("omits a hidden layer from extract, and restores it from the full source", () => {
    const source: DxfEntity[] = [
      { type: "line", layer: "WALL", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] },
      { type: "line", layer: "FIXTURE", points: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
    ];
    expect(officialCadLayerNames(source)).toEqual(["WALL", "FIXTURE"]);
    const visible = officialExtractVisibleCadEntities(source, ["FIXTURE"]);
    expect(visible).toEqual([source[0]]);
    const restored = officialExtractVisibleCadEntities(source, []);
    expect(restored).toEqual(source);
  });

  it("preserves a non-0 child layer on INSERT explode, and inherits the INSERT layer for layer 0", () => {
    expect(officialInsertExplodedLayer("DOOR", "FURNITURE")).toBe("DOOR");
    expect(officialInsertExplodedLayer("0", "FURNITURE")).toBe("FURNITURE");
    expect(officialInsertExplodedLayer(undefined, "FURNITURE")).toBe("FURNITURE");

    const text = [
      "  0", "SECTION", "  2", "BLOCKS",
      "  0", "BLOCK", "  2", "LAMP", " 10", "0", " 20", "0",
      "  0", "LINE", "  8", "0", " 10", "0", " 20", "0", " 11", "1", " 21", "0",
      "  0", "LINE", "  8", "LAMP_SYM", " 10", "0", " 20", "1", " 11", "1", " 21", "1",
      "  0", "ENDBLK",
      "  0", "ENDSEC",
      "  0", "SECTION", "  2", "ENTITIES",
      "  0", "INSERT", "  2", "LAMP", "  8", "LIGHTING", " 10", "10", " 20", "20",
      "  0", "ENDSEC", "  0", "EOF",
    ].join("\n");
    const entities = parseDxfEntities(text);
    expect(entities).toHaveLength(2);
    const inherited = entities.find((e) => e.points[0]?.y === 20);
    const kept = entities.find((e) => e.points[0]?.y === 21);
    expect(inherited?.layer).toBe("LIGHTING");
    expect(kept?.layer).toBe("LAMP_SYM");
  });
});

describe("official CAD compress", () => {
  it("uses a 1.5 mm official tolerance", () => {
    expect(OFFICIAL_CAD_COMPRESS_TOL_M).toBe(0.0015);
  });

  it("shrinks a dense fixture-like grid with duplicate segments", () => {
    const entities: DxfEntity[] = [];
    for (let i = 0; i <= 10; i++) {
      const x = i * 0.6;
      entities.push({
        type: "line",
        layer: "GRID",
        points: [{ x, y: 0 }, { x, y: 6 }],
      });
      entities.push({
        type: "line",
        layer: "GRID",
        points: [{ x, y: 6 }, { x, y: 0 }],
      });
    }
    for (let j = 0; j <= 10; j++) {
      const y = j * 0.6;
      entities.push({
        type: "line",
        layer: "GRID",
        points: [{ x: 0, y }, { x: 6, y }],
      });
    }
    entities.push({
      type: "polyline",
      layer: "FIXTURE",
      points: [
        { x: 1, y: 1 },
        { x: 1.0004, y: 1.0004 },
        { x: 1.4, y: 1.4 },
        { x: 1.4005, y: 1.4005 },
        { x: 1.8, y: 1.8 },
      ],
    });
    const compressed = officialCompressCadEntities(entities);
    expect(compressed.length).toBeLessThan(entities.length);
    expect(officialCadEntityPointCount(compressed)).toBeLessThan(
      officialCadEntityPointCount(entities)
    );
  });

  it("keeps a simple closed rectangle geometrically faithful", () => {
    const rect: DxfEntity = {
      type: "polyline",
      closed: true,
      layer: "WALL",
      points: rectPolygon(0, 0, 8, 5),
    };
    const compressed = officialCompressCadEntities([rect]);
    expect(compressed).toHaveLength(1);
    expect(compressed[0]?.closed).toBe(true);
    expect(compressed[0]?.points).toHaveLength(4);
    expect(compressed[0]?.points[0]).toEqual({ x: 0, y: 0 });
    expect(compressed[0]?.points[2]).toEqual({ x: 8, y: 5 });
  });
});
