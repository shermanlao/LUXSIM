import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  parseIes,
  sampleIntensityCd,
  estimateFlux,
  luminaireBody,
  formatDimensions,
  resolvedFlux,
} from "./index";

const fixture = readFileSync(
  path.join(process.cwd(), "fixtures/sample-downlight.ies"),
  "utf8"
);

describe("parseIes", () => {
  it("parses sample downlight", () => {
    const { data } = parseIes(fixture);
    expect(data.format).toBe("ies");
    expect(data.verticalAngles).toHaveLength(5);
    expect(data.horizontalAngles).toHaveLength(1);
    expect(data.intensities[0]?.[0]).toBe(1200);
    expect(data.luminousFlux).toBe(2000);
    expect(data.watts).toBe(30);
  });

  it("treats negative IES lamp lumens as absolute photometry", () => {
    const hacked = fixture.replace("2000", "-1");
    const { data } = parseIes(hacked);
    expect(data.luminousFlux).toBeNull();
    expect(resolvedFlux(data)).toBeGreaterThan(100);
  });

  it("samples nadir intensity", () => {
    const { data } = parseIes(fixture);
    const cd = sampleIntensityCd(data, 0, 0);
    expect(cd).toBeGreaterThan(1000);
  });
});

function loadIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

const vtacPath = path.join(
  process.cwd(),
  "storage/luminaires/35eca5d2-1b69-4f5d-9767-1806191a228e-VTAC-20053.IES"
);
const silversunPath = path.join(
  process.cwd(),
  "storage/luminaires/1c53bc75-2907-4571-980e-8c68d2f1151d-DLIS18CC8.IES"
);
// Tests may run from packages/photometry — also try repo root.
const roots = [process.cwd(), path.join(process.cwd(), "../..")];

describe("project IES files", () => {
  function find(name: string): string | null {
    for (const root of roots) {
      const dir = path.join(root, "storage/luminaires");
      if (!existsSync(dir)) continue;
      const { readdirSync } = require("fs");
      for (const f of readdirSync(dir)) {
        if (f.toLowerCase().includes(name.toLowerCase())) {
          return readFileSync(path.join(dir, f), "utf8");
        }
      }
    }
    return null;
  }

  it("reads V-TAC 20053 as a 55 mm circular downlight with catalog CCT", () => {
    const text = find("VTAC-20053");
    if (!text) return;
    const { data } = parseIes(text);
    expect(data.openingWidthM).toBeCloseTo(-0.055, 4);
    expect(data.openingLengthM).toBeCloseTo(-0.055, 4);
    expect(data.cctK).toBe(6400);
    expect(data.catalogFluxLm).toBe(800);
    const body = luminaireBody(data);
    expect(body.isCircular).toBe(true);
    expect(body.diameterM).toBeCloseTo(0.055, 4);
    expect(body.housing).toBe("black");
    expect(formatDimensions(body)).toBe("Ø 55 mm");
    const flux = estimateFlux(data);
    expect(flux).toBeGreaterThan(500);
    expect(flux).toBeLessThan(1200);
  });

  it("reads SILVERSUN DLIS18CC8 as a 244 mm circular downlight", () => {
    const text = find("DLIS18CC8");
    if (!text) return;
    const { data } = parseIes(text);
    expect(Math.abs(data.openingWidthM ?? 0)).toBeCloseTo(0.244, 3);
    expect(Math.abs(data.openingHeightM ?? 0)).toBeCloseTo(0.038, 3);
    const body = luminaireBody(data);
    expect(body.isCircular).toBe(true);
    expect(formatDimensions(body)).toBe("Ø 244 × 38 mm");
    const flux = estimateFlux(data);
    expect(flux).toBeGreaterThan(200);
  });
});
