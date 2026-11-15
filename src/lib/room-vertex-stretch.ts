import { officialRoomRingVertices } from "@luxsim/project-io";
import { DXF_OBJECT_SNAP_CSS_PX, dxfObjectSnapRadiusM } from "@/lib/official-dxf-object-snap";
import { ROOM_DRAG_ENABLED, type RoomDragBeginInput } from "@/lib/room-drag";
import type { Vec2 } from "@luxsim/project-io";

/** Official vertex-handle aperture: the same 8 CSS pixels as DXF object snap. */
export const VERTEX_HANDLE_CSS_PX = DXF_OBJECT_SNAP_CSS_PX;

export type SetRoomPolygonHandler = (roomId: string, polygon: Vec2[]) => void;

export type VertexStretchBeginInput = RoomDragBeginInput & {
  handleIndex?: number | null;
  onSetRoomPolygon?: SetRoomPolygonHandler;
};

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

