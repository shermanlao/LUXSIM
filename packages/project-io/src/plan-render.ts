import type { jsPDF } from "jspdf";
import type { CalcResults } from "../../solver/src/types";
import type { FixtureInstance, RoomV2 } from "./types";
import { roomBounds } from "./geometry";
import { luxToRgb } from "./false-color";

export interface PlanDrawBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Map world (m) coordinates into PDF mm box. */
export function worldToPlan(
  wx: number,
  wy: number,
  bounds: ReturnType<typeof roomBounds>,
  box: PlanDrawBox
): { x: number; y: number } {
  const pad = 4;
  const innerW = box.w - pad * 2;
  const innerH = box.h - pad * 2;
  const scale = Math.min(innerW / bounds.width, innerH / bounds.depth);
  const ox = box.x + pad + (innerW - bounds.width * scale) / 2;
  const oy = box.y + pad + (innerH - bounds.depth * scale) / 2;
  const x = ox + (wx - bounds.minX) * scale;
  const y = oy + (bounds.maxY - wy) * scale;
  return { x, y };
}

export function drawRoomPlanOnPdf(
  doc: jsPDF,
  room: RoomV2,
  instances: FixtureInstance[],
  box: PlanDrawBox
): void {
  const b = roomBounds(room);
  if (room.polygon.length < 2) return;

  doc.setDrawColor(40, 90, 120);
  doc.setLineWidth(0.35);
  const pts = room.polygon.map((p) => worldToPlan(p.x, p.y, b, box));
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    doc.line(a.x, a.y, c.x, c.y);
  }

  const roomInst = instances.filter((i) => i.roomId === room.id);
  doc.setFillColor(255, 200, 60);
  for (const inst of roomInst) {
    const p = worldToPlan(inst.position.x, inst.position.y, b, box);
    doc.circle(p.x, p.y, 1.2, "F");
  }
}

export function drawFalseColorOnPdf(
  doc: jsPDF,
  room: RoomV2,
  results: CalcResults,
  box: PlanDrawBox
): void {
  const b = roomBounds(room);
  const { grid } = results;
  const maxLux = Math.max(...grid.lux, results.summary.emax, 1);
  const cellW = (box.w - 4) / Math.max(grid.nx, 1);
  const cellH = (box.h - 4) / Math.max(grid.ny, 1);

  for (let j = 0; j < grid.ny; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const lux = grid.lux[j * grid.nx + i] ?? 0;
      const wx = b.minX + grid.originX + i * grid.spacing;
      const wy = b.minY + grid.originY + j * grid.spacing;
      const tl = worldToPlan(wx, wy + grid.spacing, b, box);
      const br = worldToPlan(wx + grid.spacing, wy, b, box);
      const [r, g, bch] = luxToRgb(lux, maxLux);
      doc.setFillColor(r * 255, g * 255, bch * 255);
      doc.rect(
        Math.min(tl.x, br.x),
        Math.min(tl.y, br.y),
        Math.max(cellW * 0.9, Math.abs(br.x - tl.x)),
        Math.max(cellH * 0.9, Math.abs(br.y - tl.y)),
        "F"
      );
    }
  }
}
