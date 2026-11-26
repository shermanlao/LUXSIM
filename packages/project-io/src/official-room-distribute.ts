import { officialTranslateRoom, translatePlanPoint } from "./official-room-translate";
import { officialPolygonBounds } from "./official-room-align";
import { validateStretchedRoomPolygon } from "./official-room-vertex";
import type { ProjectSceneV2, Vec2 } from "./types";

/** World-XY epsilon used to treat already-even spacing as a no-op. */
export const DISTRIBUTE_ROOMS_EPS_M = 1e-6;

export const DISTRIBUTE_ROOMS_MIN_COUNT = 3;

export const OFFICIAL_ROOM_DISTRIBUTE_AXES = ["horizontal", "vertical"] as const;

export type OfficialRoomDistributeAxis = (typeof OFFICIAL_ROOM_DISTRIBUTE_AXES)[number];

export const DEFAULT_OFFICIAL_ROOM_DISTRIBUTE_AXIS: OfficialRoomDistributeAxis =
  "horizontal";

export const OFFICIAL_ROOM_DISTRIBUTE_AXIS_LABELS: Record<
  OfficialRoomDistributeAxis,
  string
> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
};

export function officialRoomDistributeAxisLabel(
  axis: OfficialRoomDistributeAxis
): string {
  return OFFICIAL_ROOM_DISTRIBUTE_AXIS_LABELS[axis];
}

export function officialRoomDistributeAxisPhrase(
  axis: OfficialRoomDistributeAxis
): string {
  return axis === "horizontal" ? "horizontally" : "vertically";
}

export const DISTRIBUTE_ROOMS_PICK_STATUS =
  "Select at least three rooms on this storey to distribute, then press Enter. Esc cancels.";

export const DISTRIBUTE_ROOMS_PICK_MORE_STATUS =
  "Select at least one more room on this storey, then press Enter. Esc cancels.";

export const DISTRIBUTE_ROOMS_PICK_READY_STATUS =
  "Press Enter to distribute the selected rooms, or click another room on this storey. Esc cancels.";

export const DISTRIBUTE_ROOMS_CANCELLED_STATUS = "Distribute rooms cancelled.";

export const DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS =
  "Distribute rooms refused: select at least three rooms.";

export const DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS =
  "Distribute rooms refused: that room is already selected.";

export const DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS =
  "Distribute rooms refused: all rooms must be on the current storey.";

export const DISTRIBUTE_ROOMS_REFUSE_MISSING_STATUS =
  "Distribute rooms refused: a room is missing.";

export const DISTRIBUTE_ROOMS_REFUSE_NOOP_STATUS =
  "Distribute rooms refused: the rooms are already evenly spaced.";

export const DISTRIBUTE_ROOMS_REFUSE_AREA_STATUS =
  "Distribute rooms refused: the room area would be below 0.01 m².";

export const DISTRIBUTE_ROOMS_REFUSE_CROSS_STATUS =
  "Distribute rooms refused: the room outline would cross itself.";

export const DISTRIBUTE_ROOMS_REFUSE_VERTICES_STATUS =
  "Distribute rooms refused: the room would have fewer than 3 unique corners.";

export const DISTRIBUTE_ROOMS_REFUSE_INVALID_STATUS =
  "Distribute rooms refused: the result would not be a single simple room.";

export function formatDistributeRoomsSuccessStatus(
  count: number,
  axis: OfficialRoomDistributeAxis
): string {
  return `Distributed ${count} rooms evenly (${officialRoomDistributeAxisPhrase(axis)}, equal gaps between bounding boxes).`;
}

export type OfficialDistributeRoomsReason =
  | "missing"
  | "storey"
  | "count"
  | "noop"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialDistributeRoomsResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      axis: OfficialRoomDistributeAxis;
      movedRoomIds: string[];
      anchoredRoomIds: [string, string];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialDistributeRoomsReason;
    };

export type OfficialDistributeMove = {
  roomId: string;
  dx: number;
  dy: number;
};

type RoomSpan = {
  id: string;
  polygon: Vec2[];
  min: number;
  max: number;
  size: number;
};

function refuseStatus(reason: OfficialDistributeRoomsReason): string {
  switch (reason) {
    case "missing":
      return DISTRIBUTE_ROOMS_REFUSE_MISSING_STATUS;
    case "storey":
      return DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS;
    case "count":
      return DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS;
    case "noop":
      return DISTRIBUTE_ROOMS_REFUSE_NOOP_STATUS;
    case "self-crossing":
      return DISTRIBUTE_ROOMS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return DISTRIBUTE_ROOMS_REFUSE_VERTICES_STATUS;
    case "area":
      return DISTRIBUTE_ROOMS_REFUSE_AREA_STATUS;
    case "invalid":
      return DISTRIBUTE_ROOMS_REFUSE_INVALID_STATUS;
  }
}

