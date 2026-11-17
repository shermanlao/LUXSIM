import { tessellateCircularArcIntermediates } from "./dxf";
import { officialPointInPolygonInclusive } from "./official-room-union";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import {
  officialRoomRingVertices,
  officialSetRoomPolygon,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

/** Radians; a corner flatter or sharper than this is treated as already straight. */
export const FILLET_STRAIGHT_EPS_RAD = 1e-9;

export const FILLET_CORNER_PICK_ROOM_STATUS =
  "Select a room on this storey, then a corner handle to fillet. Esc cancels.";

export const FILLET_CORNER_PICK_CORNER_STATUS =
  "Select a corner handle to fillet. Esc cancels.";

export const FILLET_CORNER_CANCELLED_STATUS = "Fillet corner cancelled.";

export const FILLET_CORNER_REFUSE_RADIUS_STATUS =
  "Fillet corner refused: enter a radius greater than 0.";

export const FILLET_CORNER_REFUSE_MISSING_STATUS =
  "Fillet corner refused: a room is missing.";

export const FILLET_CORNER_REFUSE_STOREY_STATUS =
  "Fillet corner refused: the room must be on the current storey.";

export const FILLET_CORNER_REFUSE_CORNER_STATUS =
  "Fillet corner refused: select a corner handle.";

export const FILLET_CORNER_REFUSE_STRAIGHT_STATUS =
  "Fillet corner refused: that corner is already straight.";

export const FILLET_CORNER_REFUSE_TOO_LARGE_STATUS =
  "Fillet corner refused: the radius is too large for the adjacent edges.";

export const FILLET_CORNER_REFUSE_AREA_STATUS =
  "Fillet corner refused: the room area would be below 0.01 m².";

export const FILLET_CORNER_REFUSE_CROSS_STATUS =
  "Fillet corner refused: the room outline would cross itself.";

export const FILLET_CORNER_REFUSE_VERTICES_STATUS =
  "Fillet corner refused: the room would have fewer than 3 unique corners.";

export const FILLET_CORNER_REFUSE_INVALID_STATUS =
  "Fillet corner refused: the result would not be a single simple room.";

export function formatFilletCornerSuccessStatus(name: string): string {
  return `Filleted a corner of “${name}”.`;
}

export type OfficialFilletCornerReason =
  | "radius"
  | "missing"
  | "storey"
  | "corner"
  | "straight"
  | "too-large"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialPolygonFilletResult =
  | { ok: true; polygon: Vec2[] }
  | {
      ok: false;
      reason: Exclude<OfficialFilletCornerReason, "missing" | "storey">;
    };

export type OfficialFilletRoomCornerResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      roomId: string;
      vertexIndex: number;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialFilletCornerReason;
    };

function clonePt(p: Vec2): Vec2 {
  return { x: p.x, y: p.y };
}

function refuseStatus(reason: OfficialFilletCornerReason): string {
  switch (reason) {
    case "radius":
      return FILLET_CORNER_REFUSE_RADIUS_STATUS;
    case "missing":
      return FILLET_CORNER_REFUSE_MISSING_STATUS;
    case "storey":
      return FILLET_CORNER_REFUSE_STOREY_STATUS;
    case "corner":
      return FILLET_CORNER_REFUSE_CORNER_STATUS;
    case "straight":
      return FILLET_CORNER_REFUSE_STRAIGHT_STATUS;
    case "too-large":
      return FILLET_CORNER_REFUSE_TOO_LARGE_STATUS;
    case "self-crossing":
      return FILLET_CORNER_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return FILLET_CORNER_REFUSE_VERTICES_STATUS;
    case "area":
      return FILLET_CORNER_REFUSE_AREA_STATUS;
    default:
      return FILLET_CORNER_REFUSE_INVALID_STATUS;
  }
}

/** Shorter signed sweep from startRad to endRad, in (-π, π]. */
export function officialShortSweepRad(startRad: number, endRad: number): number {
  let sweep = endRad - startRad;
  const tau = Math.PI * 2;
  while (sweep <= -Math.PI) sweep += tau;
  while (sweep > Math.PI) sweep -= tau;
  return sweep;
}

/**
 * Replace one closed-ring corner with tangent points and a tessellated
 * interior circular arc (no stored bulge). The arc centre sits in the
 * smaller-angle wedge so a convex room corner is cut off and a concave
 * (reflex) corner is rounded with the arc facing the room interior.
 * Radius is metres. A mid-edge point is not a corner and should not be
 * passed as vertexIndex — vertexIndex is a ring-corner index.
 */
