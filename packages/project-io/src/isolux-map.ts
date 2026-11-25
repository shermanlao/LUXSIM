/** Official isolux / false-colour map. */

import type { CalcResults } from "../../solver/src/types";
import type { FixtureInstance, RoomV2, Vec2 } from "./types";
import { pointInPolygon, roomBounds } from "./geometry";

/**
 * Nine official false-colour stops, interpolated smoothly. The palette is
 * painted continuously across the scale-bar lux range [barMin, barMax]
 * (default 0–2500). Handle numbers are lux anchors for the colours under
 * the handles, not the lux at those positions on the bar.
 */
export const OFFICIAL_FALSE_COLOR_BANDS: readonly { r: number; g: number; b: number }[] = [
  { r: 0, g: 0, b: 0 },
  { r: 170, g: 1, b: 254 },
  { r: 2, g: 0, b: 255 },
  { r: 2, g: 255, b: 250 },
  { r: 3, g: 253, b: 5 },
  { r: 251, g: 255, b: 0 },
  { r: 252, g: 170, b: 2 },
  { r: 255, g: 0, b: 1 },
  { r: 255, g: 255, b: 255 },
];

export const OFFICIAL_FALSE_COLOR_BAND_COUNT = OFFICIAL_FALSE_COLOR_BANDS.length;

export interface FalseColorScale {
  /** Left end of the scale bar (displayed lux range). */
  minLux: number;
  /** Right end of the scale bar (displayed lux range). */
  maxLux: number;
  /** Left-handle palette t on the bar, in [0, 1]. */
  tMin?: number;
  /** Right-handle palette t on the bar, in [0, 1]. */
  tMax?: number;
  /** Lux represented by the colour under the left handle (lux anchor). */
  winMin?: number;
  /** Lux represented by the colour under the right handle (lux anchor). */
  winMax?: number;
}

/** Default bar range, colour-handle ends, and lux anchors. */
export const OFFICIAL_FALSE_COLOR_SCALE: FalseColorScale = {
  minLux: 0,
  maxLux: 2500,
  tMin: 0,
  tMax: 1,
  winMin: 0,
  winMax: 2500,
};

/** Inclusive lower bound for a bar-end or lux-anchor value. */
export const FALSE_COLOR_BAR_MIN = 0;
/** Inclusive upper bound for a bar-end or lux-anchor value (not a log chart). */
export const FALSE_COLOR_BAR_MAX = 100000;

/** Minimum handle separation on the official chart (one default-bar lux step). */
export const OFFICIAL_FALSE_COLOR_MIN_T_SPAN =
  1 / (OFFICIAL_FALSE_COLOR_SCALE.maxLux - OFFICIAL_FALSE_COLOR_SCALE.minLux);

/** Even lux labels for the default 0–2500 bar. */
export const OFFICIAL_FALSE_COLOR_CHART_TICKS = [0, 500, 1000, 1500, 2000, 2500] as const;

export function normalizeFalseColorBar(minLux: number, maxLux: number): { minLux: number; maxLux: number } {
  const a = Number.isFinite(minLux) ? minLux : FALSE_COLOR_BAR_MIN;
  const b = Number.isFinite(maxLux) ? maxLux : OFFICIAL_FALSE_COLOR_SCALE.maxLux;
  const lo = Math.max(FALSE_COLOR_BAR_MIN, Math.min(a, b, FALSE_COLOR_BAR_MAX));
  const hi = Math.min(FALSE_COLOR_BAR_MAX, Math.max(a, b, FALSE_COLOR_BAR_MIN));
  if (hi > lo) return { minLux: lo, maxLux: hi };
  if (lo >= FALSE_COLOR_BAR_MAX) {
    return { minLux: Math.max(FALSE_COLOR_BAR_MIN, FALSE_COLOR_BAR_MAX - 1), maxLux: FALSE_COLOR_BAR_MAX };
  }
  return { minLux: lo, maxLux: Math.min(FALSE_COLOR_BAR_MAX, lo + 1) };
}

export function normalizeFalseColorHandles(tMin?: number, tMax?: number): { tMin: number; tMax: number } {
  const span = OFFICIAL_FALSE_COLOR_MIN_T_SPAN;
  const a = Number.isFinite(tMin) ? (tMin as number) : 0;
  const b = Number.isFinite(tMax) ? (tMax as number) : 1;
  let lo = Math.max(0, Math.min(a, b, 1));
  let hi = Math.min(1, Math.max(a, b, 0));
  if (hi - lo < span) {
    if (lo <= 0) return { tMin: 0, tMax: span };
    if (hi >= 1) return { tMin: 1 - span, tMax: 1 };
    return { tMin: lo, tMax: Math.min(1, lo + span) };
  }
  return { tMin: lo, tMax: hi };
}

