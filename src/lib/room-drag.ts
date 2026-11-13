/** Rooms can be selected, but they must never be translated with the pointer. */
export const ROOM_DRAG_ENABLED = false;

export type MoveRoomHandler = (roomId: string, dx: number, dy: number) => void;

/**
 * Apply a room-polygon drag. Always a no-op so a leftover onMoveRoom handler
 * cannot start moving rooms if it is wired up again by mistake.
 */
export function applyRoomDrag(
  onMoveRoom: MoveRoomHandler | undefined,
  movingRoomId: string | null,
  last: { x: number; y: number } | null,
  next: { x: number; y: number }
): boolean {
  if (!ROOM_DRAG_ENABLED) return false;
  if (!onMoveRoom || !movingRoomId || !last) return false;
  const dx = next.x - last.x;
  const dy = next.y - last.y;
  if (dx === 0 && dy === 0) return false;
  onMoveRoom(movingRoomId, dx, dy);
  return true;
}

export function shouldBeginRoomDrag(onMoveRoom?: MoveRoomHandler): boolean {
  return ROOM_DRAG_ENABLED && typeof onMoveRoom === "function";
}
