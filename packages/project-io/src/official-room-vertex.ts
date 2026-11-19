import { DXF_CLOSED_ROOM_MIN_AREA_M2 } from "./official-dxf-closed-rooms";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfPointsCoincide,
} from "./official-dxf-polyline";
import { roomAreaM2 } from "./geometry";
import type { ProjectSceneV2, RoomV2, Vec2 } from "./types";

export type VertexStretchRejectReason = "degenerate-vertices" | "self-crossing" | "area";

export const VERTEX_STRETCH_REVERT_STATUS: Record<VertexStretchRejectReason, string> = {
  "degenerate-vertices":
    "Vertex stretch reverted: the room would have fewer than 3 unique corners.",
  "self-crossing": "Vertex stretch reverted: the room outline would cross itself.",
  area: "Vertex stretch reverted: the room area would be below 0.01 m².",
};

const COLINEAR_EPS = 1e-12;

/** Closed ring without a duplicated closing vertex. */
export function officialRoomRingVertices(polygon: Vec2[]): Vec2[] {
  if (
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!)
  ) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

function uniqueVertexCount(points: Vec2[], epsM = DXF_CLOSED_VERTEX_EPS_M): number {
  const unique: Vec2[] = [];
  for (const p of points) {
    if (!unique.some((q) => officialDxfPointsCoincide(p, q, epsM))) unique.push(p);
  }
  return unique.length;
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    p.x <= Math.max(a.x, b.x) + COLINEAR_EPS &&
    p.x >= Math.min(a.x, b.x) - COLINEAR_EPS &&
    p.y <= Math.max(a.y, b.y) + COLINEAR_EPS &&
    p.y >= Math.min(a.y, b.y) - COLINEAR_EPS
  );
}

/**
 * True when ab and cd share a proper interior intersection, including a
 * collinear overlap that is more than a shared endpoint.
 */
export function officialSegmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  const abLen = Math.hypot(b.x - a.x, b.y - a.y);
  const cdLen = Math.hypot(d.x - c.x, d.y - c.y);
  const eps = COLINEAR_EPS * Math.max(1, abLen, cdLen);

  if (
    (o1 > eps && o2 < -eps && o3 > eps && o4 < -eps) ||
    (o1 < -eps && o2 > eps && o3 < -eps && o4 > eps) ||
    (o1 > eps && o2 < -eps && o3 < -eps && o4 > eps) ||
    (o1 < -eps && o2 > eps && o3 > eps && o4 < -eps)
  ) {
    return true;
  }

  const cOnAb = Math.abs(o1) <= eps && onSegment(a, b, c);
  const dOnAb = Math.abs(o2) <= eps && onSegment(a, b, d);
  const aOnCd = Math.abs(o3) <= eps && onSegment(c, d, a);
  const bOnCd = Math.abs(o4) <= eps && onSegment(c, d, b);
  if (!(cOnAb || dOnAb || aOnCd || bOnCd)) return false;

  const sharesOnlyEndpoint =
    officialDxfPointsCoincide(a, c) ||
    officialDxfPointsCoincide(a, d) ||
    officialDxfPointsCoincide(b, c) ||
    officialDxfPointsCoincide(b, d);
  if (sharesOnlyEndpoint && !((cOnAb && dOnAb) || (aOnCd && bOnCd))) {
    // A single shared endpoint, or a T-touch at an endpoint, is not a crossing.
    const interiorTouch =
      (cOnAb && !officialDxfPointsCoincide(c, a) && !officialDxfPointsCoincide(c, b)) ||
      (dOnAb && !officialDxfPointsCoincide(d, a) && !officialDxfPointsCoincide(d, b)) ||
      (aOnCd && !officialDxfPointsCoincide(a, c) && !officialDxfPointsCoincide(a, d)) ||
      (bOnCd && !officialDxfPointsCoincide(b, c) && !officialDxfPointsCoincide(b, d));
    return interiorTouch;
  }
  return (cOnAb && dOnAb) || (aOnCd && bOnCd) || (!sharesOnlyEndpoint && (cOnAb || dOnAb || aOnCd || bOnCd));
}

