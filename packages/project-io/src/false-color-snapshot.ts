import type { CalcResults } from "../../solver/src/types";
import { pointInPolygon, roomBounds } from "./geometry";
import { luxToRgb } from "./isolux-map";
import type { RoomV2 } from "./types";

/**
 * Workplane cell colour for the official report figure.
 * Uses the same official 0–2500 lx stepped colour bands as `drawLuxLegend`.
 */
export function workplaneFalseColorRgb(lux: number): [number, number, number] {
  return luxToRgb(lux);
}

export type OfficialYield = () => Promise<void>;

const defaultYield: OfficialYield = () => Promise.resolve();

/**
 * Longest edge of the official report false-colour JPEG, in pixels.
 * Fine enough for a smooth A4 workplane panel; small enough for a Full PDF.
 */
export const FALSE_COLOR_JPEG_MAX_EDGE = 1100;

/** Browser canvas JPEG quality (0–1) for official false-colour figures. */
export const FALSE_COLOR_JPEG_QUALITY = 0.75;

/** @alias FALSE_COLOR_JPEG_MAX_EDGE */
export const FALSE_COLOR_PNG_MAX_EDGE = FALSE_COLOR_JPEG_MAX_EDGE;

/** Minimum interpolated samples across one workplane cell (then capped by max edge). */
export const FALSE_COLOR_JPEG_MIN_SAMPLES = 12;

/** @alias FALSE_COLOR_JPEG_MIN_SAMPLES */
export const FALSE_COLOR_PNG_MIN_SAMPLES = FALSE_COLOR_JPEG_MIN_SAMPLES;

/** Output rows between event-loop yields while drawing a report figure. */
export const FALSE_COLOR_JPEG_YIELD_ROWS = 24;

/** @alias FALSE_COLOR_JPEG_YIELD_ROWS */
export const FALSE_COLOR_PNG_YIELD_ROWS = FALSE_COLOR_JPEG_YIELD_ROWS;

export type OfficialFalseColorCanvas = {
  width: number;
  height: number;
  getContext: (id: "2d") => CanvasRenderingContext2D | null;
  toDataURL: (type?: string, quality?: number) => string;
};

export type OfficialFalseColorCanvasFactory = (
  width: number,
  height: number
) => OfficialFalseColorCanvas | null;

function browserCanvas(width: number, height: number): OfficialFalseColorCanvas | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const PAD = 4;
const BG: [number, number, number] = [26, 38, 48];
const OUTSIDE: [number, number, number] = [36, 48, 56];

export function falseColorJpegPixelSize(
  nx: number,
  ny: number,
  opts?: { scale?: number; maxEdge?: number; minSamples?: number }
): { width: number; height: number; samples: number } {
  const minSamples = opts?.minSamples ?? FALSE_COLOR_JPEG_MIN_SAMPLES;
  const maxEdge = opts?.maxEdge ?? FALSE_COLOR_JPEG_MAX_EDGE;
  const requested = opts?.scale ?? minSamples;
  const longest = Math.max(nx, ny, 1);
  const cap = Math.max(1, Math.floor((maxEdge - PAD * 2) / longest));
  const samples = Math.max(1, Math.min(requested, cap));
  return {
    width: nx * samples + PAD * 2,
    height: ny * samples + PAD * 2,
    samples,
  };
}

/** @alias falseColorJpegPixelSize */
export const falseColorPngPixelSize = falseColorJpegPixelSize;

function gridValue(grid: CalcResults["grid"], i: number, j: number): number | null {
  if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return null;
  const v = grid.lux[j * grid.nx + i] ?? 0;
  if (!(v > 0) || !Number.isFinite(v)) return null;
  return v;
}

/**
 * Bilinear sample of the workplane grid in cell-index space (i, j).
 * Grid values sit at integer indices. Invalid / empty neighbours are skipped
 * so room edges do not smear to black.
 */
export function sampleWorkplaneLuxBilinear(grid: CalcResults["grid"], i: number, j: number): number | null {
  const i0 = Math.floor(i);
  const j0 = Math.floor(j);
  const tx = i - i0;
  const ty = j - j0;
  const samples: { w: number; v: number }[] = [];
  const add = (ii: number, jj: number, w: number) => {
    if (w <= 0) return;
    const v = gridValue(grid, ii, jj);
    if (v == null) return;
    samples.push({ w, v });
  };
  add(i0, j0, (1 - tx) * (1 - ty));
  add(i0 + 1, j0, tx * (1 - ty));
  add(i0, j0 + 1, (1 - tx) * ty);
  add(i0 + 1, j0 + 1, tx * ty);
  if (!samples.length) return null;
  const weight = samples.reduce((s, p) => s + p.w, 0);
  if (weight <= 0) return null;
  return samples.reduce((s, p) => s + p.v * p.w, 0) / weight;
}

