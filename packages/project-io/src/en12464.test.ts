import { describe, expect, it } from "vitest";
import { evaluateEn12464, clampMf } from "./en12464";
import type { CalcResults } from "../../solver/src/types";

const baseResults: CalcResults = {
  version: 1,
  grid: {
    originX: 0,
    originY: 0,
    spacing: 0.5,
    nx: 2,
    ny: 2,
    z: 0.75,
    lux: [400, 420, 410, 430],
  },
  summary: {
    eave: 650,
    emin: 600,
    emax: 700,
    uo: 600 / 650,
    ugr: 18,
    lpd: 5,
    totalWatts: 30,
    areaM2: 6,
  },
  meta: {
    interreflection: true,
    bounces: 2,
    calculatedAt: "2026-01-01T00:00:00.000Z",
    disclaimer: "test",
  },
};

describe("evaluateEn12464", () => {
  it("passes office targets when maintained lux is sufficient", () => {
    const check = evaluateEn12464(baseResults, "office", clampMf(0.8))!;
    expect(check.checks.em.pass).toBe(true);
    expect(check.maintainedEave).toBeCloseTo(650 * 0.8, 1);
    expect(check.overallPass).toBe(true);
  });

  it("fails when maintained eave is below template", () => {
    const low: CalcResults = {
      ...baseResults,
      summary: { ...baseResults.summary, eave: 400, emin: 200, uo: 0.5 },
    };
    const check = evaluateEn12464(low, "office", 0.8)!;
    expect(check.checks.em.pass).toBe(false);
  });
});