function minAnchorSpan(lo: number, hi: number): number {
  const mag = Math.max(Math.abs(lo), Math.abs(hi), 1);
  return Math.max(1e-6, Math.min(1, mag / 2500));
}

/** Lux anchors are not clamped to the bar range. */
export function normalizeFalseColorAnchors(
  winMin: number | undefined,
  winMax: number | undefined,
  fallbackMin = FALSE_COLOR_BAR_MIN,
  fallbackMax = OFFICIAL_FALSE_COLOR_SCALE.maxLux
): { winMin: number; winMax: number } {
  const a = Number.isFinite(winMin) ? (winMin as number) : fallbackMin;
  const b = Number.isFinite(winMax) ? (winMax as number) : fallbackMax;
  let lo = Math.max(FALSE_COLOR_BAR_MIN, Math.min(a, b, FALSE_COLOR_BAR_MAX));
  let hi = Math.min(FALSE_COLOR_BAR_MAX, Math.max(a, b, FALSE_COLOR_BAR_MIN));
  const span = minAnchorSpan(lo, hi);
  if (hi - lo < span) {
    if (lo <= FALSE_COLOR_BAR_MIN) return { winMin: FALSE_COLOR_BAR_MIN, winMax: Math.min(FALSE_COLOR_BAR_MAX, FALSE_COLOR_BAR_MIN + span) };
    if (hi >= FALSE_COLOR_BAR_MAX) return { winMin: Math.max(FALSE_COLOR_BAR_MIN, FALSE_COLOR_BAR_MAX - span), winMax: FALSE_COLOR_BAR_MAX };
    return { winMin: lo, winMax: Math.min(FALSE_COLOR_BAR_MAX, lo + span) };
  }
  return { winMin: lo, winMax: hi };
}

function assembledScale(
  bar: { minLux: number; maxLux: number },
  handles: { tMin: number; tMax: number },
  anchors: { winMin: number; winMax: number }
): FalseColorScale {
  return {
    minLux: bar.minLux,
    maxLux: bar.maxLux,
    tMin: handles.tMin,
    tMax: handles.tMax,
    winMin: anchors.winMin,
    winMax: anchors.winMax,
  };
}

/**
 * Build a complete six-number scale. Prefer normalizeFalseColorMapping when
 * loading older objects that may lack t or anchor fields.
 */
export function normalizeFalseColorScale(
  minLux: number,
  maxLux: number,
  winMin?: number,
  winMax?: number,
  tMin?: number,
  tMax?: number
): FalseColorScale {
  return normalizeFalseColorMapping({ minLux, maxLux, winMin, winMax, tMin, tMax });
}

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function hasFiniteHandleT(scale: FalseColorScale): boolean {
  return finiteNumber(scale.tMin) != null || finiteNumber(scale.tMax) != null;
}

function hasFiniteAnchors(scale: FalseColorScale): boolean {
  return finiteNumber(scale.winMin) != null || finiteNumber(scale.winMax) != null;
}

/**
 * Normalise a stored or in-memory scale, including older shapes:
 * - `{ minLux, maxLux }` only: those ends are the bar, handles at t=0 and 1,
 *   anchors default to the bar ends.
 * - `{ minLux, maxLux, winMin, winMax }` without t (t289): bar = min/max,
 *   convert the old window values to handle t on the bar, anchors default
 *   to the bar ends.
 * - `{ minLux, maxLux, tMin, tMax }` without anchors (t288): tMin/tMax are
 *   colour positions, min/max were lux anchors, bar defaults to 0–2500.
 * - All six present: bar = min/max, t = colour positions, win = lux anchors.
 */