/** True when non-adjacent edges of the closed ring cross or overlap. */
export function officialRoomPolygonSelfIntersects(polygon: Vec2[]): boolean {
  const ring = officialRoomRingVertices(polygon);
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;
      const c = ring[j]!;
      const d = ring[(j + 1) % n]!;
      if (officialSegmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export type VertexStretchValidation =
  | { ok: true }
  | { ok: false; reason: VertexStretchRejectReason };

export function validateStretchedRoomPolygon(polygon: Vec2[]): VertexStretchValidation {
  const ring = officialRoomRingVertices(polygon);
  if (ring.length < 3 || uniqueVertexCount(ring) < 3) {
    return { ok: false, reason: "degenerate-vertices" };
  }
  if (officialRoomPolygonSelfIntersects(polygon)) {
    return { ok: false, reason: "self-crossing" };
  }
  if (roomAreaM2({ polygon: ring } as RoomV2) < DXF_CLOSED_ROOM_MIN_AREA_M2) {
    return { ok: false, reason: "area" };
  }
  return { ok: true };
}

/**
 * Move one vertex in official world XY. The rest of the ring stays put.
 * If the stored polygon repeats the first point as a closing vertex, moving
 * either end keeps both ends coincident.
 */
export function moveRoomVertex(polygon: Vec2[], index: number, point: Vec2): Vec2[] {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= polygon.length ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return polygon.map((p) => ({ x: p.x, y: p.y }));
  }
  const next = polygon.map((p, i) => (i === index ? { x: point.x, y: point.y } : { x: p.x, y: p.y }));
  if (
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!) &&
    (index === 0 || index === polygon.length - 1)
  ) {
    next[0] = { x: point.x, y: point.y };
    next[next.length - 1] = { x: point.x, y: point.y };
  }
  return next;
}

export type CommitStretchedRoomPolygonResult = {
  polygon: Vec2[];
  reverted: boolean;
  status?: string;
};

export function commitStretchedRoomPolygon(
  original: Vec2[],
  next: Vec2[]
): CommitStretchedRoomPolygonResult {
  const check = validateStretchedRoomPolygon(next);
  if (!check.ok) {
    return {
      polygon: original.map((p) => ({ x: p.x, y: p.y })),
      reverted: true,
      status: VERTEX_STRETCH_REVERT_STATUS[check.reason],
    };
  }
  return { polygon: next.map((p) => ({ x: p.x, y: p.y })), reverted: false };
}

/**
 * Replace one room's official floor polygon. Other rooms, fixtures, underlays,
 * and storey metrics are left unchanged. Does not clear calculation results
 * (same policy as officialTranslateRoom).
 */
export function officialSetRoomPolygon(
  scene: ProjectSceneV2,
  roomId: string,
  polygon: Vec2[]
): ProjectSceneV2 {
  if (!scene.rooms.some((room) => room.id === roomId)) return scene;
  return {
    ...scene,
    rooms: scene.rooms.map((room) =>
      room.id === roomId
        ? { ...room, polygon: polygon.map((p) => ({ x: p.x, y: p.y })) }
        : room
    ),
  };
}

export function officialStretchRoomVertex(
  scene: ProjectSceneV2,
  roomId: string,
  vertexIndex: number,
  point: Vec2
): ProjectSceneV2 {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) return scene;
  return officialSetRoomPolygon(scene, roomId, moveRoomVertex(room.polygon, vertexIndex, point));
}

export function officialClosestPointOnSegment(a: Vec2, b: Vec2, p: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export type OfficialRoomEdge = {
  edgeIndex: number;
  a: Vec2;
  b: Vec2;
};

/** Closed-ring edges, including the closing edge, with no duplicated first-vertex edge. */
export function officialRoomEdges(polygon: Vec2[]): OfficialRoomEdge[] {
  const ring = officialRoomRingVertices(polygon);
  const n = ring.length;
  const edges: OfficialRoomEdge[] = [];
  for (let i = 0; i < n; i++) {
    edges.push({ edgeIndex: i, a: ring[i]!, b: ring[(i + 1) % n]! });
  }
  return edges;
}

export function canInsertRoomVertex(polygon: Vec2[], edgeIndex: number, point: Vec2): boolean {
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const ring = officialRoomRingVertices(polygon);
  if (edgeIndex >= ring.length) return false;
  const a = ring[edgeIndex]!;
  const b = ring[(edgeIndex + 1) % ring.length]!;
  if (officialDxfPointsCoincide(a, b)) return false;
  if (officialDxfPointsCoincide(point, a) || officialDxfPointsCoincide(point, b)) return false;
  return true;
}

/**
 * Insert a vertex on the given open edge (including the closing edge of a
 * closed ring). Zero-length edges and points coincident with either endpoint
 * within DXF_CLOSED_VERTEX_EPS_M are a no-op and return a copy of the input.
 * A duplicated closing vertex, if present, stays coincident with the first.
 */
export function insertRoomVertex(polygon: Vec2[], edgeIndex: number, point: Vec2): Vec2[] {
  const copy = polygon.map((p) => ({ x: p.x, y: p.y }));
  if (!canInsertRoomVertex(polygon, edgeIndex, point)) return copy;
  const closed =
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!);
  const ring = officialRoomRingVertices(polygon).map((p) => ({ x: p.x, y: p.y }));
  ring.splice(edgeIndex + 1, 0, { x: point.x, y: point.y });
  if (closed && ring[0]) {
    ring.push({ x: ring[0].x, y: ring[0].y });
  }
  return ring;
}

