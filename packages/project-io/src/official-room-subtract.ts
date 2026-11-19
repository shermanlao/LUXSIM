import { roomAreaM2 } from "./geometry";
import { DXF_CLOSED_ROOM_MIN_AREA_M2 } from "./official-dxf-closed-rooms";
import {
  officialBooleanStitchedRings,
  officialCollapseBooleanRing,
  officialPointInPolygonInclusive,
  officialPointStrictlyInsidePolygon,
  officialPolygonsOverlapOrShareEdge,
} from "./official-room-union";
import {
  officialRoomPolygonSelfIntersects,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
import type { FixtureInstance, ProjectSceneV2, RoomV2, Vec2 } from "./types";

export const SUBTRACT_ROOMS_PICK_FIRST_STATUS =
  "Select the first room to keep and cut, then a second room on this storey as the cutter. Esc cancels.";

export const SUBTRACT_ROOMS_PICK_SECOND_STATUS =
  "Select a second room on this storey as the cutter. Esc cancels.";

export const SUBTRACT_ROOMS_CANCELLED_STATUS = "Subtract rooms cancelled.";

export const SUBTRACT_ROOMS_REFUSE_SAME_STATUS =
  "Subtract rooms refused: select two different rooms.";

export const SUBTRACT_ROOMS_REFUSE_STOREY_STATUS =
  "Subtract rooms refused: both rooms must be on the current storey.";

export const SUBTRACT_ROOMS_REFUSE_MISSING_STATUS =
  "Subtract rooms refused: a room is missing.";

export const SUBTRACT_ROOMS_REFUSE_DISJOINT_STATUS =
  "Subtract rooms refused: the rooms do not overlap in area.";

export const SUBTRACT_ROOMS_REFUSE_HOLE_STATUS =
  "Subtract rooms refused: the subtract would contain a hole.";

export const SUBTRACT_ROOMS_REFUSE_SPLIT_STATUS =
  "Subtract rooms refused: the subtract would split the room into separate pieces.";

export const SUBTRACT_ROOMS_REFUSE_EMPTY_STATUS =
  "Subtract rooms refused: the subtract would be empty.";

export const SUBTRACT_ROOMS_REFUSE_INVALID_STATUS =
  "Subtract rooms refused: the result would not be a single simple room.";

export const SUBTRACT_ROOMS_REFUSE_AREA_STATUS =
  "Subtract rooms refused: the room area would be below 0.01 m².";

export const SUBTRACT_ROOMS_REFUSE_CROSS_STATUS =
  "Subtract rooms refused: the room outline would cross itself.";

export const SUBTRACT_ROOMS_REFUSE_VERTICES_STATUS =
  "Subtract rooms refused: the room would have fewer than 3 unique corners.";

export function formatSubtractRoomsSuccessStatus(name: string): string {
  return `Subtracted from “${name}”.`;
}

export type OfficialSubtractRoomsReason =
  | "missing"
  | "storey"
  | "same"
  | "disjoint"
  | "hole"
  | "split"
  | "empty"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialPolygonSubtractResult =
  | { ok: true; polygon: Vec2[] }
  | {
      ok: false;
      reason: Exclude<OfficialSubtractRoomsReason, "missing" | "storey" | "same">;
    };

export type OfficialSubtractRoomsResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      keptRoomId: string;
      cutterRoomId: string;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialSubtractRoomsReason;
    };

function clonePt(p: Vec2): Vec2 {
  return { x: p.x, y: p.y };
}

/** Result interior of first minus second: in A, and not strictly inside B. */
export function officialPointInSubtractInclusive(p: Vec2, a: Vec2[], b: Vec2[]): boolean {
  return officialPointInPolygonInclusive(p, a) && !officialPointStrictlyInsidePolygon(p, b);
}

function ringContainedIn(inner: Vec2[], outer: Vec2[]): boolean {
  if (inner.length < 3 || outer.length < 3) return false;
  let anyStrict = false;
  for (let i = 0; i < inner.length; i++) {
    const p = inner[i]!;
    if (!officialPointInPolygonInclusive(p, outer)) return false;
    if (officialPointStrictlyInsidePolygon(p, outer)) anyStrict = true;
    const q = inner[(i + 1) % inner.length]!;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    if (!officialPointInPolygonInclusive(mid, outer)) return false;
    if (officialPointStrictlyInsidePolygon(mid, outer)) anyStrict = true;
  }
  return anyStrict || inner.every((p) => officialPointInPolygonInclusive(p, outer));
}

function anyRingContainsAnother(rings: Vec2[][]): boolean {
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j < rings.length; j++) {
      if (i === j) continue;
      if (ringContainedIn(rings[j]!, rings[i]!)) return true;
    }
  }
  return false;
}

/**
 * Difference of two simple official room polygons (no holes): first minus
 * second, as a single simple outer ring. Allowed only when the polygons
 * overlap in area. Edge-touch and disjoint pairs are refused. Results that
 * would be empty, form a hole (cutter strictly inside the first room), or
 * split the first room into two or more islands are refused.
 */