export function normalizeFalseColorMapping(scale?: FalseColorScale | number | null): FalseColorScale {
  if (!isFalseColorScale(scale)) return OFFICIAL_FALSE_COLOR_SCALE;
  const hasT = hasFiniteHandleT(scale);
  const hasWin = hasFiniteAnchors(scale);
  if (hasT && hasWin) {
    return assembledScale(
      normalizeFalseColorBar(scale.minLux, scale.maxLux),
      normalizeFalseColorHandles(finiteNumber(scale.tMin), finiteNumber(scale.tMax)),
      normalizeFalseColorAnchors(finiteNumber(scale.winMin), finiteNumber(scale.winMax))
    );
  }
  if (hasT && !hasWin) {
    return assembledScale(
      normalizeFalseColorBar(OFFICIAL_FALSE_COLOR_SCALE.minLux, OFFICIAL_FALSE_COLOR_SCALE.maxLux),
      normalizeFalseColorHandles(scale.tMin, scale.tMax),
      normalizeFalseColorAnchors(scale.minLux, scale.maxLux)
    );
  }
  if (hasWin && !hasT) {
    const bar = normalizeFalseColorBar(scale.minLux, scale.maxLux);
    const span = bar.maxLux - bar.minLux;
    const tFromLux = (lux: number | undefined, fallback: number) => {
      if (!Number.isFinite(lux) || !(span > 0)) return fallback;
      return ((lux as number) - bar.minLux) / span;
    };
    return assembledScale(
      bar,
      normalizeFalseColorHandles(tFromLux(scale.winMin, 0), tFromLux(scale.winMax, 1)),
      normalizeFalseColorAnchors(bar.minLux, bar.maxLux)
    );
  }
  const bar = normalizeFalseColorBar(scale.minLux, scale.maxLux);
  return assembledScale(bar, { tMin: 0, tMax: 1 }, { winMin: bar.minLux, winMax: bar.maxLux });
}

export function isFalseColorScale(value: unknown): value is FalseColorScale {
  if (!value || typeof value !== "object") return false;
  const rec = value as { minLux?: unknown; maxLux?: unknown };
  return Number.isFinite(rec.minLux) && Number.isFinite(rec.maxLux);
}

function roundBandLux(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Evenly spaced lux values at the nine official colour-stop positions. */
export function officialFalseColorBandLuxes(minLux: number, maxLux: number): number[] {
  const range = normalizeFalseColorBar(minLux, maxLux);
  const last = OFFICIAL_FALSE_COLOR_BAND_COUNT - 1;
  return OFFICIAL_FALSE_COLOR_BANDS.map((_, i) =>
    roundBandLux(range.minLux + (i / last) * (range.maxLux - range.minLux))
  );
}

export function officialFalseColorBandIndex(t: number): number {
  const last = OFFICIAL_FALSE_COLOR_BAND_COUNT - 1;
  const u = Math.min(1, Math.max(0, t));
  if (u >= 1) return last;
  return Math.floor(u * last);
}

function officialBandRgb(index: number): [number, number, number] {
  const stop = OFFICIAL_FALSE_COLOR_BANDS[Math.min(OFFICIAL_FALSE_COLOR_BAND_COUNT - 1, Math.max(0, index))]!;
  return [stop.r / 255, stop.g / 255, stop.b / 255];
}

/**
 * Historical export name for the official 0–2500 lx colour-stop positions.
 * Not shown in the app UI.
 */
export const DIALUX_LUX_STOPS: { lux: number; r: number; g: number; b: number }[] =
  officialFalseColorBandLuxes(OFFICIAL_FALSE_COLOR_SCALE.minLux, OFFICIAL_FALSE_COLOR_SCALE.maxLux).map(
    (lux, i) => ({ lux, ...OFFICIAL_FALSE_COLOR_BANDS[i]! })
  );

function paletteRgbAtT(t: number): [number, number, number] {
  const last = OFFICIAL_FALSE_COLOR_BAND_COUNT - 1;
  const u = Math.min(1, Math.max(0, t));
  if (u <= 0) return officialBandRgb(0);
  if (u >= 1) return officialBandRgb(last);
  const x = u * last;
  const i = Math.min(last - 1, Math.floor(x));
  const f = x - i;
  const a = OFFICIAL_FALSE_COLOR_BANDS[i]!;
  const b = OFFICIAL_FALSE_COLOR_BANDS[i + 1]!;
  return [
    (a.r + (b.r - a.r) * f) / 255,
    (a.g + (b.g - a.g) * f) / 255,
    (a.b + (b.b - a.b) * f) / 255,
  ];
}

function officialPaletteT(lux: number): number {
  const range = OFFICIAL_FALSE_COLOR_SCALE;
  const span = range.maxLux - range.minLux;
  if (!(span > 0)) return 0;
  return (lux - range.minLux) / span;
}

/**
 * Palette t for lux L: map luxLeft → tLeft and luxRight → tRight, then
 * extrapolate with the same slope and clamp t to [0, 1]. The bar range
 * only sets how the official palette is painted on the scale bar.
 */
export function officialPaletteTForLux(lux: number, scale?: FalseColorScale | number): number {
  const mapping = normalizeFalseColorMapping(scale);
  const tLeft = Number(mapping.tMin ?? 0);
  const tRight = Number(mapping.tMax ?? 1);
  const luxLeft = Number(mapping.winMin ?? mapping.minLux);
  const luxRight = Number(mapping.winMax ?? mapping.maxLux);
  const span = luxRight - luxLeft;
  if (!(span > 0) || !Number.isFinite(tLeft) || !Number.isFinite(tRight)) {
    return Math.max(0, Math.min(1, Number.isFinite(tLeft) ? tLeft : 0));
  }
  const t = tLeft + ((lux - luxLeft) * (tRight - tLeft)) / span;
  return Math.max(0, Math.min(1, t));
}

function absoluteLuxToRgb(lux: number): [number, number, number] {
  return paletteRgbAtT(officialPaletteT(lux));
}

export type IsoluxPalette = "falsecolor" | "greyscale";

/**
 * sRGB greyscale endpoints. The floor is high enough that after an sRGB→linear
 * conversion (colour-managed 3D / CanvasTexture) the low end stays visible,
 * instead of collapsing to near-black. The official false-colour scale is unchanged
 * by this greyscale range.
 */
export const GREYSCALE_SRGB_MIN = 0.42;
export const GREYSCALE_SRGB_MAX = 1;

/**
 * Map illuminance to greyscale with the same lux-anchor + colour-handle model
 * as false colour, sampled on the official grey ramp.
 */
export function luxToGrey(lux: number, scale?: FalseColorScale | number): [number, number, number] {
  const t = officialPaletteTForLux(lux, scale);
  const g = GREYSCALE_SRGB_MIN + (GREYSCALE_SRGB_MAX - GREYSCALE_SRGB_MIN) * t;
  return [g, g, g];
}

export function luxToRgb(
  lux: number,
  scale?: FalseColorScale | number,
  palette: IsoluxPalette = "falsecolor"
): [number, number, number] {
  if (palette === "greyscale") return luxToGrey(lux, scale);
  if (isFalseColorScale(scale)) {
    return paletteRgbAtT(officialPaletteTForLux(lux, scale));
  }
  return absoluteLuxToRgb(lux);
}

/** Entries in the precomputed field LUT. Fine enough to stay visually continuous. */
const FALSE_COLOR_LUT_SIZE = 2048;

/** Official palette (or grey ramp) colour at palette t in [0, 1]. */
export function officialChartRgbAtT(t: number, palette: IsoluxPalette = "falsecolor"): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  if (palette === "greyscale") {
    const g = GREYSCALE_SRGB_MIN + (GREYSCALE_SRGB_MAX - GREYSCALE_SRGB_MIN) * u;
    return [g, g, g];
  }
  return paletteRgbAtT(u);
}

