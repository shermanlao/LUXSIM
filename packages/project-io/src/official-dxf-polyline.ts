import type { DxfEntity, Vec2 } from "./types";

/** Tight metre epsilon for first==last closed detection and vertex matching. */
export const DXF_CLOSED_VERTEX_EPS_M = 1e-6;

export function officialDxfPointsCoincide(
  a: Vec2,
  b: Vec2,
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsM;
}

/**
 * A polyline is closed when the LWPOLYLINE closed flag was set, or when the
 * first and last vertices coincide within DXF_CLOSED_VERTEX_EPS_M. After the
 * official entity→world mapping, that coincidence check is a tight metre
 * epsilon. LINE entities stay open — no invented closing edge.
 */
export function officialDxfPolylineClosed(
  entity: Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }
): boolean {
  if (entity.type === "line") return false;
  if (entity.closed === true) return true;
  const pts = entity.points;
  if (pts.length < 2) return false;
  return officialDxfPointsCoincide(pts[0]!, pts[pts.length - 1]!);
}

/**
 * Ring vertices of a closed polyline, without a duplicate closing vertex and
 * without consecutive coincident points. Open entities return null.
 */
export function officialDxfClosedRingVertices(
  entity: Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }
): Vec2[] | null {
  if (!officialDxfPolylineClosed(entity)) return null;
  const pts = entity.points;
  if (pts.length < 2) return null;
  const dropClose = officialDxfPointsCoincide(pts[0]!, pts[pts.length - 1]!);
  const ring: Vec2[] = [];
  const end = dropClose ? pts.length - 1 : pts.length;
  for (let i = 0; i < end; i++) {
    const p = pts[i]!;
    const prev = ring[ring.length - 1];
    if (prev && officialDxfPointsCoincide(prev, p)) continue;
    ring.push({ x: p.x, y: p.y });
  }
  if (
    ring.length >= 2 &&
    officialDxfPointsCoincide(ring[0]!, ring[ring.length - 1]!)
  ) {
    ring.pop();
  }
  return ring.length >= 2 ? ring : null;
}

/**
 * Stroke points for the official display path. Closed polylines append the
 * first vertex so the official closing segment is drawn. Open polylines are
 * unchanged — no invented closing edge.
 */
export function officialDxfPolylineStrokePoints(
  entity: Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }
): Vec2[] {
  if (!officialDxfPolylineClosed(entity) || entity.points.length < 2) {
    return entity.points;
  }
  const ring = officialDxfClosedRingVertices(entity);
  if (!ring || ring.length < 2) return entity.points;
  return [...ring, { x: ring[0]!.x, y: ring[0]!.y }];
}

/**
 * Displayed segments used by object snap. Closed polylines include the
 * official closing segment; open LINE / LWPOLYLINE paths do not.
 */
export function officialDxfEntitySegments(
  entity: Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }
): [Vec2, Vec2][] {
  const stroke = officialDxfPolylineStrokePoints(entity);
  const segs: [Vec2, Vec2][] = [];
  for (let i = 0; i < stroke.length - 1; i++) {
    const a = stroke[i]!;
    const b = stroke[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 0) segs.push([a, b]);
  }
  return segs;
}