function paintFalseColor(
  ctx: CanvasRenderingContext2D,
  room: RoomV2,
  results: CalcResults,
  samples: number,
  width: number,
  height: number,
  onRow?: (j: number) => void
) {
  const { grid } = results;
  const b = roomBounds(room);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  const setPx = (x: number, y: number, rgb: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  };

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      setPx(px, py, BG);
    }
  }

  const innerW = grid.nx * samples;
  const innerH = grid.ny * samples;
  for (let row = 0; row < innerH; row += 1) {
    onRow?.(row);
    const py = PAD + row;
    // Image y grows down; grid j grows up, matching the previous cell renderer.
    const j = (innerH - 1 - row + 0.5) / samples - 0.5;
    for (let col = 0; col < innerW; col += 1) {
      const px = PAD + col;
      const i = (col + 0.5) / samples - 0.5;
      const worldX = b.minX + grid.originX + (col + 0.5) * (grid.spacing / samples);
      const worldY = b.minY + grid.originY + (innerH - 1 - row + 0.5) * (grid.spacing / samples);
      if (!pointInPolygon({ x: worldX, y: worldY }, room.polygon)) {
        setPx(px, py, OUTSIDE);
        continue;
      }
      const lux = sampleWorkplaneLuxBilinear(grid, i, j);
      if (lux == null) {
        setPx(px, py, OUTSIDE);
        continue;
      }
      const [r, g, bch] = workplaneFalseColorRgb(lux);
      setPx(px, py, [Math.round(r * 255), Math.round(g * 255), Math.round(bch * 255)]);
    }
  }

  ctx.putImageData(image, 0, 0);
}

export type FalseColorSnapshotOpts = {
  scale?: number;
  maxEdge?: number;
  quality?: number;
  format?: "jpeg" | "png";
  createCanvas?: OfficialFalseColorCanvasFactory;
};

function encodeFalseColor(
  canvas: OfficialFalseColorCanvas,
  opts?: FalseColorSnapshotOpts
): string {
  const format = opts?.format ?? "jpeg";
  if (format === "png") return canvas.toDataURL("image/png");
  return canvas.toDataURL("image/jpeg", opts?.quality ?? FALSE_COLOR_JPEG_QUALITY);
}

/**
 * Render a false-color workplane grid to a JPEG data URL (browser only, unless
 * `createCanvas` is supplied). Colour is bilinear-sampled so adjacent cells blend,
 * instead of 8-bit-looking blocks.
 */
export function gridToFalseColorJpegDataUrl(
  room: RoomV2,
  results: CalcResults,
  opts?: FalseColorSnapshotOpts
): string | null {
  const { grid } = results;
  const { width, height, samples } = falseColorJpegPixelSize(grid.nx, grid.ny, opts);
  const canvas = (opts?.createCanvas ?? browserCanvas)(width, height);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintFalseColor(ctx, room, results, samples, width, height);
  return encodeFalseColor(canvas, opts);
}

/** @alias gridToFalseColorJpegDataUrl */
export const gridToFalseColorPngDataUrl = gridToFalseColorJpegDataUrl;

/**
 * Same JPEG as `gridToFalseColorJpegDataUrl`, but yields periodically so a large
 * room grid does not freeze the page during Full PDF export.
 */
export async function gridToFalseColorJpegDataUrlAsync(
  room: RoomV2,
  results: CalcResults,
  opts?: FalseColorSnapshotOpts & { yieldTo?: OfficialYield; yieldEveryRows?: number }
): Promise<string | null> {
  const { grid } = results;
  const { width, height, samples } = falseColorJpegPixelSize(grid.nx, grid.ny, opts);
  const yieldTo = opts?.yieldTo ?? defaultYield;
  const yieldEveryRows = opts?.yieldEveryRows ?? FALSE_COLOR_JPEG_YIELD_ROWS;
  const canvas = (opts?.createCanvas ?? browserCanvas)(width, height);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // paintFalseColor is sync; yield by painting in row bands instead.
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const setPx = (x: number, y: number, rgb: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const o = (y * width + x) * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  };
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) setPx(px, py, BG);
  }

  const b = roomBounds(room);
  const innerW = grid.nx * samples;
  const innerH = grid.ny * samples;
  for (let row = 0; row < innerH; row += 1) {
    if (row > 0 && row % yieldEveryRows === 0) {
      ctx.putImageData(image, 0, 0);
      await yieldTo();
    }
    const py = PAD + row;
    const j = (innerH - 1 - row + 0.5) / samples - 0.5;
    for (let col = 0; col < innerW; col += 1) {
      const px = PAD + col;
      const i = (col + 0.5) / samples - 0.5;
      const worldX = b.minX + grid.originX + (col + 0.5) * (grid.spacing / samples);
      const worldY = b.minY + grid.originY + (innerH - 1 - row + 0.5) * (grid.spacing / samples);
      if (!pointInPolygon({ x: worldX, y: worldY }, room.polygon)) {
        setPx(px, py, OUTSIDE);
        continue;
      }
      const lux = sampleWorkplaneLuxBilinear(grid, i, j);
      if (lux == null) {
        setPx(px, py, OUTSIDE);
        continue;
      }
      const [r, g, bch] = workplaneFalseColorRgb(lux);
      setPx(px, py, [Math.round(r * 255), Math.round(g * 255), Math.round(bch * 255)]);
    }
  }
  ctx.putImageData(image, 0, 0);
  return encodeFalseColor(canvas, opts);
}

/** @alias gridToFalseColorJpegDataUrlAsync */
export const gridToFalseColorPngDataUrlAsync = gridToFalseColorJpegDataUrlAsync;
