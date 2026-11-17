import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import {
  workplaneFalseColorRgb,
  sampleWorkplaneLuxBilinear,
  falseColorPngPixelSize,
  falseColorJpegPixelSize,
  FALSE_COLOR_PNG_MIN_SAMPLES,
  FALSE_COLOR_JPEG_MAX_EDGE,
  FALSE_COLOR_JPEG_QUALITY,
  gridToFalseColorJpegDataUrl,
} from "./false-color-snapshot";
import { rectPolygon } from "./geometry";
import type { CalcResults, RoomV2 } from "./types";
import {
  DIALUX_LUX_STOPS,
  legendStopsForRange,
  luxToRgb,
  rgbCss,
} from "./isolux-map";

function dist(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("workplaneFalseColorRgb", () => {
  it("uses the same absolute DIALux colours as the official report legend", () => {
    for (const stop of DIALUX_LUX_STOPS) {
      const [r, g, b] = workplaneFalseColorRgb(stop.lux);
      expect(Math.round(r * 255)).toBe(stop.r);
      expect(Math.round(g * 255)).toBe(stop.g);
      expect(Math.round(b * 255)).toBe(stop.b);
    }
    const legend = legendStopsForRange(80, 500);
    expect(legend.length).toBeGreaterThanOrEqual(2);
    for (const s of legend) {
      expect(s.color).toBe(rgbCss(workplaneFalseColorRgb(s.lux)));
    }
  });

  it("does not stretch a cell to the room maximum like a regional rainbow", () => {
    // If the map were normalized to this room's emax of 250 lx, 250 lx would
    // sit at the top of the ramp. The report legend uses absolute DIALux stops,
    // so 250 lx must stay near the 240 lx stop, not the 2500 lx end.
    const at250 = workplaneFalseColorRgb(250);
    const at240 = luxToRgb(240);
    const atEnd = luxToRgb(2500);
    expect(dist(at250, at240)).toBeLessThan(dist(at250, atEnd));
    expect(rgbCss(at250)).not.toBe(rgbCss(atEnd));
  });
});

describe("sampleWorkplaneLuxBilinear", () => {
  const grid = {
    originX: 0,
    originY: 0,
    spacing: 1,
    nx: 2,
    ny: 2,
    z: 0.75,
    lux: [100, 200, 300, 400],
  };

  it("returns a cell value at an integer index", () => {
    expect(sampleWorkplaneLuxBilinear(grid, 0, 0)).toBe(100);
    expect(sampleWorkplaneLuxBilinear(grid, 1, 0)).toBe(200);
  });

  it("blends neighbouring cells instead of jumping in blocks", () => {
    const mid = sampleWorkplaneLuxBilinear(grid, 0.5, 0);
    expect(mid).toBeCloseTo(150, 6);
    const mid2 = sampleWorkplaneLuxBilinear(grid, 0.5, 0.5);
    expect(mid2).toBeCloseTo(250, 6);
  });

  it("ignores empty neighbours so edges do not smear to zero", () => {
    const sparse = { ...grid, lux: [100, 0, 0, 0] };
    expect(sampleWorkplaneLuxBilinear(sparse, 0.25, 0)).toBeCloseTo(100, 6);
  });
});

describe("falseColorPngPixelSize", () => {
  it("uses more than one sample per cell so colour can be smooth", () => {
    const size = falseColorPngPixelSize(10, 8);
    expect(size.samples).toBeGreaterThanOrEqual(FALSE_COLOR_PNG_MIN_SAMPLES);
    expect(size.width).toBeGreaterThan(10 * 2);
  });

  it("caps the long edge so a large workplane stays within the official JPEG limit", () => {
    const size = falseColorJpegPixelSize(134, 134);
    expect(FALSE_COLOR_JPEG_MAX_EDGE).toBe(1100);
    expect(FALSE_COLOR_JPEG_QUALITY).toBe(0.75);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(FALSE_COLOR_JPEG_MAX_EDGE);
    expect(size.samples).toBeGreaterThanOrEqual(2);
  });
});

function largeOffice(): { room: RoomV2; results: CalcResults } {
  const nx = 80;
  const ny = 80;
  const lux = new Array(nx * ny);
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      lux[j * nx + i] = 80 + ((i + j) / (nx + ny)) * 900;
    }
  }
  const room: RoomV2 = {
    id: "r-big",
    storeyId: "s1",
    name: "OPEN OFFICE",
    polygon: rectPolygon(0, 0, 24, 24),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.3, interreflection: false, bounces: 0, computeUgr: false },
  };
  const results: CalcResults = {
    version: 1,
    summary: { eave: 400, emin: 80, emax: 980, uo: 0.2, ugr: null, lpd: 0, totalWatts: 0, areaM2: 576 },
    grid: { originX: 0, originY: 0, spacing: 0.3, nx, ny, z: 0.75, lux },
    meta: { interreflection: false, bounces: 0, calculatedAt: "2026-11-17T00:00:00.000Z", disclaimer: "assist" },
  };
  return { room, results };
}

function dataUrlBytes(url: string): number {
  const b64 = url.split(",")[1] ?? "";
  return Buffer.from(b64, "base64").length;
}

describe("gridToFalseColorJpegDataUrl", () => {
  it("encodes a large bilinear workplane as JPEG that is much smaller than PNG", () => {
    const { room, results } = largeOffice();
    const createCanvasFn = (width: number, height: number) => createCanvas(width, height);
    const jpeg = gridToFalseColorJpegDataUrl(room, results, { createCanvas: createCanvasFn });
    const png = gridToFalseColorJpegDataUrl(room, results, { createCanvas: createCanvasFn, format: "png" });
    expect(jpeg).toMatch(/^data:image\/jpeg/);
    expect(png).toMatch(/^data:image\/png/);
    const jpegBytes = dataUrlBytes(jpeg!);
    const pngBytes = dataUrlBytes(png!);
    expect(jpegBytes).toBeGreaterThan(1_000);
    expect(pngBytes).toBeGreaterThan(jpegBytes * 3);
    const size = falseColorJpegPixelSize(results.grid.nx, results.grid.ny);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(FALSE_COLOR_JPEG_MAX_EDGE);
  });
});
