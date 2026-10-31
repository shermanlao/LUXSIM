import type { Underlay } from "./types";

/** Default longest-side span (meters) for a newly imported plan image. */
export const DEFAULT_PLAN_SPAN_M = 12;

export function underlayFlipX(underlay: Pick<Underlay, "flipX">): boolean {
  return Boolean(underlay.flipX);
}

export function underlayFlipY(underlay: Pick<Underlay, "flipY">): boolean {
  return Boolean(underlay.flipY);
}

export function underlayWorldSize(
  underlay: Pick<Underlay, "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit">
): { widthM: number; heightM: number } | null {
  const w = underlay.sourceWidthPx;
  const h = underlay.sourceHeightPx;
  if (!(typeof w === "number" && typeof h === "number" && w > 0 && h > 0)) {
    return null;
  }
  const mpu = underlay.metersPerUnit > 0 ? underlay.metersPerUnit : 1;
  return {
    widthM: w * mpu,
    heightM: h * mpu,
  };
}

/** Uniform meters-per-pixel so the longest image side maps to `spanM`. */
export function initialMetersPerPixel(
  widthPx: number,
  heightPx: number,
  spanM = DEFAULT_PLAN_SPAN_M
): number {
  const longest = Math.max(widthPx, heightPx);
  if (!(longest > 0)) return 1;
  return spanM / longest;
}

/**
 * Convert legacy underlay scale (multiplier on a ~12 m default width) to
 * meters-per-pixel once native pixel size is known.
 */
export function legacyScaleToMetersPerPixel(
  legacyScale: number,
  widthPx: number,
  spanM = DEFAULT_PLAN_SPAN_M
): number {
  if (!(widthPx > 0)) return legacyScale;
  const scale = legacyScale > 0 ? legacyScale : 1;
  return (spanM * scale) / widthPx;
}
