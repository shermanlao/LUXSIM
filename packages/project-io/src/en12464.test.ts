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
    lux: [650, 650, 650, 650],
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
  it("passes office task targets when maintained lux is sufficient", () => {
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: clampMf(0.8),
      taskResults: baseResults,
    })!;
    expect(check.checks.taskEm.pass).toBe(true);
    expect(check.maintainedEave).toBeCloseTo(650 * 0.8, 1);
    expect(check.overallPass).toBe(true);
  });

  it("evaluates surrounding when secondary results provided", () => {
    const surrounding: CalcResults = {
      ...baseResults,
      summary: { ...baseResults.summary, eave: 400, emin: 350 },
    };
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
      surroundingResults: surrounding,
    })!;
    expect(check.checks.surroundingEm.target).toBe(300);
    expect(check.checks.surroundingEm.pass).toBe(true);
  });

  it("honest null surrounding without secondary grid", () => {
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(check.checks.surroundingEm.pass).toBeNull();
    expect(check.checks.surroundingEm.note).toMatch(/Single workplane|Surrounding target/i);
  });
});
