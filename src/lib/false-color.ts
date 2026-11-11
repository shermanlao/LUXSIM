/** Shared false-color scale — project-wide DIALux-style illuminance colours. */

export {
  luxToRgb,
  rgbCss,
  legendStopsForRange,
  isoluxLevels,
  DIALUX_LUX_STOPS,
} from "@luxsim/project-io";

import { luxToRgb, rgbCss, legendStopsForRange } from "@luxsim/project-io";

/** @deprecated Prefer legendStopsForRange; kept for existing callers. */
export function falseColorStops(maxLux: number, steps = 6): { lux: number; color: string }[] {
  const stops = legendStopsForRange(0, Math.max(maxLux, 1));
  if (stops.length >= 2) return stops;
  const out: { lux: number; color: string }[] = [];
  const max = Math.max(maxLux, 1);
  for (let i = 0; i < steps; i += 1) {
    const lux = (i / (steps - 1)) * max;
    out.push({ lux, color: rgbCss(luxToRgb(lux)) });
  }
  return out;
}

export function falseColorGradientCss(maxLux: number): string {
  const stops = falseColorStops(maxLux, 9);
  return `linear-gradient(90deg, ${stops.map((s, i) => `${s.color} ${(i / (stops.length - 1)) * 100}%`).join(", ")})`;
}
