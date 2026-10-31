import type { DxfEntity, Vec2 } from "./types";

/**
 * Minimal DXF LINE / LWPOLYLINE extractor (ASCII DXF).
 * Avoids heavy deps for common plan underlays.
 */
export function parseDxfEntities(text: string): DxfEntity[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entities: DxfEntity[] = [];
  let i = 0;

  const readPair = (): { code: number; value: string } | null => {
    if (i + 1 >= lines.length) return null;
    const code = Number(lines[i++]!.trim());
    const value = lines[i++] ?? "";
    if (!Number.isFinite(code)) return null;
    return { code, value: value.trim() };
  };

  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code !== 0) continue;
    const type = pair.value.toUpperCase();

    if (type === "LINE") {
      let x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0;
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
          i -= 2;
          break;
        }
        if (p.code === 10) x1 = Number(p.value);
        if (p.code === 20) y1 = Number(p.value);
        if (p.code === 11) x2 = Number(p.value);
        if (p.code === 21) y2 = Number(p.value);
      }
      entities.push({
        type: "line",
        points: [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ],
      });
    } else if (type === "LWPOLYLINE") {
      const pts: Vec2[] = [];
      let x: number | null = null;
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
          i -= 2;
          break;
        }
        if (p.code === 10) x = Number(p.value);
        if (p.code === 20 && x != null) {
          pts.push({ x, y: Number(p.value) });
          x = null;
        }
      }
      if (pts.length >= 2) entities.push({ type: "polyline", points: pts });
    }
  }

  return entities;
}

export function dxfBounds(entities: DxfEntity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const pts = entities.flatMap((e) => e.points);
  if (!pts.length) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
