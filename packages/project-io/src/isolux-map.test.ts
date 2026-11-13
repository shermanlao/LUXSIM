import { describe, expect, it } from "vitest";
import {
  DIALUX_LUX_STOPS,
  legendStopsForScale,
  luxToRgb,
  normalizeFalseColorScale,
  rgbCss,
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
});
