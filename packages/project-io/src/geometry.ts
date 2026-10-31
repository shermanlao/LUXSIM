import type { RoomV2, Vec2 } from "./types";

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 1e-12) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function roomBounds(room: RoomV2): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  depth: number;
} {
  const xs = room.polygon.map((p) => p.x);
  const ys = room.polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxY - minY),
  };
}

export function rectPolygon(
  x: number,
  y: number,
  w: number,
  d: number
): Vec2[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
}

export function findRoomAt(
  rooms: RoomV2[],
  storeyId: string,
  point: Vec2
): RoomV2 | null {
  for (const room of rooms) {
    if (room.storeyId !== storeyId) continue;
    if (pointInPolygon(point, room.polygon)) return room;
  }
  return null;
}

export function roomAreaM2(room: RoomV2): number {
  // Shoelace
  const p = room.polygon;
  if (p.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < p.length; i += 1) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export const CLOSE_START_TOL_M = 0.2;

export function translatePolygon(poly: Vec2[], dx: number, dy: number): Vec2[] {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function isCloseToStart(
  a: Vec2,
  start: Vec2,
  tolM: number = CLOSE_START_TOL_M
): boolean {
  return Math.hypot(a.x - start.x, a.y - start.y) <= tolM;
}

/** Project `cursor` onto the circle of `radiusM` around `origin`. */
export function pointOnCircle(origin: Vec2, radiusM: number, cursor: Vec2): Vec2 {
  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: origin.x + radiusM, y: origin.y };
  const s = radiusM / len;
  return { x: origin.x + dx * s, y: origin.y + dy * s };
}

/** Snap the segment origin→cursor to the nearer axis (0/90/180/270). */
export function orthoPoint(origin: Vec2, cursor: Vec2): Vec2 {
  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: cursor.x, y: origin.y };
  return { x: origin.x, y: cursor.y };
}

/** Four cardinal points on a circle; pick the one nearest the cursor. */
export function polarOrthoPoint(
  origin: Vec2,
  radiusM: number,
  cursor: Vec2
): Vec2 {
  const candidates: Vec2[] = [
    { x: origin.x + radiusM, y: origin.y },
    { x: origin.x - radiusM, y: origin.y },
    { x: origin.x, y: origin.y + radiusM },
    { x: origin.x, y: origin.y - radiusM },
  ];
  let best = candidates[0]!;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - cursor.x, c.y - cursor.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function resolveDraftPoint(
  origin: Vec2,
  cursor: Vec2,
  radiusM: number | null,
  ortho: boolean
): Vec2 {
  const locked = radiusM != null && radiusM > 0;
  if (locked && ortho) return polarOrthoPoint(origin, radiusM!, cursor);
  if (locked) return pointOnCircle(origin, radiusM!, cursor);
  if (ortho) return orthoPoint(origin, cursor);
  return cursor;
}