/**
 * Precompute a 0–1 official-palette LUT. Sample it with officialPaletteTForLux
 * so workplane colouring follows lux anchors and colour-handle positions.
 */
export function falseColorRgbaLut(
  _scale?: FalseColorScale,
  palette: IsoluxPalette = "falsecolor"
): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(FALSE_COLOR_LUT_SIZE * 4);
  const last = FALSE_COLOR_LUT_SIZE - 1;
  for (let i = 0; i <= last; i += 1) {
    const [r, g, b] = officialChartRgbAtT(i / last, palette);
    const j = i * 4;
    lut[j] = Math.round(r * 255);
    lut[j + 1] = Math.round(g * 255);
    lut[j + 2] = Math.round(b * 255);
    lut[j + 3] = 255;
  }
  return lut;
}

function lutSampleRgba(
  lut: Uint8ClampedArray,
  lux: number,
  scale: FalseColorScale,
  dest: Uint8ClampedArray,
  offset: number
) {
  const last = (lut.length >> 2) - 1;
  const t = officialPaletteTForLux(lux, scale);
  const i = t <= 0 ? 0 : t >= 1 ? last : (t * last) | 0;
  const j = i * 4;
  dest[offset] = lut[j]!;
  dest[offset + 1] = lut[j + 1]!;
  dest[offset + 2] = lut[j + 2]!;
  dest[offset + 3] = 255;
}

