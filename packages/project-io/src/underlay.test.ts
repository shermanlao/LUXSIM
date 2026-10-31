import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_SPAN_M,
  initialMetersPerPixel,
  legacyScaleToMetersPerPixel,
  underlayWorldSize,
} from "./underlay";

describe("underlay aspect helpers", () => {
  it("keeps world size proportional to source pixels", () => {
    const mpu = initialMetersPerPixel(2000, 1000);
    expect(mpu).toBeCloseTo(DEFAULT_PLAN_SPAN_M / 2000);
    const size = underlayWorldSize({
      sourceWidthPx: 2000,
      sourceHeightPx: 1000,
      metersPerUnit: mpu,
    });
    expect(size).not.toBeNull();
    expect(size!.widthM / size!.heightM).toBeCloseTo(2);
    expect(Math.max(size!.widthM, size!.heightM)).toBeCloseTo(DEFAULT_PLAN_SPAN_M);
  });

  it("migrates legacy scale without changing intended width", () => {
    const widthPx = 1600;
    const legacy = 1.5;
    const mpu = legacyScaleToMetersPerPixel(legacy, widthPx);
    expect(widthPx * mpu).toBeCloseTo(DEFAULT_PLAN_SPAN_M * legacy);
  });
});
