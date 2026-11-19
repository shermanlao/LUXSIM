import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { formatLpd, formatLpdPer100Lx, resultsStripLpdMetric } from "./report-model";

const RECIPE_B_LPD = 3.0;
const RECIPE_B_EAVE = 186.1138;
const RECIPE_B_MF = 0.8;

// Method 8 calc-all results (2026-11-13 log / calc-all-results.json). Display
// rounding is 27.00 / 1368, 11.49 / 417, 5.67 / 375; the official helper uses
// the unrounded LPD and initial Ēm, which is how the log got 1.97 / 2.75 / 1.51.
const METHOD8 = {
  room1: { lpd: 27, eave: 1367.9951260908415, maintainedEave: 1367.9951260908415 * 0.8 },
  room2: { lpd: 11.486222799069216, eave: 417.4973201813383, maintainedEave: 417.4973201813383 * 0.8 },
  room3: { lpd: 5.673288876727437, eave: 374.7324043765408, maintainedEave: 374.7324043765408 * 0.8 },
};

describe("formatLpdPer100Lx", () => {
  it("formats recipe B as 1.61 W/m²/100 lx from LPD 3.0 and initial Ēm 186.1138", () => {
    expect(formatLpdPer100Lx(RECIPE_B_LPD, RECIPE_B_EAVE)).toBe("1.61 W/m²/100 lx");
  });

  it("matches the Method 8 official-report figures using unrounded LPD and initial Ēm", () => {
    expect(formatLpdPer100Lx(METHOD8.room1.lpd, METHOD8.room1.eave)).toBe("1.97 W/m²/100 lx");
    expect(formatLpdPer100Lx(METHOD8.room2.lpd, METHOD8.room2.eave)).toBe("2.75 W/m²/100 lx");
    expect(formatLpdPer100Lx(METHOD8.room3.lpd, METHOD8.room3.eave)).toBe("1.51 W/m²/100 lx");
  });

  it("does not use maintained Ēm in the denominator", () => {
    const official = formatLpdPer100Lx(RECIPE_B_LPD, RECIPE_B_EAVE);
    const wronglyMaintained = formatLpdPer100Lx(RECIPE_B_LPD, RECIPE_B_EAVE * RECIPE_B_MF);
    expect(official).toBe("1.61 W/m²/100 lx");
    expect(wronglyMaintained).not.toBe(official);
    expect(wronglyMaintained).not.toBe("1.61 W/m²/100 lx");

    expect(formatLpdPer100Lx(METHOD8.room1.lpd, METHOD8.room1.maintainedEave)).not.toBe("1.97 W/m²/100 lx");
    expect(formatLpdPer100Lx(METHOD8.room2.lpd, METHOD8.room2.maintainedEave)).not.toBe("2.75 W/m²/100 lx");
    expect(formatLpdPer100Lx(METHOD8.room3.lpd, METHOD8.room3.maintainedEave)).not.toBe("1.51 W/m²/100 lx");
  });

  it("returns an em dash when LPD is missing or Ēm is zero / unusable", () => {
    expect(formatLpdPer100Lx(null, RECIPE_B_EAVE)).toBe("—");
    expect(formatLpdPer100Lx(RECIPE_B_LPD, 0)).toBe("—");
    expect(formatLpdPer100Lx(RECIPE_B_LPD, 1e-7)).toBe("—");
  });
});

