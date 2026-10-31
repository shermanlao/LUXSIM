/** Shared false-color scale (blue → cyan → green → yellow → red). */

export function luxToRgb(lux: number, max: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, lux / Math.max(max, 1)));
  if (t < 0.25) return [0, t / 0.25, 1];
  if (t < 0.5) return [0, 1, 1 - (t - 0.25) / 0.25];
  if (t < 0.75) return [(t - 0.5) / 0.25, 1, 0];
  return [1, 1 - (t - 0.75) / 0.25, 0];
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/** Build legend stops from 0 → maxLux */
export function falseColorStops(maxLux: number, steps = 6): { lux: number; color: string }[] {
  const max = Math.max(maxLux, 1);
  const out: { lux: number; color: string }[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const lux = t * max;
    out.push({ lux, color: rgbCss(luxToRgb(lux, max)) });
  }
  return out;
}

export function falseColorGradientCss(maxLux: number): string {
  const stops = falseColorStops(maxLux, 9);
  return `linear-gradient(90deg, ${stops.map((s, i) => `${s.color} ${(i / (stops.length - 1)) * 100}%`).join(", ")})`;
}
