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

/**
 * Render a false-color workplane grid to a PNG data URL (browser only).
 */
export function gridToFalseColorPngDataUrl(
  room: RoomV2,
  results: CalcResults,
  opts?: { scale?: number }
): string | null {
  if (typeof document === "undefined") return null;
  const { grid } = results;
  const scale = opts?.scale ?? 12;
  const pad = 4;
  const w = grid.nx * scale + pad * 2;
  const h = grid.ny * scale + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const b = roomBounds(room);
  ctx.fillStyle = "#1a2630";
  ctx.fillRect(0, 0, w, h);

  for (let j = 0; j < grid.ny; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const lx = b.minX + grid.originX + i * grid.spacing;
      const ly = b.minY + grid.originY + j * grid.spacing;
      const inside = pointInPolygon({ x: lx, y: ly }, room.polygon);
      const lux = grid.lux[j * grid.nx + i] ?? 0;
      const x = pad + i * scale;
      const y = pad + (grid.ny - 1 - j) * scale;
      if (!inside || lux <= 0) {
        ctx.fillStyle = "#243038";
        ctx.fillRect(x, y, scale, scale);
        continue;
      }
      const [r, g, bch] = workplaneFalseColorRgb(lux);
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(bch * 255)})`;
      ctx.fillRect(x, y, scale, scale);
    }
  }

  return canvas.toDataURL("image/png");
}

export type OfficialYield = () => Promise<void>;

const defaultYield: OfficialYield = () => Promise.resolve();

/** Rows of a workplane grid between event-loop yields while drawing a report PNG. */
export const FALSE_COLOR_PNG_YIELD_ROWS = 16;

/**
 * Same PNG as `gridToFalseColorPngDataUrl`, but yields periodically so a large
 * room grid does not freeze the page during Full PDF export.
 */
export async function gridToFalseColorPngDataUrlAsync(
  room: RoomV2,
  results: CalcResults,
  opts?: { scale?: number; yieldTo?: OfficialYield; yieldEveryRows?: number }
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const { grid } = results;
  const scale = opts?.scale ?? 12;
  const pad = 4;
  const yieldTo = opts?.yieldTo ?? defaultYield;
  const yieldEveryRows = opts?.yieldEveryRows ?? FALSE_COLOR_PNG_YIELD_ROWS;
  const w = grid.nx * scale + pad * 2;
  const h = grid.ny * scale + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const b = roomBounds(room);
  ctx.fillStyle = "#1a2630";
  ctx.fillRect(0, 0, w, h);

  for (let j = 0; j < grid.ny; j += 1) {
    if (j > 0 && j % yieldEveryRows === 0) await yieldTo();
    for (let i = 0; i < grid.nx; i += 1) {
      const lx = b.minX + grid.originX + i * grid.spacing;
      const ly = b.minY + grid.originY + j * grid.spacing;
      const inside = pointInPolygon({ x: lx, y: ly }, room.polygon);
      const lux = grid.lux[j * grid.nx + i] ?? 0;
      const x = pad + i * scale;
      const y = pad + (grid.ny - 1 - j) * scale;
      if (!inside || lux <= 0) {
        ctx.fillStyle = "#243038";
        ctx.fillRect(x, y, scale, scale);
        continue;
      }
      const [r, g, bch] = workplaneFalseColorRgb(lux);
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(bch * 255)})`;
      ctx.fillRect(x, y, scale, scale);
    }
  }

  return canvas.toDataURL("image/png");
}
