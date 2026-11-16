import { officialTranslateRoom, translatePlanPoint } from "./official-room-translate";
import { validateStretchedRoomPolygon } from "./official-room-vertex";
import type { ProjectSceneV2, Vec2 } from "./types";

/** World-XY epsilon used to treat an already-aligned room as a no-op. */
export const ALIGN_ROOMS_EPS_M = 1e-6;

export const OFFICIAL_ROOM_ALIGN_AXES = [
  "left",
  "right",
  "top",
  "bottom",
  "hcentre",
  "vcentre",
] as const;

export type OfficialRoomAlignAxis = (typeof OFFICIAL_ROOM_ALIGN_AXES)[number];

export const DEFAULT_OFFICIAL_ROOM_ALIGN_AXIS: OfficialRoomAlignAxis = "left";

export const OFFICIAL_ROOM_ALIGN_AXIS_LABELS: Record<OfficialRoomAlignAxis, string> = {
  left: "Left",
  right: "Right",
  top: "Top",
  bottom: "Bottom",
  hcentre: "H centre",
  vcentre: "V centre",
};

export function officialRoomAlignAxisLabel(axis: OfficialRoomAlignAxis): string {
  return OFFICIAL_ROOM_ALIGN_AXIS_LABELS[axis];
}

export function officialRoomAlignAxisPhrase(axis: OfficialRoomAlignAxis): string {
  switch (axis) {
    case "left":
      return "left edges";
    case "right":
      return "right edges";
    case "top":
      return "top edges";
    case "bottom":
      return "bottom edges";
    case "hcentre":
      return "horizontal centres";
    case "vcentre":
      return "vertical centres";
  }
}

export const ALIGN_ROOMS_PICK_FIRST_STATUS =
  "Select the reference room to align to, then a room to move on this storey. Esc cancels.";

export const ALIGN_ROOMS_PICK_SECOND_STATUS =
  "Select a room on this storey to align to the reference. Esc cancels.";

export const ALIGN_ROOMS_CANCELLED_STATUS = "Align rooms cancelled.";

export const ALIGN_ROOMS_REFUSE_SAME_STATUS =
  "Align rooms refused: select two different rooms.";

export const ALIGN_ROOMS_REFUSE_STOREY_STATUS =
  "Align rooms refused: both rooms must be on the current storey.";

export const ALIGN_ROOMS_REFUSE_MISSING_STATUS =
  "Align rooms refused: a room is missing.";

export const ALIGN_ROOMS_REFUSE_NOOP_STATUS =
  "Align rooms refused: the room is already aligned.";

export const ALIGN_ROOMS_REFUSE_AREA_STATUS =
  "Align rooms refused: the room area would be below 0.01 m².";

export const ALIGN_ROOMS_REFUSE_CROSS_STATUS =
  "Align rooms refused: the room outline would cross itself.";

export const ALIGN_ROOMS_REFUSE_VERTICES_STATUS =
  "Align rooms refused: the room would have fewer than 3 unique corners.";

export const ALIGN_ROOMS_REFUSE_INVALID_STATUS =
  "Align rooms refused: the result would not be a single simple room.";

export function formatAlignRoomsSuccessStatus(
  movingName: string,
  referenceName: string,
  axis: OfficialRoomAlignAxis
): string {
  return `Aligned “${movingName}” to “${referenceName}” (${officialRoomAlignAxisPhrase(axis)}).`;
}

export type OfficialAlignRoomsReason =
  | "missing"
  | "storey"
  | "same"
  | "noop"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialAlignRoomsResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      referenceRoomId: string;
      movingRoomId: string;
      axis: OfficialRoomAlignAxis;
      dx: number;
      dy: number;
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialAlignRoomsReason;
    };

