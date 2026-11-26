import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseDxfEntities } from "@luxsim/project-io";
import {
  convertDwgToDxfText,
  DwgConversionError,
  officialParseDwgPlan,
} from "./official-dwg-convert";

const KAM_TIN_DWG =
  "/workspace/luxsim-parity/kam-tin-studio5-2026-11-17/source/Studio5-7F-MTR-Kam-Tin-Office.dwg";

function readSrc(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("official DWG conversion wiring", () => {
  it("is wired through the assets route and is not marked unsupported", () => {
    const route = readSrc("src/app/api/projects/[id]/assets/route.ts");
    expect(route).toContain("officialParseDwgPlan");
    expect(route).toContain("DwgConversionError");
    expect(route).toContain("meta.entities = parsed.entities");
    expect(route).toContain("meta.bounds = parsed.bounds");
    expect(route).toMatch(/kind === "dwg"/);
    expect(route).not.toMatch(/conversion = "unsupported"/);
    expect(route).not.toMatch(/conversion is not available in this build/);
    expect(route).toMatch(/status: 400/);
    const converter = readSrc("src/lib/official-dwg-convert.ts");
    expect(converter).toContain("@mlightcad/libredwg-web");
    expect(converter).toContain("convertDwgToDxfText");
    expect(converter).toContain("parseDxfEntities");
  });

  it("rejects an empty or clearly invalid DWG instead of inventing linework", async () => {
    await expect(convertDwgToDxfText(Buffer.alloc(0))).rejects.toBeInstanceOf(
      DwgConversionError
    );
    await expect(officialParseDwgPlan(Buffer.from("not-a-dwg"))).rejects.toBeInstanceOf(
      DwgConversionError
    );
    await expect(officialParseDwgPlan(Buffer.from("not-a-dwg"))).rejects.toThrow(
      /could not convert this DWG to a plan/i
    );
  });
});

describe("official DWG conversion of the Kam Tin sample", () => {
  const live = existsSync(KAM_TIN_DWG) ? it : it.skip;

  live("converts the sample DWG into a non-empty official entity list", async () => {
    const buf = readFileSync(KAM_TIN_DWG);
    const parsed = await officialParseDwgPlan(buf);
    expect(parsed.dxfText).toMatch(/SECTION/);
    expect(parsed.entities.length).toBeGreaterThan(0);
    // INSERT explode produces more linework than the pre-explode count (2488).
    expect(parsed.entities.length).toBeGreaterThan(2488);
    expect(parseDxfEntities(parsed.dxfText)).toHaveLength(parsed.entities.length);
    expect(parsed.bounds.maxX).toBeGreaterThan(parsed.bounds.minX);
    expect(parsed.bounds.maxY).toBeGreaterThan(parsed.bounds.minY);
    expect(parsed.metersPerUnit).toBeGreaterThan(0);
    expect([1, 0.001, 0.01, 0.0254, 0.3048]).toContain(parsed.metersPerUnit);
    expect(parsed.layers.length).toBeGreaterThan(1);
  }, 60_000);
});