export type OfficialEdgeInsert = {
  polygon: Vec2[];
  vertexIndex: number;
  point: Vec2;
};

/**
 * Choose the official insert point on an edge: a DXF object-snap landing when
 * one is supplied, otherwise the closest point on the segment to the pointer.
 * Returns null when the edge is zero-length or the point would coincide with
 * either endpoint (a no-op).
 */
export function resolveOfficialEdgeInsert(
  polygon: Vec2[],
  edgeIndex: number,
  pointer: Vec2,
  snappedPoint?: Vec2 | null
): OfficialEdgeInsert | null {
  const ring = officialRoomRingVertices(polygon);
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= ring.length) return null;
  const a = ring[edgeIndex]!;
  const b = ring[(edgeIndex + 1) % ring.length]!;
  const useSnap =
    snappedPoint != null && Number.isFinite(snappedPoint.x) && Number.isFinite(snappedPoint.y);
  const candidate = useSnap
    ? { x: snappedPoint.x, y: snappedPoint.y }
    : officialClosestPointOnSegment(a, b, pointer);
  if (!canInsertRoomVertex(polygon, edgeIndex, candidate)) return null;
  return {
    polygon: insertRoomVertex(polygon, edgeIndex, candidate),
    vertexIndex: edgeIndex + 1,
    point: candidate,
  };
}

export function officialInsertRoomVertex(
  scene: ProjectSceneV2,
  roomId: string,
  edgeIndex: number,
  point: Vec2
): ProjectSceneV2 {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) return scene;
  return officialSetRoomPolygon(scene, roomId, insertRoomVertex(room.polygon, edgeIndex, point));
}

export const VERTEX_DELETE_REFUSE_STATUS: Record<VertexStretchRejectReason, string> = {
  "degenerate-vertices":
    "Vertex delete refused: the room would have fewer than 3 unique corners.",
  "self-crossing": "Vertex delete refused: the room outline would cross itself.",
  area: "Vertex delete refused: the room area would be below 0.01 m².",
};

export const VERTEX_DELETE_NO_TARGET_STATUS =
  "Hover or click a corner handle, then press Delete or Backspace to remove that vertex.";

export function canDeleteRoomVertex(polygon: Vec2[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  const ring = officialRoomRingVertices(polygon);
  return index < ring.length;
}

/**
 * Remove one ring vertex. A duplicated closing vertex, if present, is dropped
 * first, then the target is removed, then the same official ring representation
 * used by insert/stretch is restored (a closing duplicate is rewritten only
 * when the input had one).
 */
export function deleteRoomVertex(polygon: Vec2[], index: number): Vec2[] {
  const copy = polygon.map((p) => ({ x: p.x, y: p.y }));
  if (!canDeleteRoomVertex(polygon, index)) return copy;
  const closed =
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!);
  const ring = officialRoomRingVertices(polygon).map((p) => ({ x: p.x, y: p.y }));
  ring.splice(index, 1);
  if (closed && ring[0]) {
    ring.push({ x: ring[0].x, y: ring[0].y });
  }
  return ring;
}

export function commitDeletedRoomPolygon(
  original: Vec2[],
  next: Vec2[]
): CommitStretchedRoomPolygonResult {
  const check = validateStretchedRoomPolygon(next);
  if (!check.ok) {
    return {
      polygon: original.map((p) => ({ x: p.x, y: p.y })),
      reverted: true,
      status: VERTEX_DELETE_REFUSE_STATUS[check.reason],
    };
  }
  return { polygon: next.map((p) => ({ x: p.x, y: p.y })), reverted: false };
}

export function officialDeleteRoomVertex(
  scene: ProjectSceneV2,
  roomId: string,
  vertexIndex: number
): ProjectSceneV2 {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) return scene;
  return officialSetRoomPolygon(scene, roomId, deleteRoomVertex(room.polygon, vertexIndex));
}
