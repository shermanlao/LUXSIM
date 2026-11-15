import {
  officialClosestPointOnSegment,
  officialDxfPointsCoincide,
  officialRoomEdges,
  officialRoomRingVertices,
} from "@luxsim/project-io";
import { DXF_OBJECT_SNAP_CSS_PX, dxfObjectSnapRadiusM } from "@/lib/official-dxf-object-snap";
import { ROOM_DRAG_ENABLED, type RoomDragBeginInput } from "@/lib/room-drag";
import type { Vec2 } from "@luxsim/project-io";

/** Official vertex-handle aperture: the same 8 CSS pixels as DXF object snap. */
export const VERTEX_HANDLE_CSS_PX = DXF_OBJECT_SNAP_CSS_PX;

export type SetRoomPolygonHandler = (
  roomId: string,
  polygon: Vec2[],
  opts?: { discrete?: boolean }
) => void;

export type VertexStretchBeginInput = RoomDragBeginInput & {
  handleIndex?: number | null;
  onSetRoomPolygon?: SetRoomPolygonHandler;
};

export type EdgeInsertBeginInput = RoomDragBeginInput & {
  edgeIndex?: number | null;
  onSetRoomPolygon?: SetRoomPolygonHandler;
};

export type RoomEdgeInsertHit = {
  edgeIndex: number;
  point: Vec2;
};

export type RoomOutlineEditHit =
  | { kind: "vertex"; index: number }
  | { kind: "edge-insert"; edgeIndex: number; point: Vec2 };

/** World-metre handle radius for 8 CSS pixels at the current plan zoom. */
export function vertexHandleRadiusM(metresPerCssPx: number): number {
  return dxfObjectSnapRadiusM(metresPerCssPx);
}

/**
 * Closest ring vertex within the official handle aperture, or null.
 * A closing duplicate of the first vertex is not a second handle.
 */
export function hitRoomVertexHandle(
  pointer: Vec2,
  polygon: Vec2[],
  radiusM: number
): number | null {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) return null;
  const ring = officialRoomRingVertices(polygon);
  let best: { index: number; distanceM: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const distanceM = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    if (distanceM > radiusM) continue;
    if (!best || distanceM < best.distanceM) best = { index: i, distanceM };
  }
  return best ? best.index : null;
}

/**
 * Closest open edge within the official 8 CSS-pixel aperture, or null.
 * The closing edge of a closed ring counts as one edge. Zero-length edges
 * are skipped. A margin of `radiusM` around each endpoint is excluded so a
 * mid-edge hit cannot steal a corner handle.
 */
export function hitRoomEdgeInsert(
  pointer: Vec2,
  polygon: Vec2[],
  radiusM: number
): RoomEdgeInsertHit | null {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) return null;
  let best: { edgeIndex: number; point: Vec2; distanceM: number } | null = null;
  for (const edge of officialRoomEdges(polygon)) {
    if (officialDxfPointsCoincide(edge.a, edge.b)) continue;
    const point = officialClosestPointOnSegment(edge.a, edge.b, pointer);
    if (officialDxfPointsCoincide(point, edge.a) || officialDxfPointsCoincide(point, edge.b)) {
      continue;
    }
    const fromA = Math.hypot(point.x - edge.a.x, point.y - edge.a.y);
    const fromB = Math.hypot(point.x - edge.b.x, point.y - edge.b.y);
    if (fromA <= radiusM || fromB <= radiusM) continue;
    const distanceM = Math.hypot(point.x - pointer.x, point.y - pointer.y);
    if (distanceM > radiusM) continue;
    if (!best || distanceM < best.distanceM) {
      best = { edgeIndex: edge.edgeIndex, point, distanceM };
    }
  }
  return best ? { edgeIndex: best.edgeIndex, point: best.point } : null;
}

/**
 * Corner handle (8 CSS px) wins over mid-edge insert, which is a separate
 * hit from whole-room interior drag.
 */
export function hitRoomOutlineEdit(
  pointer: Vec2,
  polygon: Vec2[],
  radiusM: number
): RoomOutlineEditHit | null {
  const vertex = hitRoomVertexHandle(pointer, polygon, radiusM);
  if (vertex != null) return { kind: "vertex", index: vertex };
  const edge = hitRoomEdgeInsert(pointer, polygon, radiusM);
  if (edge) return { kind: "edge-insert", edgeIndex: edge.edgeIndex, point: edge.point };
  return null;
}

