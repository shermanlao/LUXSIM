import { describe, expect, it } from "vitest";
import {
  OfficialCadLayerBackfillError,
  officialBackfillCadLayerMetaFromDxf,
} from "./official-cad-layer-backfill";
import { officialCadLayerMetaIncomplete } from "./official-dxf-layers";
import type { DxfEntity, OfficialDxfLayer } from "./types";

function dxfWithLayers(body: string, layerEntries: string): string {
  return [
    "  0", "SECTION", "  2", "TABLES",
    "  0", "TABLE", "  2", "LAYER",
    layerEntries,
    "  0", "ENDTAB",
    "  0", "ENDSEC",
    "  0", "SECTION", "  2", "ENTITIES",
    body,
    "  0", "ENDSEC",
    "  0", "EOF",
  ].join("\n");
}

const MULTI_LAYER_DXF = dxfWithLayers(
  [
    "  0", "LINE", "  8", "WALL", " 10", "0", " 20", "0", " 11", "4", " 21", "0",
    "  0", "LINE", "  8", "FIXTURE", " 10", "1", " 20", "1", " 11", "1", " 21", "2",
  ].join("\n"),
  [
    "  0", "LAYER", "  2", "0", " 70", "0", " 62", "7",
    "  0", "LAYER", "  2", "WALL", " 70", "0", " 62", "7",
    "  0", "LAYER", "  2", "FIXTURE", " 70", "0", " 62", "7",
  ].join("\n")
);

const LAYER_0_ONLY_DXF = dxfWithLayers(
  "  0\nLINE\n 10\n0\n 20\n0\n 11\n1\n 21\n0",
  "  0\nLAYER\n  2\n0\n 70\n0\n 62\n7"
);

describe("officialBackfillCadLayerMetaFromDxf", () => {
  it("fills WALL and FIXTURE layers from a multi-layer DXF onto incomplete meta", () => {
    const incomplete = {
      entities: [
        { type: "line", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] },
      ] as DxfEntity[],
    };
    expect(officialCadLayerMetaIncomplete(incomplete)).toBe(true);
    const filled = officialBackfillCadLayerMetaFromDxf(MULTI_LAYER_DXF, incomplete);
    expect(officialCadLayerMetaIncomplete(filled)).toBe(false);
    const layers = filled.layers as OfficialDxfLayer[];
    expect(layers.map((layer) => layer.name)).toEqual(["0", "WALL", "FIXTURE"]);
    const entities = filled.entities as DxfEntity[];
    expect(entities.map((entity) => entity.layer)).toEqual(["WALL", "FIXTURE"]);
    expect(filled.bounds).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 2 });
  });

  it("persists a layer-0 table so a later check does not loop", () => {
    const incomplete = { entities: [{ type: "line", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }] };
    const filled = officialBackfillCadLayerMetaFromDxf(LAYER_0_ONLY_DXF, incomplete);
    expect(officialCadLayerMetaIncomplete(filled)).toBe(false);
    expect((filled.layers as OfficialDxfLayer[]).map((layer) => layer.name)).toEqual(["0"]);
    const again = officialBackfillCadLayerMetaFromDxf("not a dxf", filled);
    expect(again).toBe(filled);
  });

  it("leaves complete meta and its entities unchanged", () => {
    const entity: DxfEntity = {
      type: "line",
      layer: "WALL",
      points: [{ x: 9, y: 9 }, { x: 10, y: 9 }],
    };
    const complete = {
      layers: [{ name: "WALL", on: true, frozen: false }],
      entities: [entity],
    };
    const out = officialBackfillCadLayerMetaFromDxf(MULTI_LAYER_DXF, complete);
    expect(out).toBe(complete);
    expect(out.entities).toBe(complete.entities);
  });

  it("refuses an unreadable DXF instead of clearing existing linework", () => {
    const existing = {
      entities: [{ type: "line", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    };
    expect(() => officialBackfillCadLayerMetaFromDxf("not a dxf", existing)).toThrow(
      OfficialCadLayerBackfillError
    );
  });
});
