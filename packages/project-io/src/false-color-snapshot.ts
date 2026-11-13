import type { CalcResults } from "../../solver/src/types";
import { pointInPolygon, roomBounds } from "./geometry";
import type { RoomV2 } from "./types";

function luxToRgb(lux: number, max: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, lux / Math.max(max, 1)));
  if (t < 0.25) return [0, t / 0.25, 1];
  if (t < 0.5) return [0, 1, 1 - (t - 0.25) / 0.25];
  if (t < 0.75) return [(t - 0.5) / 0.25, 1, 0];
  return [1, 1 - (t - 0.75) / 0.25, 0];
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
  const max = Math.max(...grid.lux, results.summary.emax, 1);
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
      const [r, g, bch] = luxToRgb(lux, max);
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(bch * 255)})`;
      ctx.fillRect(x, y, scale, scale);
    }
  }

  return canvas.toDataURL("image/png");
}
