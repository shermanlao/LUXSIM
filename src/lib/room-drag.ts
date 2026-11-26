/** Vertex stretch / insert stay available on the Top plan. */
export const ROOM_DRAG_ENABLED = true;
/** Whole-room and storey translation on the plan is off. */
export const ROOM_TRANSLATE_ENABLED = false;

export type MoveRoomHandler = (roomId: string, dx: number, dy: number) => void;

export type RoomDragBeginInput = {
  tool?: string | null;
  drawing?: boolean;
  calibrating?: boolean;
  linePickActive?: boolean;
  circlePickActive?: boolean;
  polygonPickActive?: boolean;
  unionPickActive?: boolean;
  filletPickActive?: boolean;
  onMoveRoom?: MoveRoomHandler;
};

/**
 * Begin a room drag only with the official Select tool, a move handler, and
 * no active Draw room draft, calibrate click, Line-array pick, Circle-array pick,
 * Polygon-array path pick, Union rooms pick, or Fillet corner pick.
 */
export function shouldBeginRoomDrag(input: RoomDragBeginInput = {}): boolean {
  return (
    ROOM_TRANSLATE_ENABLED &&
    typeof input.onMoveRoom === "function" &&
    input.tool === "select" &&
    !input.drawing &&
    !input.calibrating &&
    !input.linePickActive &&
    !input.circlePickActive &&
    !input.polygonPickActive &&
    !input.unionPickActive &&
    !input.filletPickActive
  );
}

/**
 * World-XY translation from the drag origin to the current pointer.
 * When Shift is held, snap to the dominant axis (same idea as Draw room ortho).
 */
export function roomDragDelta(
  origin: { x: number; y: number },
  current: { x: number; y: number },
  shiftKey = false
): { x: number; y: number } {
  let dx = current.x - origin.x;
  let dy = current.y - origin.y;
  if (shiftKey) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  return { x: dx, y: dy };
}

/**
 * Apply the incremental translation since the last applied total, so a live
 * drag can stay snapped to the origin while Shift is held.
 */
export function applyRoomDrag(
  onMoveRoom: MoveRoomHandler | undefined,
  movingRoomId: string | null,
  origin: { x: number; y: number } | null,
  applied: { x: number; y: number },
  next: { x: number; y: number },
  shiftKey = false
): { x: number; y: number } {
  if (!ROOM_TRANSLATE_ENABLED || !onMoveRoom || !movingRoomId || !origin) return applied;
  const total = roomDragDelta(origin, next, shiftKey);
  const dx = total.x - applied.x;
  const dy = total.y - applied.y;
  if (dx === 0 && dy === 0) return applied;
  onMoveRoom(movingRoomId, dx, dy);
  return total;
}
