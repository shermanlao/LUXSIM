import type { DxfEntity, Vec2 } from "./types";
import { officialDxfLayerName } from "./official-dxf-layers";

/**
 * Official conservative compress tolerance in world metres (1.5 mm).
 * Used after extracting the visible CAD layers so a dense RCP can be
 * drawn and snapped without over-simplifying walls or a room-trace outline.
 */
export const OFFICIAL_CAD_COMPRESS_TOL_M = 0.0015;

function finitePoint(p: Vec2): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function pointsEqual(a: Vec2, b: Vec2, tolM: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolM;
}

function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-24) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function dedupeConsecutive(points: Vec2[], tolM: number, closed: boolean): Vec2[] {
  if (points.length === 0) return [];
  const out: Vec2[] = [];
  for (const p of points) {
    if (!finitePoint(p)) continue;
    const last = out[out.length - 1];
    if (last && pointsEqual(last, p, tolM)) continue;
    out.push({ x: p.x, y: p.y });
  }
  if (closed && out.length >= 2 && pointsEqual(out[0]!, out[out.length - 1]!, tolM)) {
    out.pop();
  }
  return out;
}

function simplifyCollinear(points: Vec2[], closed: boolean, tolM: number): Vec2[] {
  const src = dedupeConsecutive(points, tolM, closed);
  if (src.length <= 2) return src;
  const out: Vec2[] = [];
  const n = src.length;
  const count = closed ? n : n;
  for (let i = 0; i < count; i++) {
    const prev = closed ? src[(i - 1 + n) % n]! : i === 0 ? null : src[i - 1]!;
    const cur = src[i]!;
    const next = closed ? src[(i + 1) % n]! : i === n - 1 ? null : src[i + 1]!;
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(cur);
      continue;
    }
    if (prev && next && pointToSegmentDistance(cur, prev, next) <= tolM) {
      continue;
    }
    out.push(cur);
  }
  if (closed && out.length < 3) return src;
  return out.length >= 2 || (!closed && out.length >= 1) ? out : src;
}

function segmentKey(a: Vec2, b: Vec2, tolM: number): string {
  const qx = (p: Vec2) => Math.round(p.x / tolM);
  const qy = (p: Vec2) => Math.round(p.y / tolM);
  const aKey = `${qx(a)},${qy(a)}`;
  const bKey = `${qx(b)},${qy(b)}`;
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function simplifyEntity(entity: DxfEntity, tolM: number): DxfEntity | null {
  const closed = entity.closed === true;
  const points = simplifyCollinear(entity.points, closed, tolM);
  if (points.length < 2) return null;
  const next: DxfEntity = {
    type: points.length === 2 && !closed ? "line" : entity.type,
    points,
  };
  if (closed) next.closed = true;
  if (entity.layer) next.layer = officialDxfLayerName(entity.layer);
  return next;
}

/**
 * Conservative official compressor: drop nearly duplicate vertices, merge
 * near-collinear intermediates, and drop obviously duplicate overlapping
 * 2-point segments. Tolerance is in world metres.
 */
export function officialCompressCadEntities(
  entities: DxfEntity[],
  tolM = OFFICIAL_CAD_COMPRESS_TOL_M
): DxfEntity[] {
  const tolerance = tolM > 0 && Number.isFinite(tolM) ? tolM : OFFICIAL_CAD_COMPRESS_TOL_M;
  const simplified: DxfEntity[] = [];
  for (const entity of entities) {
    const next = simplifyEntity(entity, tolerance);
    if (next) simplified.push(next);
  }

  const seen = new Set<string>();
  const out: DxfEntity[] = [];
  for (const entity of simplified) {
    const closed = entity.closed === true;
    if (!closed && entity.points.length === 2) {
      const key = `${officialDxfLayerName(entity.layer)}:${segmentKey(entity.points[0]!, entity.points[1]!, tolerance)}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(entity);
  }
  return out;
}

export function officialCadEntityPointCount(entities: Array<Pick<DxfEntity, "points">>): number {
  return entities.reduce((sum, entity) => sum + entity.points.length, 0);
}
