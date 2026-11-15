import type { ProjectSceneV2 } from "./types";
import { parseLengthToM } from "./units";

/** Documented default ceiling height for a newly drawn or rectangle-created room. */
export const DEFAULT_NEW_ROOM_HEIGHT_M = 2.8;

/** Building-level Room height field default, in millimetres. */
export const DEFAULT_NEW_ROOM_HEIGHT_MM = "2800";

/** Official editor minimum for a room or storey height field. */
export const MIN_ROOM_HEIGHT_M = 0.5;

/**
 * Height used by the official Draw room / Create rectangle path.
 * Bare numbers are millimetres, matching the Building field.
 * Until the user changes the field, this is 2.8 m.
 * An invalid or too-small field falls back to fallbackM (storey height when
 * the editor supplies it), then to the documented 2.8 m default.
 * Does not copy height from a selected room, and does not change storey height.
 */
export function resolveOfficialNewRoomHeightM(
  fieldMm: string,
  fallbackM: number = DEFAULT_NEW_ROOM_HEIGHT_M
): number {
  const fromField = parseLengthToM(fieldMm);
  if (fromField && fromField >= MIN_ROOM_HEIGHT_M) return fromField;
  if (Number.isFinite(fallbackM) && fallbackM >= MIN_ROOM_HEIGHT_M) return fallbackM;
  return DEFAULT_NEW_ROOM_HEIGHT_M;
}

/**
 * Apply the Building-level Room height field.
 * Always records the raw field text for the next official new room.
 * When a room is selected and the value is at least 0.5 m, only that room’s
 * ceiling is updated. Existing rooms are left unchanged when no room is
 * selected, or when the field is empty or invalid.
 */
export function applyOfficialRoomHeightMm(
  scene: ProjectSceneV2,
  rawMm: string,
  selectedRoomId: string | null
): {
  fieldMm: string;
  heightM: number | null;
  scene: ProjectSceneV2;
  updatedRoomId: string | null;
} {
  const heightM = parseLengthToM(rawMm);
  const valid = heightM != null && heightM >= MIN_ROOM_HEIGHT_M;
  if (!valid || !selectedRoomId) {
    return {
      fieldMm: rawMm,
      heightM: valid ? heightM : null,
      scene,
      updatedRoomId: null,
    };
  }
  let updatedRoomId: string | null = null;
  const rooms = scene.rooms.map((room) => {
    if (room.id !== selectedRoomId || room.heightM === heightM) return room;
    updatedRoomId = room.id;
    return { ...room, heightM };
  });
  return {
    fieldMm: rawMm,
    heightM,
    scene: updatedRoomId ? { ...scene, rooms } : scene,
    updatedRoomId,
  };
}
