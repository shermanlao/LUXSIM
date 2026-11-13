/**
 * Analytical direct illuminance checks (CIE 171-style harness, formula-derived goldens only).
 *
 * Formula: E = I(θ,φ) cos(i) / r²  (lux), with cos(i) = dot(n, direction to source).
 */
import { describe, expect, it } from "vitest";
import type { PhotometricData } from "../../../photometry/src/types";
import { directIlluminance } from "../direct";

function nadirOnlyPhoto(cd: number): PhotometricData {
  return {
    format: "ies",
    manufacturer: "TEST",
    catalogNumber: "NADIR",
    description: "Synthetic nadir beam",
    luminousFlux: cd * Math.PI,
    watts: null,
    lampCount: 1,
    ballastFactor: 1,
    verticalAngles: [0, 90],
    horizontalAngles: [0],
    intensities: [[cd], [0]],
    symmetry: "axial",
  };
}

describe("CIE171 analytical direct cases", () => {
  it("direct-inverse-square: E = I / r² at nadir point", () => {
    const I = 1000;
    const r = 2;
    const photo = nadirOnlyPhoto(I);
    const lum = {
      id: "1",
      name: "T",
      position: { x: 0, y: 0, z: r },
      rotationDeg: 0,
      photometry: photo,
      watts: null,
    };
    const point = { x: 0, y: 0, z: 0 };
    const normal = { x: 0, y: 0, z: 1 };
    const E = directIlluminance(point, normal, lum);
    expect(E).toBeCloseTo(I / (r * r), 3);
  });

  it("direct-offset: lux drops vs nadir point", () => {
    const I = 800;
    const h = 3;
    const dx = 1;
    const photo = nadirOnlyPhoto(I);
    const lum = {
      id: "1",
      name: "T",
      position: { x: 0, y: 0, z: h },
      rotationDeg: 0,
      photometry: photo,
      watts: null,
    };
    const center = { x: 0, y: 0, z: 0 };
    const offset = { x: dx, y: 0, z: 0 };
    const normal = { x: 0, y: 0, z: 1 };
    const e0 = directIlluminance(center, normal, lum);
    const e1 = directIlluminance(offset, normal, lum);
    expect(e0).toBeCloseTo(I / (h * h), 2);
    expect(e1).toBeLessThan(e0);
    expect(e1).toBeGreaterThan(0);
  });
});