/** Convert an sRGB channel in 0–1 to linear-light, for Three.js vertex colours. */
export function srgbToLinearChannel(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

/** luxToRgb values converted to linear-light so a colour-managed renderer shows the official scale. */
export function luxToRgbLinear(
  lux: number,
  scale?: FalseColorScale | number,
  palette: IsoluxPalette = "falsecolor"
): [number, number, number] {
  const [r, g, b] = luxToRgb(lux, scale, palette);
  return [srgbToLinearChannel(r), srgbToLinearChannel(g), srgbToLinearChannel(b)];
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export function legendStopsForRange(emin: number, emax: number): { lux: number; color: string }[] {
  return legendStopsForScale(normalizeFalseColorScale(emin, emax));
}

export function isoluxLevels(emin: number, emax: number): number[] {
  const lo = Math.max(0, Math.min(emin, emax));
  const hi = Math.max(emin, emax, lo + 1);
  const span = hi - lo;
  const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = nice.find((s) => span / s <= 12) ?? 1000;
  const start = Math.ceil((lo + step * 0.05) / step) * step;
  const levels: number[] = [];
  for (let v = start; v < hi - step * 0.05; v += step) {
    levels.push(v);
  }
  return levels;
}

/** Linear tick labels for a bar range. The default 0–2500 bar keeps 0, 500, …, 2500. */
export function falseColorBarTicks(minLux: number, maxLux: number): number[] {
  const bar = normalizeFalseColorBar(minLux, maxLux);
  if (bar.minLux === 0 && bar.maxLux === 2500) return [...OFFICIAL_FALSE_COLOR_CHART_TICKS];
  const span = bar.maxLux - bar.minLux;
  const nice = [
    0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500,
    5000, 10000, 20000, 25000, 50000, 100000,
  ];
  const target = 5;
  const step = nice.find((s) => span / s <= target) ?? Math.ceil(span / target);
  const ticks: number[] = [roundBandLux(bar.minLux)];
  const start = Math.ceil((bar.minLux + step * 0.5) / step) * step;
  for (let v = start; v < bar.maxLux - step * 0.25; v += step) {
    ticks.push(roundBandLux(v));
  }
  ticks.push(roundBandLux(bar.maxLux));
  return ticks;
}

/**
 * Nine official colour-stop luxes across the bar range, coloured with the
 * lux-anchor + colour-handle mapping (for field / report legends).
 */
export function legendStopsForScale(
  scale: FalseColorScale,
  palette: IsoluxPalette = "falsecolor"
): { lux: number; color: string }[] {
  const range = normalizeFalseColorMapping(scale);
  return officialFalseColorBandLuxes(range.minLux, range.maxLux).map((lux) => ({
    lux,
    color: rgbCss(luxToRgb(lux, range, palette)),
  }));
}

/** Official nine-stop colours painted evenly across the scale-bar gradient. */
export function officialChartLegendStops(
  palette: IsoluxPalette = "falsecolor"
): { lux: number; color: string }[] {
  const last = OFFICIAL_FALSE_COLOR_BAND_COUNT - 1;
  const domain = OFFICIAL_FALSE_COLOR_SCALE;
  const span = domain.maxLux - domain.minLux;
  return OFFICIAL_FALSE_COLOR_BANDS.map((_, i) => {
    const t = i / last;
    return {
      lux: domain.minLux + t * span,
      color: rgbCss(officialChartRgbAtT(t, palette)),
    };
  });
}

export type IsoluxMode = "falsecolor" | "isolines";

export interface IsoluxPoint {
  x: number;
  y: number;
}

export interface IsoluxModel {
  width: number;
  height: number;
  field: Uint8ClampedArray;
  contours: { level: number; polylines: IsoluxPoint[][] }[];
  contourLabels: { x: number; y: number; text: string }[];
  valueLabels: { x: number; y: number; text: string }[];
  roomOutline: IsoluxPoint[];
  workplaneOutline: IsoluxPoint[];
  fixtures: IsoluxPoint[];
  legendStops: { lux: number; color: string }[];
  fontPx: number;
  world: IsoluxWorldFrame;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.hypot(dx, dy);
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function distToEdges(p: Vec2, polygon: Vec2[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const d = distToSegment(p, polygon[i]!, polygon[(i + 1) % polygon.length]!);
    if (d < min) min = d;
  }
  return min;
}

function inWorkplane(p: Vec2, polygon: Vec2[], wallZoneM: number): boolean {
  if (!pointInPolygon(p, polygon)) return false;
  if (wallZoneM <= 1e-6) return true;
  return distToEdges(p, polygon) >= wallZoneM - 1e-6;
}

function signedArea(polygon: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function insetPolygon(polygon: Vec2[], dist: number): Vec2[] {
  if (polygon.length < 3 || dist <= 1e-6) return polygon.map((p) => ({ ...p }));
  const ccw = signedArea(polygon) > 0;
  const n = polygon.length;
  const lines: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    // Inward normal: interior is to the left when walking a CCW ring.
    const nx = ccw ? -ey / len : ey / len;
    const ny = ccw ? ex / len : -ex / len;
    lines.push({
      a: { x: a.x + nx * dist, y: a.y + ny * dist },
      b: { x: b.x + nx * dist, y: b.y + ny * dist },
    });
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i += 1) {
    const l1 = lines[(i - 1 + n) % n]!;
    const l2 = lines[i]!;
    const den =
      (l1.a.x - l1.b.x) * (l2.a.y - l2.b.y) - (l1.a.y - l1.b.y) * (l2.a.x - l2.b.x);
    if (Math.abs(den) < 1e-12) {
      out.push({ ...l2.a });
      continue;
    }
    const a1 = l1.a.x * l1.b.y - l1.a.y * l1.b.x;
    const a2 = l2.a.x * l2.b.y - l2.a.y * l2.b.x;
    const x = (a1 * (l2.a.x - l2.b.x) - (l1.a.x - l1.b.x) * a2) / den;
    const y = (a1 * (l2.a.y - l2.b.y) - (l1.a.y - l1.b.y) * a2) / den;
    out.push({ x, y });
  }
  return out.length >= 3 ? out : polygon.map((p) => ({ ...p }));
}

function gridValue(grid: CalcResults["grid"], i: number, j: number): number | null {
  if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return null;
  return grid.lux[j * grid.nx + i] ?? null;
}

/** Sample the official isolux / false-colour field in world metres. */
export function sampleLuxAtWorld(
  grid: CalcResults["grid"],
  b: { minX: number; minY: number },
  x: number,
  y: number
): number {
  return sampleLux(grid, b, x, y);
}

function sampleLux(
  grid: CalcResults["grid"],
  b: { minX: number; minY: number },
  x: number,
  y: number
): number {
  const fx = (x - (b.minX + grid.originX)) / Math.max(grid.spacing, 1e-6);
  const fy = (y - (b.minY + grid.originY)) / Math.max(grid.spacing, 1e-6);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const tx = fx - i0;
  const ty = fy - j0;
  const corners = [
    gridValue(grid, i0, j0),
    gridValue(grid, i0 + 1, j0),
    gridValue(grid, i0, j0 + 1),
    gridValue(grid, i0 + 1, j0 + 1),
  ];
  const present = corners.filter((v): v is number => v != null && v > 0);
  if (present.length === 0) {
    const nearest = gridValue(
      grid,
      Math.max(0, Math.min(grid.nx - 1, Math.round(fx))),
      Math.max(0, Math.min(grid.ny - 1, Math.round(fy)))
    );
    return nearest && nearest > 0 ? nearest : 0;
  }
  const v00 = corners[0] != null && corners[0] > 0 ? corners[0] : present[0]!;
  const v10 = corners[1] != null && corners[1] > 0 ? corners[1] : v00;
  const v01 = corners[2] != null && corners[2] > 0 ? corners[2] : v00;
  const v11 = corners[3] != null && corners[3] > 0 ? corners[3] : v10;
  const a = v00 * (1 - tx) + v10 * tx;
  const c = v01 * (1 - tx) + v11 * tx;
  return a * (1 - ty) + c * ty;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type CellCorner = { x: number; y: number; v: number };

function marchingSquares(
  values: Float64Array,
  nx: number,
  ny: number,
  originX: number,
  originY: number,
  dx: number,
  dy: number,
  level: number
): IsoluxPoint[][] {
  const segments: { a: IsoluxPoint; b: IsoluxPoint }[] = [];
  const interp = (p: CellCorner, q: CellCorner): IsoluxPoint => {
    const den = q.v - p.v;
    const t = Math.abs(den) < 1e-9 ? 0.5 : (level - p.v) / den;
    const tt = Math.max(0, Math.min(1, t));
    return { x: lerp(p.x, q.x, tt), y: lerp(p.y, q.y, tt) };
  };
  for (let j = 0; j < ny - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const sw: CellCorner = { x: originX + i * dx, y: originY + j * dy, v: values[j * nx + i]! };
      const se: CellCorner = { x: originX + (i + 1) * dx, y: originY + j * dy, v: values[j * nx + i + 1]! };
      const nw: CellCorner = { x: originX + i * dx, y: originY + (j + 1) * dy, v: values[(j + 1) * nx + i]! };
      const ne: CellCorner = {
        x: originX + (i + 1) * dx,
        y: originY + (j + 1) * dy,
        v: values[(j + 1) * nx + i + 1]!,
      };
      if ([sw, se, nw, ne].some((c) => !Number.isFinite(c.v))) continue;
      const idx =
        (sw.v >= level ? 1 : 0) +
        (se.v >= level ? 2 : 0) +
        (ne.v >= level ? 4 : 0) +
        (nw.v >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const bottom = () => interp(sw, se);
      const right = () => interp(se, ne);
      const top = () => interp(nw, ne);
      const left = () => interp(sw, nw);
      const add = (a: IsoluxPoint, b: IsoluxPoint) => segments.push({ a, b });
      switch (idx) {
        case 1:
        case 14:
          add(left(), bottom());
          break;
        case 2:
        case 13:
          add(bottom(), right());
          break;
        case 3:
        case 12:
          add(left(), right());
          break;
        case 4:
        case 11:
          add(right(), top());
          break;
        case 6:
        case 9:
          add(bottom(), top());
          break;
        case 7:
        case 8:
          add(left(), top());
          break;
        case 5:
          add(left(), bottom());
          add(right(), top());
          break;
        case 10:
          add(bottom(), right());
          add(left(), top());
          break;
        default:
          break;
      }
    }
  }
  return stitch(segments);
}

function stitch(segments: { a: IsoluxPoint; b: IsoluxPoint }[]): IsoluxPoint[][] {
  const key = (p: IsoluxPoint) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
  const used = new Array(segments.length).fill(false);
  const lines: IsoluxPoint[][] = [];
  const findFrom = (pt: IsoluxPoint, skip: number) => {
    const k = key(pt);
    for (let i = 0; i < segments.length; i += 1) {
      if (used[i] || i === skip) continue;
      if (key(segments[i]!.a) === k) return { i, next: segments[i]!.b, rev: false };
      if (key(segments[i]!.b) === k) return { i, next: segments[i]!.a, rev: true };
    }
    return null;
  };
  for (let s = 0; s < segments.length; s += 1) {
    if (used[s]) continue;
    used[s] = true;
    const line = [segments[s]!.a, segments[s]!.b];
    let guard = 0;
    while (guard++ < segments.length + 2) {
      const hit = findFrom(line[line.length - 1]!, -1);
      if (!hit) break;
      used[hit.i] = true;
      line.push(hit.next);
    }
    while (guard++ < segments.length * 2) {
      const hit = findFrom(line[0]!, -1);
      if (!hit) break;
      used[hit.i] = true;
      line.unshift(hit.next);
    }
    if (line.length >= 2) lines.push(line);
  }
  return lines;
}

export function formatPointLux(v: number): string {
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

export interface IsoluxWorldFrame {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Pixels per metre in the model bitmap / contour space. */
  scale: number;
}

export function isoluxPxToWorld(frame: IsoluxWorldFrame, p: IsoluxPoint): IsoluxPoint {
  return {
    x: frame.minX + p.x / frame.scale,
    y: frame.maxY - p.y / frame.scale,
  };
}

/** Screen rectangle for an isolux field bitmap, using the same corners as the plan overlay. */
export function isoluxFieldScreenRect(
  frame: IsoluxWorldFrame,
  width: number,
  height: number,
  toScreen: (x: number, y: number) => { x: number; y: number }
): { x: number; y: number; width: number; height: number } | null {
  const topLeftWorld = isoluxPxToWorld(frame, { x: 0, y: 0 });
  const topRightWorld = isoluxPxToWorld(frame, { x: width, y: 0 });
  const bottomLeftWorld = isoluxPxToWorld(frame, { x: 0, y: height });
  const topLeft = toScreen(topLeftWorld.x, topLeftWorld.y);
  const topRight = toScreen(topRightWorld.x, topRightWorld.y);
  const bottomLeft = toScreen(bottomLeftWorld.x, bottomLeftWorld.y);
  const w = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
  const h = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
  if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { x: topLeft.x, y: topLeft.y, width: w, height: h };
}

export function buildIsoluxModel(
  room: RoomV2,
  results: CalcResults,
  opts?: {
    mode?: IsoluxMode;
    wallZoneM?: number;
    fixtures?: FixtureInstance[];
    targetLongSide?: number;
    colorScale?: FalseColorScale;
    includeContours?: boolean;
    palette?: IsoluxPalette;
    includeValueLabels?: boolean;
    /** When set, these lux values are used instead of isoluxLevels(emin, emax). */
    contourLevels?: number[];
  }
): IsoluxModel | null {
  const { grid } = results;
  if (!grid?.lux?.length || grid.nx < 1 || grid.ny < 1) return null;
  const mode: IsoluxMode = opts?.mode ?? "falsecolor";
  const wallZone = opts?.wallZoneM ?? 0.25;
  const b = roomBounds(room);
  const padM = Math.max(b.width, b.depth) * 0.06 + 0.15;
  const minX = b.minX - padM;
  const maxX = b.maxX + padM;
  const minY = b.minY - padM;
  const maxY = b.maxY + padM;
  const worldW = Math.max(maxX - minX, 0.2);
  const worldH = Math.max(maxY - minY, 0.2);
  const target = opts?.targetLongSide ?? 1400;
  const scale = target / Math.max(worldW, worldH);
  const width = Math.max(80, Math.round(worldW * scale));
  const height = Math.max(80, Math.round(worldH * scale));
  const toPx = (p: Vec2): IsoluxPoint => ({
    x: (p.x - minX) * scale,
    y: (maxY - p.y) * scale,
  });

  const field = new Uint8ClampedArray(width * height * 4);
  const colourRange = normalizeFalseColorMapping(opts?.colorScale);
  const colourLut = mode === "falsecolor" ? falseColorRgbaLut(colourRange, opts?.palette) : null;
  for (let py = 0; py < height; py += 1) {
    const y = maxY - (py + 0.5) / scale;
    for (let px = 0; px < width; px += 1) {
      const x = minX + (px + 0.5) / scale;
      const pt = { x, y };
      if (!inWorkplane(pt, room.polygon, wallZone)) continue;
      const lux = sampleLux(grid, b, x, y);
      const i = (py * width + px) * 4;
      if (mode === "falsecolor" && colourLut) {
        lutSampleRgba(colourLut, lux, colourRange, field, i);
      }
    }
  }

  const includeContours = opts?.includeContours !== false;
  const includeValueLabels = opts?.includeValueLabels !== false;
  let contours: IsoluxModel["contours"] = [];
  const contourLabels: IsoluxModel["contourLabels"] = [];
  if (includeContours) {
    const stepM = Math.max(0.04, grid.spacing / 8);
    const sx = Math.max(8, Math.ceil(worldW / stepM) + 1);
    const sy = Math.max(8, Math.ceil(worldH / stepM) + 1);
    const fieldVals = new Float64Array(sx * sy);
    fieldVals.fill(Number.NaN);
    for (let j = 0; j < sy; j += 1) {
      const y = minY + j * stepM;
      for (let i = 0; i < sx; i += 1) {
        const x = minX + i * stepM;
        if (!inWorkplane({ x, y }, room.polygon, wallZone)) continue;
        fieldVals[j * sx + i] = sampleLux(grid, b, x, y);
      }
    }

    const levels = opts?.contourLevels ?? isoluxLevels(results.summary.emin, results.summary.emax);
    contours = levels.map((level) => ({
      level,
      polylines: marchingSquares(fieldVals, sx, sy, minX, minY, stepM, stepM, level).map((line) =>
        line.map(toPx)
      ),
    }));

    const fontGuess = Math.max(12, Math.min(22, width / 70));
    const minDist = fontGuess * 3.2;
    for (const c of contours) {
      let best: IsoluxPoint[] = [];
      for (const line of c.polylines) {
        if (line.length > best.length) best = line;
      }
      if (best.length < 4) continue;
      const candidates = [0.45, 0.3, 0.6, 0.2, 0.75].map((f) => best[Math.min(best.length - 1, Math.floor(best.length * f))]!);
      const mid = candidates.find((pt) =>
        contourLabels.every((l) => Math.hypot(l.x - pt.x, l.y - pt.y) >= minDist)
      );
      if (!mid) continue;
      contourLabels.push({ x: mid.x, y: mid.y, text: formatPointLux(c.level) });
    }
  }

  const valueLabels: IsoluxModel["valueLabels"] = [];
  if (includeValueLabels) {
    const nPts = grid.nx * grid.ny;
    const stride = nPts > 90 ? Math.ceil(Math.sqrt(nPts / 70)) : 1;
    for (let j = 0; j < grid.ny; j += stride) {
      for (let i = 0; i < grid.nx; i += stride) {
        const lux = grid.lux[j * grid.nx + i] ?? 0;
        if (lux <= 0) continue;
        const x = b.minX + grid.originX + i * grid.spacing;
        const y = b.minY + grid.originY + j * grid.spacing;
        if (!inWorkplane({ x, y }, room.polygon, wallZone)) continue;
        const p = toPx({ x, y });
        valueLabels.push({ x: p.x, y: p.y, text: formatPointLux(lux) });
      }
    }
  }

  const fixtures = (opts?.fixtures ?? [])
    .filter((f) => f.roomId === room.id)
    .map((f) => toPx({ x: f.position.x, y: f.position.y }));

  return {
    width,
    height,
    field,
    contours,
    contourLabels,
    valueLabels,
    roomOutline: room.polygon.map(toPx),
    workplaneOutline: insetPolygon(room.polygon, wallZone).map(toPx),
    fixtures,
    legendStops: legendStopsForScale(opts?.colorScale ?? OFFICIAL_FALSE_COLOR_SCALE, opts?.palette),
    fontPx: Math.max(12, Math.min(22, width / 70)),
    world: { minX, minY, maxX, maxY, scale },
  };
}
