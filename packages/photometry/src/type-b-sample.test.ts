import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  isTypeBPhotometryTable,
  parseIes,
  polarPlane,
  sampleIntensityCd,
  sampleIntensityTable,
  typeCToTypeBAngles,
  type PhotometricData,
} from "./index";

function typeBSymmetricCone(peakCd = 1000, halfDeg = 30): PhotometricData {
  const angles: number[] = [];
  for (let a = -90; a <= 90; a += 5) angles.push(a);
  const sigma = halfDeg / Math.sqrt(2 * Math.log(2));
  const intensity = (vDeg: number, hDeg: number): number => {
    if (Math.abs(vDeg) >= 90 - 1e-6 || Math.abs(hDeg) >= 90 - 1e-6) return 0;
    const thetaDeg =
      (Math.atan(
        Math.hypot(Math.tan((hDeg * Math.PI) / 180), Math.tan((vDeg * Math.PI) / 180))
      ) *
        180) /
      Math.PI;
    return peakCd * Math.exp(-0.5 * (thetaDeg / sigma) ** 2);
  };
  return {
    format: "ies",
    manufacturer: "Test",
    catalogNumber: "TYPE-B-SYM",
    description: "Synthesized axially symmetric Type B downlight",
    luminousFlux: 2000,
    watts: 30,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles: angles,
    horizontalAngles: angles,
    intensities: angles.map((h) => angles.map((v) => intensity(v, h))),
    symmetry: "none",
    photometryType: 2,
    openingWidthM: -0.2,
    openingLengthM: -0.2,
    openingHeightM: 0.04,
  };
}

describe("Type B angle conversion", () => {
  it("maps a downward Type C nadir to Type B (0, 0)", () => {
    const origin = typeCToTypeBAngles(0, 0);
    expect(origin.verticalDeg).toBeCloseTo(0, 8);
    expect(origin.horizontalDeg).toBeCloseTo(0, 8);
  });

  it("maps C0 and C90 cuts onto the Type B horizontal and vertical axes", () => {
    const c0 = typeCToTypeBAngles(20, 0);
    expect(c0.horizontalDeg).toBeCloseTo(20, 8);
    expect(c0.verticalDeg).toBeCloseTo(0, 8);
    const c90 = typeCToTypeBAngles(20, 90);
    expect(c90.horizontalDeg).toBeCloseTo(0, 8);
    expect(c90.verticalDeg).toBeCloseTo(20, 8);
    const c180 = typeCToTypeBAngles(20, 180);
    expect(c180.horizontalDeg).toBeCloseTo(-20, 8);
    expect(c180.verticalDeg).toBeCloseTo(0, 8);
  });
});

describe("sampleIntensityCd Type B downward symmetry", () => {
  const photo = typeBSymmetricCone();

  it("detects a Type B intensity table", () => {
    expect(isTypeBPhotometryTable(photo)).toBe(true);
  });

  it("returns the same intensity at every azimuth for a given gamma", () => {
    const nadir = sampleIntensityCd(photo, 0, 0);
    const iC0 = sampleIntensityCd(photo, 20, 0);
    expect(nadir).toBeGreaterThan(900);
    for (const phi of [0, 45, 90, 135, 180, 270]) {
      const i20 = sampleIntensityCd(photo, 20, phi);
      expect(i20).toBeGreaterThan(nadir * 0.4);
      // Bilinear lookup in (v, h) is slightly off-axis at 45°/135°, so allow 1%.
      expect(Math.abs(i20 - iC0) / iC0).toBeLessThan(0.01);
    }
  });

  it("does not treat Type C (theta, phi) as native Type B (vertical, horizontal)", () => {
    // Native table at (v=20, h=90) is at 90° from the beam axis (dark).
    const rawDark = sampleIntensityTable(photo, 20, 90);
    const converted = sampleIntensityCd(photo, 20, 90);
    expect(rawDark).toBeLessThan(converted * 0.05);
    expect(converted).toBeCloseTo(sampleIntensityCd(photo, 20, 0), 6);
  });

  it("keeps polarPlane on the native Type B signed-gamma cut", () => {
    const plane = polarPlane(photo, 0, 37);
    const at20 = plane.find((p) => Math.abs(p.gamma - 20) < 1e-6);
    const atNeg20 = plane.find((p) => Math.abs(p.gamma + 20) < 1e-6);
    expect(at20?.cd).toBeGreaterThan(400);
    expect(atNeg20?.cd).toBeCloseTo(at20!.cd, 6);
  });
});

describe("Silversun DLIS18CC8 Type B file (read-only, if present)", () => {
  const candidates = [
    "/workspace/dialux-draft/ies/DLIS18CC8.IES",
    ...[
      "/workspace/luxsim-host/storage/luminaires",
      "/workspace/luxsim-l9m-transfer/storage/luminaires",
    ].flatMap((dir) => {
      try {
        const { readdirSync } = require("fs") as typeof import("fs");
        return readdirSync(dir)
          .filter((f) => f.toUpperCase().endsWith("-DLIS18CC8.IES") || f.toUpperCase() === "DLIS18CC8.IES")
          .map((f) => path.join(dir, f));
      } catch {
        return [] as string[];
      }
    }),
  ];
  const file = candidates.find((p) => existsSync(p));

  it("is a downward-symmetric Type B table; converted C-planes match around the beam axis", () => {
    if (!file) return;
    const { data, warnings } = parseIes(readFileSync(file, "utf8"));
    expect(data.photometryType).toBe(2);
    expect(isTypeBPhotometryTable(data)).toBe(true);
    expect(warnings.some((w) => /Type B/i.test(w))).toBe(true);
    const peak = sampleIntensityTable(data, 0, 0);
    expect(peak).toBeGreaterThan(500);
    const nativeC0 = sampleIntensityTable(data, 0, 20);
    const nativeC90 = sampleIntensityTable(data, 20, 0);
    // The file is essentially axial around the beam axis (within ~2%), not a
    // one-sided Type B table. C0 and C90 are not bit-identical.
    expect(Math.abs(nativeC0 - nativeC90) / peak).toBeLessThan(0.02);
    const iC0 = sampleIntensityCd(data, 20, 0);
    const iC90 = sampleIntensityCd(data, 20, 90);
    const iC180 = sampleIntensityCd(data, 20, 180);
    expect(iC0).toBeGreaterThan(peak * 0.8);
    expect(iC90).toBeGreaterThan(peak * 0.8);
    expect(iC180).toBeGreaterThan(peak * 0.8);
    expect(Math.abs(iC90 - iC0) / iC0).toBeLessThan(0.02);
    expect(Math.abs(iC180 - iC0) / iC0).toBeLessThan(0.02);
  });
});
