import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  officialBackfillCadLayerMetaFromDxf,
  officialCadLayerMetaIncomplete,
} from "@luxsim/project-io";
import {
  OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND,
  OfficialCadLayerBackfillError,
  officialBackfillStoredCadLayerMeta,
} from "./official-cad-layer-backfill";

function readSrc(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

const MULTI_LAYER_DXF = [
  "  0", "SECTION", "  2", "TABLES",
  "  0", "TABLE", "  2", "LAYER",
  "  0", "LAYER", "  2", "0", " 70", "0", " 62", "7",
  "  0", "LAYER", "  2", "WALL", " 70", "0", " 62", "7",
  "  0", "LAYER", "  2", "FIXTURE", " 70", "0", " 62", "7",
  "  0", "ENDTAB", "  0", "ENDSEC",
  "  0", "SECTION", "  2", "ENTITIES",
  "  0", "LINE", "  8", "WALL", " 10", "0", " 20", "0", " 11", "4", " 21", "0",
  "  0", "LINE", "  8", "FIXTURE", " 10", "1", " 20", "1", " 11", "1", " 21", "2",
  "  0", "ENDSEC", "  0", "EOF",
].join("\n");

describe("official stored CAD layer backfill", () => {
  it("fills layers from a stored multi-layer DXF and leaves complete meta unchanged", async () => {
    const incomplete = JSON.stringify({
      entities: [{ type: "line", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] }],
    });
    const filled = await officialBackfillStoredCadLayerMeta({
      kind: "dxf",
      data: Buffer.from(MULTI_LAYER_DXF, "utf8"),
      metaJson: incomplete,
    });
    expect(filled.changed).toBe(true);
    expect(officialCadLayerMetaIncomplete(filled.meta)).toBe(false);
    expect((filled.meta.layers as { name: string }[]).map((layer) => layer.name)).toEqual([
      "0",
      "WALL",
      "FIXTURE",
    ]);

    const again = await officialBackfillStoredCadLayerMeta({
      kind: "dxf",
      data: Buffer.from("not a dxf"),
      metaJson: JSON.stringify(filled.meta),
    });
    expect(again.changed).toBe(false);
    expect(again.meta).toEqual(filled.meta);
  });

  it("refuses image, PDF, and IFC plans", async () => {
    await expect(
      officialBackfillStoredCadLayerMeta({
        kind: "pdf",
        data: Buffer.from("x"),
        metaJson: "{}",
      })
    ).rejects.toBeInstanceOf(OfficialCadLayerBackfillError);
    await expect(
      officialBackfillStoredCadLayerMeta({
        kind: "image",
        data: Buffer.from("x"),
        metaJson: "{}",
      })
    ).rejects.toThrow(OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND);
  });

  it("is wired through a POST route that does not replace the stored file", () => {
    const route = readSrc("src/app/api/projects/[id]/assets/[assetId]/cad-layers/route.ts");
    expect(route).toContain("officialBackfillStoredCadLayerMeta");
    expect(route).toContain('kind !== "dxf" && kind !== "dwg"');
    expect(route).toContain("prisma.projectAsset.update");
    expect(route).toContain("metaJson");
    expect(route).not.toMatch(/saveBinaryFile|saveTextFile|unlink/);
    expect(route).toContain("if (!loaded.changed)");
    // Keep the import-route helpers mentioned so DWG and DXF stay consistent.
    const helper = readSrc("src/lib/official-cad-layer-backfill.ts");
    expect(helper).toContain("officialParseDwgPlan");
    expect(helper).toContain("officialBackfillCadLayerMetaFromDxf");
    expect(helper).toContain("parseDxfTextLabels");
    expect(typeof officialBackfillCadLayerMetaFromDxf).toBe("function");
  });
});
