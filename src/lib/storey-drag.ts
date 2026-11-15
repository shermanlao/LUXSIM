/** Official Select-tool storey translation on the Top / Bottom plan. */
import { ROOM_DRAG_ENABLED, roomDragDelta } from "./room-drag";

export type MoveStoreyHandler = (storeyId: string, dx: number, dy: number) => void;

/** Pointer slop in CSS pixels: movement within this is still a click-to-select. */
export const STOREY_DRAG_CLICK_SLOP_PX = 4;

export type StoreyDragBeginInput = {
  tool?: string | null;
  drawing?: boolean;
  calibrating?: boolean;
  linePickActive?: boolean;
  circlePickActive?: boolean;
  activeRoomId?: string | null;
  activeStoreyId?: string | null;
  hitRoomStoreyId?: string | null;
  onMoveStorey?: MoveStoreyHandler;
};

/**
 * Begin a storey drag only with the official Select tool, a move handler, a
 * storey selected in Building (no active room), a hit on a room of that
 * storey, and no active Draw room draft, calibrate click, or line/circle pick.
 */
export function shouldBeginStoreyDrag(input: StoreyDragBeginInput = {}): boolean {
  return (
    ROOM_DRAG_ENABLED &&
    typeof input.onMoveStorey === "function" &&
    input.tool === "select" &&
    !input.drawing &&
    !input.calibrating &&
    !input.linePickActive &&
    !input.circlePickActive &&
    !input.activeRoomId &&
    !!input.activeStoreyId &&
    input.hitRoomStoreyId === input.activeStoreyId
  );
}

/**
 * True when the pointer has not left the click slop, so mouseup should select
 * the hit room instead of leaving a storey translation.
 */
export function isStoreyDragClick(
  originClient: { x: number; y: number },
  currentClient: { x: number; y: number },
  slopPx = STOREY_DRAG_CLICK_SLOP_PX
): boolean {
  const dx = currentClient.x - originClient.x;
  const dy = currentClient.y - originClient.y;
  return dx * dx + dy * dy <= slopPx * slopPx;
}

/**
 * Apply the incremental translation since the last applied total. Reuses the
 * same Shift-to-axis snap as room drag.
 */
export function applyStoreyDrag(
  onMoveStorey: MoveStoreyHandler | undefined,
  movingStoreyId: string | null,
  origin: { x: number; y: number } | null,
  applied: { x: number; y: number },
  next: { x: number; y: number },
  shiftKey = false
): { x: number; y: number } {
  if (!ROOM_DRAG_ENABLED || !onMoveStorey || !movingStoreyId || !origin) return applied;
  const total = roomDragDelta(origin, next, shiftKey);
  const dx = total.x - applied.x;
  const dy = total.y - applied.y;
  if (dx === 0 && dy === 0) return applied;
  onMoveStorey(movingStoreyId, dx, dy);
  return total;
}