describe("resultsStripLpdMetric", () => {
  it("keeps the W/m² figure and adds the official per-100-lx sub for recipe B", () => {
    expect(resultsStripLpdMetric(RECIPE_B_LPD, RECIPE_B_EAVE)).toEqual({
      value: "3.00 W/m²",
      per100Lx: "1.61 W/m²/100 lx",
    });
    expect(formatLpd(RECIPE_B_LPD)).toBe("3.00 W/m²");
  });

  it("matches Method 8 room figures with the same rounding as formatLpdPer100Lx", () => {
    expect(resultsStripLpdMetric(METHOD8.room1.lpd, METHOD8.room1.eave)).toEqual({
      value: "27.00 W/m²",
      per100Lx: "1.97 W/m²/100 lx",
    });
    expect(resultsStripLpdMetric(METHOD8.room2.lpd, METHOD8.room2.eave)).toEqual({
      value: "11.49 W/m²",
      per100Lx: "2.75 W/m²/100 lx",
    });
    expect(resultsStripLpdMetric(METHOD8.room3.lpd, METHOD8.room3.eave)).toEqual({
      value: "5.67 W/m²",
      per100Lx: "1.51 W/m²/100 lx",
    });
  });

  it("uses initial Ēm, not maintained Ēm, for the strip sub-line", () => {
    const official = resultsStripLpdMetric(RECIPE_B_LPD, RECIPE_B_EAVE);
    const ifMaintainedWereUsed = resultsStripLpdMetric(RECIPE_B_LPD, RECIPE_B_EAVE * RECIPE_B_MF);
    expect(official.per100Lx).toBe("1.61 W/m²/100 lx");
    expect(ifMaintainedWereUsed.per100Lx).not.toBe("1.61 W/m²/100 lx");
  });

  it("does not invent a per-100-lx number when LPD or Ēm is missing, zero, or not yet calculated", () => {
    expect(resultsStripLpdMetric(null, RECIPE_B_EAVE)).toEqual({ value: "—" });
    expect(resultsStripLpdMetric(undefined, RECIPE_B_EAVE)).toEqual({ value: "—" });
    expect(resultsStripLpdMetric(RECIPE_B_LPD, 0)).toEqual({ value: "3.00 W/m²" });
    expect(resultsStripLpdMetric(RECIPE_B_LPD, undefined)).toEqual({ value: "3.00 W/m²" });
    expect(resultsStripLpdMetric(RECIPE_B_LPD, null)).toEqual({ value: "3.00 W/m²" });
    expect(resultsStripLpdMetric(undefined, undefined)).toEqual({ value: "—" });
    expect(resultsStripLpdMetric(0, 0)).toEqual({ value: "0.00 W/m²" });
  });

  it("applies the same official expression to a storey aggregate that already has LPD", () => {
    // From storey-results.test.ts: 80 m² at 5 W/m² / 500 lx + 20 m² at 4 W/m² / 300 lx
    // → LPD 4.8 W/m², area-weighted initial Ēm 460 lx. Maintained Ēm in that fixture is 356.
    const storey = resultsStripLpdMetric(4.8, 460);
    expect(storey).toEqual({
      value: "4.80 W/m²",
      per100Lx: "1.04 W/m²/100 lx",
    });
    expect(resultsStripLpdMetric(4.8, 356).per100Lx).not.toBe("1.04 W/m²/100 lx");
  });
});

describe("EditorResultsStrip wiring", () => {
  it("reuses resultsStripLpdMetric / formatLpdPer100Lx and does not invent a second formula", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../../src/components/editor/EditorResultsStrip.tsx"),
      "utf8"
    );
    expect(src).toContain('import { clampMf, resultsStripLpdMetric, type En12464Check } from "@luxsim/project-io";');
    expect(src).toContain("const lpdMetric = resultsStripLpdMetric(s?.lpd, s?.eave);");
    expect(src).toMatch(/sub=\{lpdMetric\.per100Lx\}/);
    const lpdBlock = src.slice(src.indexOf('label="LPD"'), src.indexOf("{en12464Check"));
    expect(lpdBlock).toContain("lpdMetric.value");
    expect(lpdBlock).toContain("lpdMetric.per100Lx");
    expect(lpdBlock).not.toMatch(/maintainedAverageLux|eave\s*\*\s*mf|eave\s*\*\s*maintenanceFactor/);
    expect(src).not.toMatch(/lpd\s*\/\s*\(\s*(s\.)?eave/);
  });
});
