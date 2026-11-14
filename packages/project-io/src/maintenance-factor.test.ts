import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { evaluateEn12464 } from "./en12464";
import type { CalcResults } from "../../solver/src/types";
import {
  DEFAULT_MF_BREAKDOWN,
  applyMfComponentEdit,
  applyOverallMaintenanceFactor,
  clampMf,
  presentMfBreakdown,
  productMf,
  resolveMaintenanceFactor,
} from "./maintenance-factor";

const defaultProduct = productMf(DEFAULT_MF_BREAKDOWN);

const emptyTask: CalcResults = {
  version: 1,
  grid: {
    originX: 0,
    originY: 0,
    spacing: 0.5,
    nx: 1,
    ny: 1,
    z: 0.75,
    lux: [200],
  },
  summary: {
    eave: 200,
    emin: 180,
    emax: 220,
    uo: 0.9,
    ugr: 18,
    lpd: 5,
    totalWatts: 10,
    areaM2: 4,
  },
  meta: {
    interreflection: false,
    bounces: 0,
    calculatedAt: "2026-01-01T00:00:00.000Z",
    disclaimer: "test",
  },
};

describe("maintenance-factor CIE 97 style", () => {
  it("default components multiply to ~0.80", () => {
    expect(defaultProduct).toBeGreaterThan(0.78);
    expect(defaultProduct).toBeLessThan(0.83);
  });

  it("clamps product below 0.5 up to 0.5", () => {
    expect(clampMf(0.2)).toBe(0.5);
    expect(clampMf(1.2)).toBe(1);
  });

  it("resolve prefers breakdown when components set", () => {
    const r = resolveMaintenanceFactor({
      maintenanceFactor: 0.9,
      mfBreakdown: { llmf: 0.8, lsf: 1, lmf: 1, rsmf: 1 },
    });
    expect(r.source).toBe("breakdown");
    expect(r.mf).toBe(0.8);
    expect(r.breakdown).toEqual({ llmf: 0.8, lsf: 1, lmf: 1, rsmf: 1 });
  });

  it("resolve uses overall when no breakdown and does not present default components as active", () => {
    const r = resolveMaintenanceFactor({ maintenanceFactor: 0.75 });
    expect(r.source).toBe("overall");
    expect(r.mf).toBe(0.75);
    expect(r.breakdown).toBeUndefined();
    expect(presentMfBreakdown({ maintenanceFactor: 0.75 })).toBeUndefined();
  });
});

describe("overall MF does not keep default CIE 97 components as the active breakdown", () => {
  it("clears presented components after the official overall-MF write, while calculation uses overall", () => {
    const before = {
      gridSpacing: 0.5,
      maintenanceFactor: defaultProduct,
      mfBreakdown: { ...DEFAULT_MF_BREAKDOWN },
    };
    const after = applyOverallMaintenanceFactor(before, 0.7);

    expect(after.maintenanceFactor).toBe(0.7);
    expect(after.mfBreakdown).toBeUndefined();
    expect(after.gridSpacing).toBe(0.5);

    const resolved = resolveMaintenanceFactor(after);
    expect(resolved.source).toBe("overall");
    expect(resolved.mf).toBe(0.7);
    expect(resolved.breakdown).toBeUndefined();
    expect(presentMfBreakdown(after)).toBeUndefined();
    expect(presentMfBreakdown(after)).not.toEqual(DEFAULT_MF_BREAKDOWN);
    expect(resolved.mf).not.toBeCloseTo(defaultProduct, 3);
  });

  it("does not invent component values so their product matches the overall MF", () => {
    const after = applyOverallMaintenanceFactor(
      { maintenanceFactor: defaultProduct, mfBreakdown: { ...DEFAULT_MF_BREAKDOWN } },
      0.8
    );
    const presented = presentMfBreakdown(after);
    expect(presented).toBeUndefined();
    if (presented) {
      expect(productMf(presented)).not.toBeCloseTo(0.8, 5);
    }
    expect(resolveMaintenanceFactor(after).mf).toBe(0.8);
  });

  it("rooms stored with overall 0.80 and no breakdown do not show the ~0.796 default components", () => {
    const roomCalc = { maintenanceFactor: 0.8 };
    const resolved = resolveMaintenanceFactor(roomCalc);
    expect(resolved.source).toBe("overall");
    expect(resolved.mf).toBe(0.8);
    expect(presentMfBreakdown(roomCalc)).toBeUndefined();
    expect(defaultProduct).toBeCloseTo(0.796, 2);
    expect(resolved.mf).not.toBeCloseTo(defaultProduct, 3);
  });

  it("editing a component after overall MF rebuilds the breakdown from components", () => {
    const overall = applyOverallMaintenanceFactor(
      { maintenanceFactor: defaultProduct, mfBreakdown: { ...DEFAULT_MF_BREAKDOWN } },
      0.7
    );
    const edited = applyMfComponentEdit(overall, "llmf", 0.85);

    const resolved = resolveMaintenanceFactor(edited);
    expect(resolved.source).toBe("breakdown");
    expect(edited.mfBreakdown).toEqual({
      llmf: 0.85,
      lsf: DEFAULT_MF_BREAKDOWN.lsf,
      lmf: DEFAULT_MF_BREAKDOWN.lmf,
      rsmf: DEFAULT_MF_BREAKDOWN.rsmf,
    });
    expect(presentMfBreakdown(edited)).toEqual(edited.mfBreakdown);
    expect(resolved.mf).toBe(productMf(edited.mfBreakdown!));
    expect(resolved.mf).not.toBe(0.7);
  });

  it("still presents the default components when no overall MF has been set", () => {
    const resolved = resolveMaintenanceFactor({});
    expect(resolved.source).toBe("default");
    expect(resolved.breakdown).toEqual(DEFAULT_MF_BREAKDOWN);
    expect(presentMfBreakdown({})).toEqual(DEFAULT_MF_BREAKDOWN);
    expect(resolved.mf).toBe(defaultProduct);
  });

  it("EN assist and the property panel official path do not attach default components when overall MF is used", () => {
    const calc = applyOverallMaintenanceFactor(
      { maintenanceFactor: 0.8, mfBreakdown: { ...DEFAULT_MF_BREAKDOWN } },
      0.7
    );
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: calc.maintenanceFactor,
      mfBreakdown: calc.mfBreakdown,
      taskResults: emptyTask,
    })!;
    expect(check.maintenanceFactor).toBe(0.7);
    expect(check.maintainedEave).toBeCloseTo(200 * 0.7, 10);
    expect(check.mfBreakdown).toBeUndefined();

    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain("presentMfBreakdown");
    expect(src).toContain("applyOverallMaintenanceFactor");
    expect(src).toContain("applyMfComponentEdit");
    expect(src).toContain("CIE 97 breakdown not active");
    expect(src).not.toMatch(
      /const bd = normalizeMfBreakdown\(activeRoom\.calc\.mfBreakdown\)/
    );
  });
});
