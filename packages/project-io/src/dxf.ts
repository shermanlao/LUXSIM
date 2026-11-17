import type { DxfEntity, Vec2 } from "./types";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";

/**
 * Tessellation rule for CIRCLE, ARC, and POLYLINE / LWPOLYLINE bulge arcs:
 * 48 segments per full turn (2π). An open arc or bulge uses
 * max(2, round(48 × |sweep| / 2π)), capped at 48.
 * The count is angle-based (not radius-based) so the same angular
 * accuracy holds whether the DXF is in metres or millimetres.
 * Sagitta is about 0.21% of radius (≈ 21 mm on a 10 m radius),
 * dense enough for lighting rooms without flooding Top/3D.
 */
export const DXF_CURVE_SEGMENTS_PER_TURN = 48;

const TAU = Math.PI * 2;

export function dxfCurveSegmentCount(sweepRad: number): number {
  const sweep = Math.abs(sweepRad);
  if (!(sweep > 0) || !Number.isFinite(sweep)) return 0;
  const n = Math.round((DXF_CURVE_SEGMENTS_PER_TURN * sweep) / TAU);
  return Math.max(2, Math.min(DXF_CURVE_SEGMENTS_PER_TURN, n));
}

/** DXF ARC / CIRCLE convention: angles in degrees, drawn CCW. Equal angles mean a full circle. */
export function dxfCcwSweepRad(startDeg: number, endDeg: number): {
  startRad: number;
  sweepRad: number;
} {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  if (!Number.isFinite(startRad) || !Number.isFinite(endRad)) {
    return { startRad: 0, sweepRad: 0 };
  }
  let sweepRad = endRad - startRad;
  while (sweepRad <= 0) sweepRad += TAU;
  if (sweepRad > TAU) sweepRad = TAU;
  return { startRad, sweepRad };
}

function pointOnCircle(cx: number, cy: number, r: number, angleRad: number): Vec2 {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function tessellateCircle(cx: number, cy: number, r: number, startRad = 0): Vec2[] {
  const n = DXF_CURVE_SEGMENTS_PER_TURN;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    pts.push(pointOnCircle(cx, cy, r, startRad + (TAU * i) / n));
  }
  return pts;
}

function tessellateOpenArc(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  sweepRad: number
): Vec2[] {
  const n = dxfCurveSegmentCount(sweepRad);
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(pointOnCircle(cx, cy, r, startRad + (sweepRad * i) / n));
  }
  return pts;
}

/**
 * Intermediate vertices along a POLYLINE or LWPOLYLINE bulge (group 42).
 * Bulge = tan(included angle / 4); positive is CCW, negative is CW.
 * Endpoints are omitted — the caller already has the VERTEX points.
 */
export function tessellateDxfBulgeIntermediates(a: Vec2, b: Vec2, bulge: number): Vec2[] {
  if (!Number.isFinite(bulge) || bulge === 0) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (!(chord > 0)) return [];
  const theta = 4 * Math.atan(bulge);
  const n = dxfCurveSegmentCount(theta);
  if (n < 2) return [];
  const cotbce = (1 / bulge - bulge) / 2;
  const cx = (a.x + b.x - dy * cotbce) / 2;
  const cy = (a.y + b.y + dx * cotbce) / 2;
  const startRad = Math.atan2(a.y - cy, a.x - cx);
  const r = Math.hypot(a.x - cx, a.y - cy);
  if (!(r > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return [];
  const mid: Vec2[] = [];
  for (let i = 1; i < n; i++) {
    mid.push(pointOnCircle(cx, cy, r, startRad + (theta * i) / n));
  }
  return mid;
}

type PolyVertex = { x: number; y: number; bulge: number };

function polylineFromVertices(verts: PolyVertex[], closedByFlag: boolean): DxfEntity | null {
  if (verts.length < 2) return null;
  const closedByCoincide = officialDxfPointsCoincide(verts[0]!, verts[verts.length - 1]!);
  const closed = closedByFlag || closedByCoincide;
  const ring = closedByCoincide ? verts.slice(0, -1) : verts;
  if (ring.length < 2) return null;
  const points: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]!;
    points.push({ x: cur.x, y: cur.y });
    const isLast = i === ring.length - 1;
    if (isLast && !closed) break;
    const next = ring[(i + 1) % ring.length]!;
    points.push(...tessellateDxfBulgeIntermediates(cur, next, cur.bulge));
  }
  if (points.length < 2) return null;
  const entity: DxfEntity = { type: "polyline", points };
  if (closed) entity.closed = true;
  return entity;
}

function closedPolylineEntity(points: Vec2[]): DxfEntity | null {
  if (points.length < 2) return null;
  return { type: "polyline", points, closed: true };
}

