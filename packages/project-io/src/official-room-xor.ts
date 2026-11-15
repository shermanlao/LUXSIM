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

export const XOR_ROOMS_PICK_FIRST_STATUS =
  "Select the first room to keep as the XOR result, then a second room on this storey. Esc cancels.";

export const XOR_ROOMS_PICK_SECOND_STATUS =
  "Select a second room on this storey to XOR. Esc cancels.";

export const XOR_ROOMS_CANCELLED_STATUS = "XOR rooms cancelled.";

export const XOR_ROOMS_REFUSE_SAME_STATUS =
  "XOR rooms refused: select two different rooms.";

export const XOR_ROOMS_REFUSE_STOREY_STATUS =
  "XOR rooms refused: both rooms must be on the current storey.";

export const XOR_ROOMS_REFUSE_MISSING_STATUS =
  "XOR rooms refused: a room is missing.";

export const XOR_ROOMS_REFUSE_DISJOINT_STATUS =
  "XOR rooms refused: the rooms do not overlap in area.";

export const XOR_ROOMS_REFUSE_HOLE_STATUS =
  "XOR rooms refused: the XOR would contain a hole.";

export const XOR_ROOMS_REFUSE_SPLIT_STATUS =
  "XOR rooms refused: the XOR would split into separate pieces.";

export const XOR_ROOMS_REFUSE_EMPTY_STATUS =
  "XOR rooms refused: the XOR would be empty.";

export const XOR_ROOMS_REFUSE_INVALID_STATUS =
  "XOR rooms refused: the result would not be a single simple room.";

export const XOR_ROOMS_REFUSE_AREA_STATUS =
  "XOR rooms refused: the room area would be below 0.01 m².";

export const XOR_ROOMS_REFUSE_CROSS_STATUS =
  "XOR rooms refused: the room outline would cross itself.";

export const XOR_ROOMS_REFUSE_VERTICES_STATUS =
  "XOR rooms refused: the room would have fewer than 3 unique corners.";

export function formatXorRoomsSuccessStatus(name: string): string {
  return `XORed rooms into “${name}”.`;
}

export type OfficialXorRoomsReason =
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

export type OfficialPolygonXorResult =
  | { ok: true; polygon: Vec2[] }
  | {
      ok: false;
      reason: Exclude<OfficialXorRoomsReason, "missing" | "storey" | "same">;
    };

export type OfficialXorRoomsResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      keptRoomId: string;
      removedRoomId: string;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialXorRoomsReason;
    };

function clonePt(p: Vec2): Vec2 {
  return { x: p.x, y: p.y };
}

