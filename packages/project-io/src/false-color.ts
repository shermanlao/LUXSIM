/** False-color scale for report rendering (blue → cyan → green → yellow → red). */

export function luxToRgb(lux: number, max: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, lux / Math.max(max, 1)));
  if (t < 0.25) return [0, t / 0.25, 1];
  if (t < 0.5) return [0, 1, 1 - (t - 0.25) / 0.25];
  if (t < 0.75) return [(t - 0.5) / 0.25, 1, 0];
  return [1, 1 - (t - 0.75) / 0.25, 0];
}
