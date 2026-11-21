import { describe, expect, it } from "vitest";
import {
  officialCachedPlanTextLabels,
  officialLoadPlanTextLabels,
  officialParseMetaJson,
  OfficialPlanTextError,
} from "./official-plan-text-labels";

const dxf = [
  "0",
  "SECTION",
  "2",
  "ENTITIES",
  "0",
  "TEXT",
  "8",
  "EL-LIGHTING",
  "10",
  "1000",
  "20",
  "2000",
  "1",
  "LT01",
  "0",
  "ENDSEC",
  "0",
  "EOF",
].join("\n");

describe("officialLoadPlanTextLabels", () => {
  it("parses TEXT from a DXF buffer when the cache is missing", async () => {
    const out = await officialLoadPlanTextLabels({
      kind: "dxf",
      data: Buffer.from(dxf, "utf8"),
      metaJson: "{}",
    });
    expect(out.cached).toBe(false);
    expect(out.labels).toEqual([
      {
        text: "LT01",
        x: 1000,
        y: 2000,
        rotationDeg: 0,
        layer: "EL-LIGHTING",
        kind: "TEXT",
      },
    ]);
  });

  it("returns a valid cached list without re-parsing", async () => {
    const cached = [
      { text: "CACHED", x: 1, y: 2, rotationDeg: 0, kind: "TEXT" as const },
    ];
    const out = await officialLoadPlanTextLabels({
      kind: "dxf",
      data: Buffer.from("not a dxf"),
      metaJson: JSON.stringify({ textLabels: cached }),
    });
    expect(out.cached).toBe(true);
    expect(out.labels).toEqual(cached);
  });

  it("treats an empty cached list as already parsed", () => {
    expect(officialCachedPlanTextLabels({ textLabels: [] })).toEqual([]);
    expect(officialCachedPlanTextLabels(officialParseMetaJson("{}"))).toBeNull();
  });

  it("refuses a raster-only plan kind", async () => {
    await expect(
      officialLoadPlanTextLabels({
        kind: "pdf",
        data: Buffer.from("x"),
      })
    ).rejects.toBeInstanceOf(OfficialPlanTextError);
  });
});
