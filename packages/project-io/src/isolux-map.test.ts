import { describe, expect, it } from "vitest";
import {
  DIALUX_LUX_STOPS,
  OFFICIAL_FALSE_COLOR_SCALE,
  isoluxFieldScreenRect,
  isoluxPxToWorld,
  legendStopsForScale,
  luxToRgb,
  luxToRgbLinear,
  normalizeFalseColorScale,
  rgbCss,
  srgbToLinearChannel,
} from "./isolux-map";

function rgb(lux: number, scale?: { minLux: number; maxLux: number }) {
  return luxToRgb(lux, scale).map((c) => Math.round(c * 255));
}

describe("false-colour scale mapping", () => {
  it("keeps the absolute DIALux ramp when no scale is given", () => {
    const first = DIALUX_LUX_STOPS[0]!;
    const last = DIALUX_LUX_STOPS[DIALUX_LUX_STOPS.length - 1]!;
    expect(rgb(first.lux)).toEqual([first.r, first.g, first.b]);
    expect(rgb(last.lux)).toEqual([last.r, last.g, last.b]);
    expect(rgb(56)).toEqual([115, 221, 1]);
  });

  it("stretches the palette across the user min/max so those values drive colour and labels", () => {
    const scale = normalizeFalseColorScale(100, 400);
    const first = DIALUX_LUX_STOPS[0]!;
    const last = DIALUX_LUX_STOPS[DIALUX_LUX_STOPS.length - 1]!;
    expect(rgb(100, scale)).toEqual([first.r, first.g, first.b]);
    expect(rgb(400, scale)).toEqual([last.r, last.g, last.b]);
    expect(rgb(50, scale)).toEqual(rgb(100, scale));
    expect(rgb(800, scale)).toEqual(rgb(400, scale));

    const mid = luxToRgb(250, scale);
    const paletteMid = luxToRgb((first.lux + last.lux) / 2);
    expect(mid[0]).toBeCloseTo(paletteMid[0], 5);
    expect(mid[1]).toBeCloseTo(paletteMid[1], 5);
    expect(mid[2]).toBeCloseTo(paletteMid[2], 5);

    // Tightening the scale changes the colour of a mid-range lux value.
    expect(rgb(200, { minLux: 100, maxLux: 400 })).not.toEqual(
      rgb(200, { minLux: 0, maxLux: 1000 })
    );
  });

  it("forces a usable span when min and max collapse", () => {
    expect(normalizeFalseColorScale(200, 200)).toEqual({ minLux: 200, maxLux: 201 });
    expect(normalizeFalseColorScale(500, 20)).toEqual({ minLux: 20, maxLux: 500 });
    expect(normalizeFalseColorScale(-8, 50)).toEqual({ minLux: 0, maxLux: 50 });
  });

  it("labels the legend with the live scale and matching colours", () => {
    const scale = { minLux: 80, maxLux: 500 };
    const stops = legendStopsForScale(scale);
    expect(stops[0]!.lux).toBe(80);
    expect(stops[stops.length - 1]!.lux).toBe(500);
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0]!.color).toBe(rgbCss(luxToRgb(80, scale)));
    expect(stops[stops.length - 1]!.color).toBe(rgbCss(luxToRgb(500, scale)));
  });

  it("maps the official 0–2500 scale to the same colours as the absolute ramp", () => {
    expect(OFFICIAL_FALSE_COLOR_SCALE).toEqual({
      minLux: DIALUX_LUX_STOPS[0]!.lux,
      maxLux: DIALUX_LUX_STOPS[DIALUX_LUX_STOPS.length - 1]!.lux,
    });
    for (const lux of [0, 56, 72, 240, 500, 1170, 2500]) {
      expect(luxToRgb(lux, OFFICIAL_FALSE_COLOR_SCALE)).toEqual(luxToRgb(lux));
    }
  });

  it("converts official sRGB colours to linear-light so a managed 3D renderer keeps the same look", () => {
    expect(srgbToLinearChannel(0)).toBe(0);
    expect(srgbToLinearChannel(1)).toBeCloseTo(1);
    const [r, g, b] = luxToRgb(72);
    const linear = luxToRgbLinear(72);
    expect(linear[0]).toBeCloseTo(srgbToLinearChannel(r));
    expect(linear[1]).toBeCloseTo(srgbToLinearChannel(g));
    expect(linear[2]).toBeCloseTo(srgbToLinearChannel(b));
    // Treating sRGB as linear (the previous 3D path) makes mid greens much brighter.
    expect(r).toBeGreaterThan(linear[0]);
    expect(g).toBeGreaterThan(linear[1]);
  });
});

describe("isoluxFieldScreenRect", () => {
  it("places the field using the same world corners as isoluxPxToWorld", () => {
    const frame = { minX: 2, minY: 1, maxX: 12, maxY: 6, scale: 20 };
    const width = 200;
    const height = 100;
    const toScreen = (x: number, y: number) => ({ x: x * 2, y: 100 - y * 2 });
    const rect = isoluxFieldScreenRect(frame, width, height, toScreen);
    const topLeft = isoluxPxToWorld(frame, { x: 0, y: 0 });
    const topRight = isoluxPxToWorld(frame, { x: width, y: 0 });
    const bottomLeft = isoluxPxToWorld(frame, { x: 0, y: height });
    const a = toScreen(topLeft.x, topLeft.y);
    const b = toScreen(topRight.x, topRight.y);
    const c = toScreen(bottomLeft.x, bottomLeft.y);
    expect(rect).toEqual({
      x: a.x,
      y: a.y,
      width: Math.hypot(b.x - a.x, b.y - a.y),
      height: Math.hypot(c.x - a.x, c.y - a.y),
    });
  });

  it("returns null when the screen rectangle has no size", () => {
    const frame = { minX: 0, minY: 0, maxX: 1, maxY: 1, scale: 10 };
    expect(isoluxFieldScreenRect(frame, 10, 10, () => ({ x: 0, y: 0 }))).toBeNull();
  });
});