function openPolylineEntity(points: Vec2[]): DxfEntity | null {
  if (points.length < 2) return null;
  return { type: "polyline", points };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Minimal ASCII DXF extractor for LINE, LWPOLYLINE (including group-42 bulges),
 * CIRCLE, ARC, and old-style POLYLINE (VERTEX + SEQEND, including the closed
 * flag and bulges). Curves are tessellated into official planar polyline segments.
 * Paperspace / 3D extrusion are not handled (same as the previous parser).
 * Polygon-mesh and polyface-mesh POLYLINE entities are skipped.
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

  const unreadPair = () => {
    i -= 2;
  };

  /** Read groups until the next entity (code 0), leaving that pair unread. */
  const readGroups = (onGroup: (code: number, value: string) => void) => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code === 0) {
        unreadPair();
        break;
      }
      onGroup(p.code, p.value);
    }
  };

  const skipUntilSeqend = () => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code !== 0) continue;
      const t = p.value.toUpperCase();
      if (t === "SEQEND") {
        readGroups(() => {});
        break;
      }
    }
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
      readGroups((code, value) => {
        if (code === 10) x1 = Number(value);
        if (code === 20) y1 = Number(value);
        if (code === 11) x2 = Number(value);
        if (code === 21) y2 = Number(value);
      });
      entities.push({
        type: "line",
        points: [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ],
      });
    } else if (type === "LWPOLYLINE") {
      const verts: PolyVertex[] = [];
      let pending: { x?: number; y?: number; bulge: number } | null = null;
      let flags = 0;
      const flushPending = () => {
        if (
          pending &&
          pending.x != null &&
          pending.y != null &&
          isFiniteNumber(pending.x) &&
          isFiniteNumber(pending.y)
        ) {
          verts.push({
            x: pending.x,
            y: pending.y,
            bulge: isFiniteNumber(pending.bulge) ? pending.bulge : 0,
          });
        }
        pending = null;
      };
      readGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 10) {
          flushPending();
          pending = { x: Number(value), bulge: 0 };
        }
        if (code === 20 && pending) pending.y = Number(value);
        if (code === 42) {
          const bulge = Number(value);
          if (pending) pending.bulge = isFiniteNumber(bulge) ? bulge : 0;
        }
      });
      flushPending();
      const closedByFlag = Number.isFinite(flags) && (flags & 1) === 1;
      const entity = polylineFromVertices(verts, closedByFlag);
      if (entity) entities.push(entity);
    } else if (type === "CIRCLE") {
      let cx = 0,
        cy = 0,
        r = 0;
      readGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 40) r = Number(value);
      });
      if (isFiniteNumber(cx) && isFiniteNumber(cy) && isFiniteNumber(r) && r > 0) {
        const entity = closedPolylineEntity(tessellateCircle(cx, cy, r));
        if (entity) entities.push(entity);
      }
    } else if (type === "ARC") {
      let cx = 0,
        cy = 0,
        r = 0,
        startDeg = 0,
        endDeg = 0;
      readGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 40) r = Number(value);
        if (code === 50) startDeg = Number(value);
        if (code === 51) endDeg = Number(value);
      });
      if (
        isFiniteNumber(cx) &&
        isFiniteNumber(cy) &&
        isFiniteNumber(r) &&
        r > 0 &&
        isFiniteNumber(startDeg) &&
        isFiniteNumber(endDeg)
      ) {
        const { startRad, sweepRad } = dxfCcwSweepRad(startDeg, endDeg);
        if (sweepRad > 0) {
          const full = Math.abs(sweepRad - TAU) < 1e-12;
          const entity = full
            ? closedPolylineEntity(tessellateCircle(cx, cy, r, startRad))
            : openPolylineEntity(tessellateOpenArc(cx, cy, r, startRad, sweepRad));
          if (entity) entities.push(entity);
        }
      }
    } else if (type === "POLYLINE") {
      let flags = 0;
      readGroups((code, value) => {
        if (code === 70) flags = Number(value);
      });
      const isMesh = Number.isFinite(flags) && ((flags & 16) === 16 || (flags & 64) === 64);
      const closedByFlag = Number.isFinite(flags) && (flags & 1) === 1;
      if (isMesh) {
        skipUntilSeqend();
        continue;
      }
      const verts: PolyVertex[] = [];
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code !== 0) continue;
        const t = p.value.toUpperCase();
        if (t === "VERTEX") {
          let x = 0,
            y = 0,
            bulge = 0;
          readGroups((code, value) => {
            if (code === 10) x = Number(value);
            if (code === 20) y = Number(value);
            if (code === 42) bulge = Number(value);
          });
          if (isFiniteNumber(x) && isFiniteNumber(y)) {
            verts.push({
              x,
              y,
              bulge: isFiniteNumber(bulge) ? bulge : 0,
            });
          }
        } else if (t === "SEQEND") {
          readGroups(() => {});
          break;
        } else {
          unreadPair();
          break;
        }
      }
      const entity = polylineFromVertices(verts, closedByFlag);
      if (entity) entities.push(entity);
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