export function subtractOfficialRoomPolygons(
  a: Vec2[],
  b: Vec2[]
): OfficialPolygonSubtractResult {
  const relation = officialPolygonsOverlapOrShareEdge(a, b);
  if (relation !== "overlap") return { ok: false, reason: "disjoint" };

  if (ringContainedIn(a, b) && !ringContainedIn(b, a)) {
    return { ok: false, reason: "empty" };
  }
  // Identical or mutually contained simple rings (A ⊆ B and B ⊆ A) are empty.
  if (ringContainedIn(a, b) && ringContainedIn(b, a)) {
    return { ok: false, reason: "empty" };
  }

  const stitched = officialBooleanStitchedRings(a, b, officialPointInSubtractInclusive);
  if (!stitched.ok) {
    if (stitched.reason === "degenerate-vertices") {
      return { ok: false, reason: "degenerate-vertices" };
    }
    // No remaining fragments after a full cut, or an unusable remainder.
    if (ringContainedIn(a, b)) return { ok: false, reason: "empty" };
    return { ok: false, reason: "invalid" };
  }

  const rings = stitched.rings
    .map((ring) => officialCollapseBooleanRing(ring))
    .filter((ring) => ring.length >= 3);

  if (rings.length === 0) return { ok: false, reason: "empty" };
  if (rings.length > 1) {
    return { ok: false, reason: anyRingContainsAnother(rings) ? "hole" : "split" };
  }

  const ring = rings[0]!.map(clonePt);
  const check = validateStretchedRoomPolygon(ring);
  if (!check.ok) {
    if (check.reason === "area") return { ok: false, reason: "area" };
    if (check.reason === "self-crossing") return { ok: false, reason: "self-crossing" };
    return { ok: false, reason: "degenerate-vertices" };
  }
  if (officialRoomPolygonSelfIntersects(ring)) {
    return { ok: false, reason: "self-crossing" };
  }
  if (roomAreaM2({ polygon: ring } as RoomV2) < DXF_CLOSED_ROOM_MIN_AREA_M2) {
    return { ok: false, reason: "area" };
  }
  return { ok: true, polygon: ring };
}

function refuseStatus(reason: OfficialSubtractRoomsReason): string {
  switch (reason) {
    case "missing":
      return SUBTRACT_ROOMS_REFUSE_MISSING_STATUS;
    case "storey":
      return SUBTRACT_ROOMS_REFUSE_STOREY_STATUS;
    case "same":
      return SUBTRACT_ROOMS_REFUSE_SAME_STATUS;
    case "disjoint":
      return SUBTRACT_ROOMS_REFUSE_DISJOINT_STATUS;
    case "hole":
      return SUBTRACT_ROOMS_REFUSE_HOLE_STATUS;
    case "split":
      return SUBTRACT_ROOMS_REFUSE_SPLIT_STATUS;
    case "empty":
      return SUBTRACT_ROOMS_REFUSE_EMPTY_STATUS;
    case "self-crossing":
      return SUBTRACT_ROOMS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return SUBTRACT_ROOMS_REFUSE_VERTICES_STATUS;
    case "area":
      return SUBTRACT_ROOMS_REFUSE_AREA_STATUS;
    default:
      return SUBTRACT_ROOMS_REFUSE_INVALID_STATUS;
  }
}

function unassignFixturesAfterSubtract(
  instances: FixtureInstance[],
  keptId: string,
  cutRing: Vec2[],
  storeyId: string
): FixtureInstance[] {
  return instances.map((inst) => {
    if (inst.roomId !== keptId) return inst;
    const xy = { x: inst.position.x, y: inst.position.y };
    if (officialPointInPolygonInclusive(xy, cutRing)) return inst;
    return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
  });
}

/**
 * Subtract the cutter room from the first (surviving) room on the current
 * storey. The first room keeps its id, name, MF, EN template, height, and
 * other official properties; its polygon becomes first minus second as a
 * single simple ring. The cutter room is left in place and is not deleted.
 * Fixtures assigned to the surviving room whose XY no longer lie in the cut
 * polygon have roomId cleared; cutter fixtures are unchanged. Luminaires are
 * never deleted. Calculation results are left as they are (same policy as
 * official room translation and union) — this helper only updates the scene.
 */
export function officialSubtractRooms(
  scene: ProjectSceneV2,
  keepRoomId: string,
  cutterRoomId: string
): OfficialSubtractRoomsResult {
  if (keepRoomId === cutterRoomId) {
    return {
      ok: false,
      scene,
      status: SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
      reason: "same",
    };
  }
  const keep = scene.rooms.find((room) => room.id === keepRoomId);
  const cutter = scene.rooms.find((room) => room.id === cutterRoomId);
  if (!keep || !cutter) {
    return {
      ok: false,
      scene,
      status: SUBTRACT_ROOMS_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (keep.storeyId !== storeyId || cutter.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const cut = subtractOfficialRoomPolygons(keep.polygon, cutter.polygon);
  if (!cut.ok) {
    return {
      ok: false,
      scene,
      status: refuseStatus(cut.reason),
      reason: cut.reason,
    };
  }

  const polygon = cut.polygon.map(clonePt);
  const rooms = scene.rooms.map((room) =>
    room.id === keepRoomId ? { ...room, polygon } : room
  );
  const instances = unassignFixturesAfterSubtract(
    scene.instances,
    keepRoomId,
    polygon,
    storeyId
  );

  return {
    ok: true,
    scene: {
      ...scene,
      rooms,
      instances,
      ui: { ...scene.ui },
    },
    status: formatSubtractRoomsSuccessStatus(keep.name),
    keptRoomId: keepRoomId,
    cutterRoomId,
    polygon,
  };
}