/** Result interior of A ⊕ B: in exactly one of the two rooms, including that room’s exclusive boundary. Shared boundary is excluded. */
export function officialPointInXorInclusive(p: Vec2, a: Vec2[], b: Vec2[]): boolean {
  return officialPointInPolygonInclusive(p, a) !== officialPointInPolygonInclusive(p, b);
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
 * Symmetric difference (XOR) of two simple official room polygons (no
 * holes), as a single simple outer ring. Allowed only when the polygons
 * overlap in area. Edge-touch and disjoint pairs are refused. Results that
 * would be empty, form a hole (including a cutter strictly inside the first
 * room), or split into two or more islands are refused. A typical offset
 * overlap that leaves two remainders is refused as a split. A bite that
 * shares the outer boundary can succeed as a single ring (the first room
 * minus the bite).
 */
export function xorOfficialRoomPolygons(
  a: Vec2[],
  b: Vec2[]
): OfficialPolygonXorResult {
  const relation = officialPolygonsOverlapOrShareEdge(a, b);
  if (relation !== "overlap") return { ok: false, reason: "disjoint" };

  const stitched = officialBooleanStitchedRings(a, b, officialPointInXorInclusive);
  if (!stitched.ok) {
    if (stitched.reason === "degenerate-vertices") {
      return { ok: false, reason: "degenerate-vertices" };
    }
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

function refuseStatus(reason: OfficialXorRoomsReason): string {
  switch (reason) {
    case "missing":
      return XOR_ROOMS_REFUSE_MISSING_STATUS;
    case "storey":
      return XOR_ROOMS_REFUSE_STOREY_STATUS;
    case "same":
      return XOR_ROOMS_REFUSE_SAME_STATUS;
    case "disjoint":
      return XOR_ROOMS_REFUSE_DISJOINT_STATUS;
    case "hole":
      return XOR_ROOMS_REFUSE_HOLE_STATUS;
    case "split":
      return XOR_ROOMS_REFUSE_SPLIT_STATUS;
    case "empty":
      return XOR_ROOMS_REFUSE_EMPTY_STATUS;
    case "self-crossing":
      return XOR_ROOMS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return XOR_ROOMS_REFUSE_VERTICES_STATUS;
    case "area":
      return XOR_ROOMS_REFUSE_AREA_STATUS;
    default:
      return XOR_ROOMS_REFUSE_INVALID_STATUS;
  }
}

function reassignFixturesAfterXor(
  instances: FixtureInstance[],
  keptId: string,
  removedId: string,
  xorRing: Vec2[],
  storeyId: string
): FixtureInstance[] {
  return instances.map((inst) => {
    const xy = { x: inst.position.x, y: inst.position.y };
    const inRing = officialPointInPolygonInclusive(xy, xorRing);
    if (inst.roomId === keptId) {
      if (inRing) return inst;
      return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
    }
    if (inst.roomId === removedId) {
      if (inRing) return { ...inst, roomId: keptId };
      return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
    }
    return inst;
  });
}

/**
 * XOR two official rooms on the current storey. The first room keeps its
 * id, name, MF, EN template, height, and other official properties; its
 * polygon becomes the symmetric difference as a single simple ring. The
 * second room is removed after a successful XOR. Fixtures of either room
 * that still lie in the XOR outline are assigned to the surviving room;
 * fixtures that fall outside stay on the storey with roomId cleared.
 * Luminaires are never deleted. Calculation results are left as they are
 * (same policy as official room translation, union, subtract, and
 * intersect) — this helper only updates the scene.
 */
export function officialXorRooms(
  scene: ProjectSceneV2,
  keepRoomId: string,
  removeRoomId: string
): OfficialXorRoomsResult {
  if (keepRoomId === removeRoomId) {
    return {
      ok: false,
      scene,
      status: XOR_ROOMS_REFUSE_SAME_STATUS,
      reason: "same",
    };
  }
  const keep = scene.rooms.find((room) => room.id === keepRoomId);
  const remove = scene.rooms.find((room) => room.id === removeRoomId);
  if (!keep || !remove) {
    return {
      ok: false,
      scene,
      status: XOR_ROOMS_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (keep.storeyId !== storeyId || remove.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: XOR_ROOMS_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const cut = xorOfficialRoomPolygons(keep.polygon, remove.polygon);
  if (!cut.ok) {
    return {
      ok: false,
      scene,
      status: refuseStatus(cut.reason),
      reason: cut.reason,
    };
  }

  const polygon = cut.polygon.map(clonePt);
  const rooms = scene.rooms
    .filter((room) => room.id !== removeRoomId)
    .map((room) => (room.id === keepRoomId ? { ...room, polygon } : room));
  const instances = reassignFixturesAfterXor(
    scene.instances,
    keepRoomId,
    removeRoomId,
    polygon,
    storeyId
  );
  const activeRoomId =
    scene.ui.activeRoomId === removeRoomId ? keepRoomId : scene.ui.activeRoomId;

  return {
    ok: true,
    scene: {
      ...scene,
      rooms,
      instances,
      ui: { ...scene.ui, activeRoomId },
    },
    status: formatXorRoomsSuccessStatus(keep.name),
    keptRoomId: keepRoomId,
    removedRoomId: removeRoomId,
    polygon,
  };
}