export function filletOfficialRoomCorner(
  polygon: Vec2[],
  vertexIndex: number,
  radiusM: number
): OfficialPolygonFilletResult {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) {
    return { ok: false, reason: "radius" };
  }
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0) {
    return { ok: false, reason: "corner" };
  }
  const ring = officialRoomRingVertices(polygon);
  const n = ring.length;
  if (n < 3 || vertexIndex >= n) {
    return { ok: false, reason: "corner" };
  }

  const A = ring[(vertexIndex - 1 + n) % n]!;
  const B = ring[vertexIndex]!;
  const C = ring[(vertexIndex + 1) % n]!;
  const len1 = Math.hypot(A.x - B.x, A.y - B.y);
  const len2 = Math.hypot(C.x - B.x, C.y - B.y);
  if (!(len1 > 0) || !(len2 > 0)) {
    return { ok: false, reason: "straight" };
  }

  const u1x = (A.x - B.x) / len1;
  const u1y = (A.y - B.y) / len1;
  const u2x = (C.x - B.x) / len2;
  const u2y = (C.y - B.y) / len2;
  const cross = u1x * u2y - u1y * u2x;
  const dot = u1x * u2x + u1y * u2y;
  const alpha = Math.atan2(Math.abs(cross), dot);
  if (
    !Number.isFinite(alpha) ||
    alpha < FILLET_STRAIGHT_EPS_RAD ||
    Math.PI - alpha < FILLET_STRAIGHT_EPS_RAD
  ) {
    return { ok: false, reason: "straight" };
  }

  const half = alpha / 2;
  const tanHalf = Math.tan(half);
  const sinHalf = Math.sin(half);
  if (!(tanHalf > 0) || !(sinHalf > 0)) {
    return { ok: false, reason: "straight" };
  }
  const d = radiusM / tanHalf;
  if (!(d > 0) || !Number.isFinite(d) || !(d < len1) || !(d < len2)) {
    return { ok: false, reason: "too-large" };
  }

  const t1: Vec2 = { x: B.x + u1x * d, y: B.y + u1y * d };
  const t2: Vec2 = { x: B.x + u2x * d, y: B.y + u2y * d };
  const bisX = u1x + u2x;
  const bisY = u1y + u2y;
  const bisLen = Math.hypot(bisX, bisY);
  if (!(bisLen > 0)) {
    return { ok: false, reason: "straight" };
  }
  const centerDist = radiusM / sinHalf;
  const cx = B.x + (bisX / bisLen) * centerDist;
  const cy = B.y + (bisY / bisLen) * centerDist;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return { ok: false, reason: "invalid" };
  }

  const startRad = Math.atan2(t1.y - cy, t1.x - cx);
  const endRad = Math.atan2(t2.y - cy, t2.x - cx);
  const sweepRad = officialShortSweepRad(startRad, endRad);
  if (!Number.isFinite(sweepRad) || !(Math.abs(sweepRad) > 0)) {
    return { ok: false, reason: "invalid" };
  }

  const mid = tessellateCircularArcIntermediates(cx, cy, radiusM, startRad, sweepRad);
  const closed =
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!);
  const next: Vec2[] = [
    ...ring.slice(0, vertexIndex).map(clonePt),
    clonePt(t1),
    ...mid.map(clonePt),
    clonePt(t2),
    ...ring.slice(vertexIndex + 1).map(clonePt),
  ];
  if (closed && next[0]) {
    next.push(clonePt(next[0]));
  }

  const check = validateStretchedRoomPolygon(next);
  if (!check.ok) {
    if (check.reason === "area") return { ok: false, reason: "area" };
    if (check.reason === "self-crossing") return { ok: false, reason: "self-crossing" };
    return { ok: false, reason: "degenerate-vertices" };
  }
  return { ok: true, polygon: next };
}

function unassignFixturesAfterFillet(
  instances: FixtureInstance[],
  roomId: string,
  ring: Vec2[],
  storeyId: string
): FixtureInstance[] {
  return instances.map((inst) => {
    if (inst.roomId !== roomId) return inst;
    const xy = { x: inst.position.x, y: inst.position.y };
    if (officialPointInPolygonInclusive(xy, ring)) return inst;
    return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
  });
}

/**
 * Fillet one corner of an official room on the current storey. The room
 * keeps its id, name, and other official properties; its polygon becomes
 * the filleted simple ring. Fixtures assigned to the room whose XY no
 * longer lie in the new outline have roomId cleared; fixtures still inside
 * keep their assignment and are not moved. Luminaires are never deleted.
 * Calculation results are left as they are — this helper only updates the
 * scene. A refused call returns the same scene object unchanged.
 */
export function officialFilletRoomCorner(
  scene: ProjectSceneV2,
  roomId: string,
  vertexIndex: number,
  radiusM: number
): OfficialFilletRoomCornerResult {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) {
    return {
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (room.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const filleted = filletOfficialRoomCorner(room.polygon, vertexIndex, radiusM);
  if (!filleted.ok) {
    return {
      ok: false,
      scene,
      status: refuseStatus(filleted.reason),
      reason: filleted.reason,
    };
  }

  const polygon = filleted.polygon.map(clonePt);
  const withPolygon = officialSetRoomPolygon(scene, roomId, polygon);
  const instances = unassignFixturesAfterFillet(
    withPolygon.instances,
    roomId,
    officialRoomRingVertices(polygon),
    storeyId
  );

  return {
    ok: true,
    scene: {
      ...withPolygon,
      instances,
      ui: { ...withPolygon.ui },
    },
    status: formatFilletCornerSuccessStatus(room.name),
    roomId,
    vertexIndex,
    polygon,
  };
}