/** Mid-edge affordances whose midpoints sit outside the corner-handle margin. */
export function roomEdgeInsertAffordances(
  polygon: Vec2[],
  radiusM: number
): Array<{ edgeIndex: number; a: Vec2; b: Vec2; mid: Vec2 }> {
  const out: Array<{ edgeIndex: number; a: Vec2; b: Vec2; mid: Vec2 }> = [];
  for (const edge of officialRoomEdges(polygon)) {
    if (officialDxfPointsCoincide(edge.a, edge.b)) continue;
    const mid = {
      x: (edge.a.x + edge.b.x) / 2,
      y: (edge.a.y + edge.b.y) / 2,
    };
    if (officialDxfPointsCoincide(mid, edge.a) || officialDxfPointsCoincide(mid, edge.b)) continue;
    if (Number.isFinite(radiusM) && radiusM > 0) {
      const fromA = Math.hypot(mid.x - edge.a.x, mid.y - edge.a.y);
      const fromB = Math.hypot(mid.x - edge.b.x, mid.y - edge.b.y);
      if (fromA <= radiusM || fromB <= radiusM) continue;
    }
    out.push({ edgeIndex: edge.edgeIndex, a: edge.a, b: edge.b, mid });
  }
  return out;
}

/**
 * Begin a vertex stretch only with Select, a set-polygon handler, a handle
 * hit, and no active Draw room, calibrate, or array pick.
 */
export function shouldBeginVertexStretch(input: VertexStretchBeginInput = {}): boolean {
  return (
    ROOM_DRAG_ENABLED &&
    typeof input.onSetRoomPolygon === "function" &&
    input.tool === "select" &&
    !input.drawing &&
    !input.calibrating &&
    !input.linePickActive &&
    !input.circlePickActive &&
    !input.polygonPickActive &&
    input.handleIndex != null &&
    Number.isInteger(input.handleIndex) &&
    input.handleIndex >= 0
  );
}

/**
 * Begin a mid-edge insert only with Select, a set-polygon handler, an edge
 * hit, and no active Draw room, calibrate, or array pick.
 */
export function shouldBeginEdgeInsert(input: EdgeInsertBeginInput = {}): boolean {
  return (
    ROOM_DRAG_ENABLED &&
    typeof input.onSetRoomPolygon === "function" &&
    input.tool === "select" &&
    !input.drawing &&
    !input.calibrating &&
    !input.linePickActive &&
    !input.circlePickActive &&
    !input.polygonPickActive &&
    input.edgeIndex != null &&
    Number.isInteger(input.edgeIndex) &&
    input.edgeIndex >= 0
  );
}

export type VertexDeleteKeyInput = {
  key?: string;
  tool?: string | null;
  drawing?: boolean;
  calibrating?: boolean;
  linePickActive?: boolean;
  circlePickActive?: boolean;
  polygonPickActive?: boolean;
  stretching?: boolean;
};

/**
 * Official delete keys: Delete, and Backspace when no draw-room draft is
 * active. Draw-room Backspace must win whenever a draft is in progress, so
 * this returns "pass" whenever `drawing` is true.
 */
export function officialVertexDeleteKeyAction(
  input: VertexDeleteKeyInput = {}
): "delete" | "pass" {
  if (input.drawing) return "pass";
  if (input.key !== "Delete" && input.key !== "Backspace") return "pass";
  if (input.tool !== "select") return "pass";
  if (input.calibrating) return "pass";
  if (input.linePickActive || input.circlePickActive || input.polygonPickActive) return "pass";
  if (input.stretching) return "pass";
  return "delete";
}

export type ResolveVertexDeleteTargetInput = {
  pointer?: Vec2 | null;
  polygon: Vec2[];
  radiusM: number;
  activeVertexIndex?: number | null;
};

/**
 * Hovered corner handle (8 CSS px) wins; otherwise a previously click-selected
 * active vertex. A mid-edge affordance is never a delete target.
 */
export function resolveVertexDeleteTarget(
  input: ResolveVertexDeleteTargetInput
): number | null {
  const pointer = input.pointer;
  const hover =
    pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)
      ? hitRoomVertexHandle(pointer, input.polygon, input.radiusM)
      : null;
  if (hover != null) return hover;
  const active = input.activeVertexIndex;
  if (active == null || !Number.isInteger(active) || active < 0) return null;
  const ring = officialRoomRingVertices(input.polygon);
  if (active >= ring.length) return null;
  return active;
}