export type OfficialPolygonBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function officialPolygonBounds(polygon: Vec2[]): OfficialPolygonBounds | null {
  if (polygon.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygon) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * World-XY translation that lines the moving polygon's axis up with the
 * reference. Left/right/top/bottom use the axis-aligned bounding box;
 * centres use the box midpoints. Y increases upward, so top is max Y.
 */
export function officialAlignTranslation(
  reference: Vec2[],
  moving: Vec2[],
  axis: OfficialRoomAlignAxis
): { dx: number; dy: number } | null {
  const a = officialPolygonBounds(reference);
  const b = officialPolygonBounds(moving);
  if (!a || !b) return null;
  switch (axis) {
    case "left":
      return { dx: a.minX - b.minX, dy: 0 };
    case "right":
      return { dx: a.maxX - b.maxX, dy: 0 };
    case "top":
      return { dx: 0, dy: a.maxY - b.maxY };
    case "bottom":
      return { dx: 0, dy: a.minY - b.minY };
    case "hcentre":
      return { dx: (a.minX + a.maxX) / 2 - (b.minX + b.maxX) / 2, dy: 0 };
    case "vcentre":
      return { dx: 0, dy: (a.minY + a.maxY) / 2 - (b.minY + b.maxY) / 2 };
  }
}

function refuseStatus(reason: OfficialAlignRoomsReason): string {
  switch (reason) {
    case "missing":
      return ALIGN_ROOMS_REFUSE_MISSING_STATUS;
    case "storey":
      return ALIGN_ROOMS_REFUSE_STOREY_STATUS;
    case "same":
      return ALIGN_ROOMS_REFUSE_SAME_STATUS;
    case "noop":
      return ALIGN_ROOMS_REFUSE_NOOP_STATUS;
    case "self-crossing":
      return ALIGN_ROOMS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return ALIGN_ROOMS_REFUSE_VERTICES_STATUS;
    case "area":
      return ALIGN_ROOMS_REFUSE_AREA_STATUS;
    case "invalid":
      return ALIGN_ROOMS_REFUSE_INVALID_STATUS;
  }
}

function refuse(
  scene: ProjectSceneV2,
  reason: OfficialAlignRoomsReason
): OfficialAlignRoomsResult {
  return {
    ok: false,
    scene,
    status: refuseStatus(reason),
    reason,
  };
}

function validationReason(
  reason: "self-crossing" | "degenerate-vertices" | "area"
): OfficialAlignRoomsReason {
  return reason;
}

/**
 * Align one official room on the current storey to a reference room along a
 * single axis. The reference stays put. The moving room is translated
 * (shape unchanged) so the matching edge or centre of its bounding box
 * lines up with the reference. Fixtures assigned to the moving room follow
 * the same translation. Neither room is deleted. Calculation results are
 * left as they are (same policy as official room translation).
 */
export function officialAlignRooms(
  scene: ProjectSceneV2,
  referenceRoomId: string,
  movingRoomId: string,
  axis: OfficialRoomAlignAxis
): OfficialAlignRoomsResult {
  if (referenceRoomId === movingRoomId) {
    return refuse(scene, "same");
  }
  const reference = scene.rooms.find((room) => room.id === referenceRoomId);
  const moving = scene.rooms.find((room) => room.id === movingRoomId);
  if (!reference || !moving) {
    return refuse(scene, "missing");
  }
  const storeyId = scene.ui.activeStoreyId;
  if (reference.storeyId !== storeyId || moving.storeyId !== storeyId) {
    return refuse(scene, "storey");
  }

  const translation = officialAlignTranslation(reference.polygon, moving.polygon, axis);
  if (!translation) {
    return refuse(scene, "invalid");
  }
  if (Math.abs(translation.dx) < ALIGN_ROOMS_EPS_M && Math.abs(translation.dy) < ALIGN_ROOMS_EPS_M) {
    return refuse(scene, "noop");
  }

  const nextPolygon = moving.polygon.map((point) =>
    translatePlanPoint(point, translation.dx, translation.dy)
  );
  const check = validateStretchedRoomPolygon(nextPolygon);
  if (!check.ok) {
    return refuse(scene, validationReason(check.reason));
  }

  const nextScene = officialTranslateRoom(scene, movingRoomId, translation.dx, translation.dy);
  return {
    ok: true,
    scene: {
      ...nextScene,
      ui: { ...nextScene.ui, activeRoomId: referenceRoomId },
    },
    status: formatAlignRoomsSuccessStatus(moving.name, reference.name, axis),
    referenceRoomId,
    movingRoomId,
    axis,
    dx: translation.dx,
    dy: translation.dy,
  };
}
