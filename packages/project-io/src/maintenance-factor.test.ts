import { describe, expect, it } from "vitest";
import {
  DEFAULT_MF_BREAKDOWN,
  clampMf,
  productMf,
  resolveMaintenanceFactor,
} from "./maintenance-factor";

describe("maintenance-factor CIE 97 style", () => {
  it("default components multiply to ~0.80", () => {
    const p = productMf(DEFAULT_MF_BREAKDOWN);
    expect(p).toBeGreaterThan(0.78);
    expect(p).toBeLessThan(0.83);
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
  });

  it("resolve uses overall when no breakdown", () => {
    const r = resolveMaintenanceFactor({ maintenanceFactor: 0.75 });
    expect(r.source).toBe("overall");
    expect(r.mf).toBe(0.75);
  });
});
