import { describe, expect, it } from "vitest";
import { workplaneFalseColorRgb } from "./false-color-snapshot";
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
