import type { CalcResults } from "../../solver/src/types";
import { pointInPolygon, roomBounds } from "./geometry";
import { luxToRgb } from "./isolux-map";
import type { RoomV2 } from "./types";

/**
 * Workplane cell colour for the official report PNG.
 * Uses the same absolute DIALux ramp as `drawLuxLegend` / `legendStopsForRange`.
 */
export function workplaneFalseColorRgb(lux: number): [number, number, number] {
  return luxToRgb(lux);
}

export type OfficialYield = () => Promise<void>;

const defaultYield: OfficialYield = () => Promise.resolve();

/**
 * Longest edge of the official report false-colour PNG, in pixels.
 * Fine enough for smooth colour; small enough for a Full PDF export.
 */
export const FALSE_COLOR_PNG_MAX_EDGE = 1600;

/** Minimum interpolated samples across one workplane cell (then capped by max edge). */
export const FALSE_COLOR_PNG_MIN_SAMPLES = 12;

/** Output rows between event-loop yields while drawing a report PNG. */
export const FALSE_COLOR_PNG_YIELD_ROWS = 24;

const PAD = 4;
const BG: [number, number, number] = [26, 38, 48];
const OUTSIDE: [number, number, number] = [36, 48, 56];

export function falseColorPngPixelSize(
  nx: number,
  ny: number,
  opts?: { scale?: number; maxEdge?: number; minSamples?: number }
): { width: number; height: number; samples: number } {
  const minSamples = opts?.minSamples ?? FALSE_COLOR_PNG_MIN_SAMPLES;
  const maxEdge = opts?.maxEdge ?? FALSE_COLOR_PNG_MAX_EDGE;
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

/**
 * Render a false-color workplane grid to a PNG data URL (browser only).
 * Colour is bilinear-sampled so adjacent cells blend, instead of 8-bit-looking blocks.
 */
export function gridToFalseColorPngDataUrl(
  room: RoomV2,
  results: CalcResults,
  opts?: { scale?: number; maxEdge?: number }
): string | null {
  if (typeof document === "undefined") return null;
  const { grid } = results;
  const { width, height, samples } = falseColorPngPixelSize(grid.nx, grid.ny, opts);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintFalseColor(ctx, room, results, samples, width, height);
  return canvas.toDataURL("image/png");
}

/**
 * Same PNG as `gridToFalseColorPngDataUrl`, but yields periodically so a large
 * room grid does not freeze the page during Full PDF export.
 */
export async function gridToFalseColorPngDataUrlAsync(
  room: RoomV2,
  results: CalcResults,
  opts?: { scale?: number; maxEdge?: number; yieldTo?: OfficialYield; yieldEveryRows?: number }
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const { grid } = results;
  const { width, height, samples } = falseColorPngPixelSize(grid.nx, grid.ny, opts);
  const yieldTo = opts?.yieldTo ?? defaultYield;
  const yieldEveryRows = opts?.yieldEveryRows ?? FALSE_COLOR_PNG_YIELD_ROWS;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
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
  return canvas.toDataURL("image/png");
}