function refuse(
  scene: ProjectSceneV2,
  reason: OfficialDistributeRoomsReason
): OfficialDistributeRoomsResult {
  return {
    ok: false,
    scene,
    status: refuseStatus(reason),
    reason,
  };
}

function uniqueIds(roomIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of roomIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function spanFor(
  id: string,
  polygon: Vec2[],
  axis: OfficialRoomDistributeAxis
): RoomSpan | null {
  const bounds = officialPolygonBounds(polygon);
  if (!bounds) return null;
  const min = axis === "horizontal" ? bounds.minX : bounds.minY;
  const max = axis === "horizontal" ? bounds.maxX : bounds.maxY;
  return { id, polygon, min, max, size: max - min };
}

/**
 * Translations that even out the gaps between consecutive bounding boxes
 * along one axis. Rooms are ordered by the leading edge (min X or min Y),
 * then the trailing edge, then id. The first and last rooms in that order
 * stay put; only interiors move, and only along the chosen axis.
 */
export function officialDistributeTranslations(
  rooms: { id: string; polygon: Vec2[] }[],
  axis: OfficialRoomDistributeAxis
):
  | { ok: true; moves: OfficialDistributeMove[]; anchoredRoomIds: [string, string] }
  | { ok: false; reason: Exclude<OfficialDistributeRoomsReason, "missing" | "storey"> } {
  const spans: RoomSpan[] = [];
  for (const room of rooms) {
    const span = spanFor(room.id, room.polygon, axis);
    if (!span) return { ok: false, reason: "invalid" };
    spans.push(span);
  }
  if (spans.length < DISTRIBUTE_ROOMS_MIN_COUNT) {
    return { ok: false, reason: "count" };
  }
  spans.sort((a, b) => a.min - b.min || a.max - b.max || a.id.localeCompare(b.id));
  const first = spans[0]!;
  const last = spans[spans.length - 1]!;
  const interiors = spans.slice(1, -1);
  const interiorSize = interiors.reduce((sum, room) => sum + room.size, 0);
  const gap = (last.min - first.max - interiorSize) / (spans.length - 1);
  const moves: OfficialDistributeMove[] = [];
  let cursor = first.max + gap;
  for (const room of interiors) {
    const delta = cursor - room.min;
    const dx = axis === "horizontal" ? delta : 0;
    const dy = axis === "vertical" ? delta : 0;
    if (Math.abs(dx) >= DISTRIBUTE_ROOMS_EPS_M || Math.abs(dy) >= DISTRIBUTE_ROOMS_EPS_M) {
      moves.push({ roomId: room.id, dx, dy });
    }
    cursor = cursor + room.size + gap;
  }
  if (moves.length === 0) {
    return { ok: false, reason: "noop" };
  }
  return { ok: true, moves, anchoredRoomIds: [first.id, last.id] };
}

/**
 * Distribute three or more official rooms on the current storey along one
 * axis. The first and last rooms, ordered by the leading edge of the
 * bounding box, stay put. Interior rooms translate (shape unchanged) so
 * the gaps between consecutive bounding boxes are equal. Fixtures assigned
 * to a moved room follow that translation. Rooms are not deleted.
 * Calculation results are left as they are (same policy as official room
 * translation and alignment).
 */
export function officialDistributeRooms(
  scene: ProjectSceneV2,
  roomIds: string[],
  axis: OfficialRoomDistributeAxis
): OfficialDistributeRoomsResult {
  const ids = uniqueIds(roomIds);
  if (ids.length < DISTRIBUTE_ROOMS_MIN_COUNT) {
    return refuse(scene, "count");
  }
  const rooms = ids.map((id) => scene.rooms.find((room) => room.id === id));
  if (rooms.some((room) => !room)) {
    return refuse(scene, "missing");
  }
  const storeyId = scene.ui.activeStoreyId;
  if (rooms.some((room) => room!.storeyId !== storeyId)) {
    return refuse(scene, "storey");
  }

  const planned = officialDistributeTranslations(
    rooms.map((room) => ({ id: room!.id, polygon: room!.polygon })),
    axis
  );
  if (!planned.ok) {
    return refuse(scene, planned.reason);
  }

  for (const move of planned.moves) {
    const room = rooms.find((item) => item!.id === move.roomId)!;
    const nextPolygon = room.polygon.map((point) =>
      translatePlanPoint(point, move.dx, move.dy)
    );
    const check = validateStretchedRoomPolygon(nextPolygon);
    if (!check.ok) {
      return refuse(scene, check.reason);
    }
  }

  const nextScene = planned.moves.reduce(
    (current, move) => officialTranslateRoom(current, move.roomId, move.dx, move.dy),
    scene
  );
  return {
    ok: true,
    scene: nextScene,
    status: formatDistributeRoomsSuccessStatus(ids.length, axis),
    axis,
    movedRoomIds: planned.moves.map((move) => move.roomId),
    anchoredRoomIds: planned.anchoredRoomIds,
  };
}
