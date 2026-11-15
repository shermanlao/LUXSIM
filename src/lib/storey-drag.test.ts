import { describe, expect, it, vi } from "vitest";
import {
  STOREY_DRAG_CLICK_SLOP_PX,
  applyStoreyDrag,
  isStoreyDragClick,
  shouldBeginStoreyDrag,
} from "./storey-drag";
import { ROOM_DRAG_ENABLED } from "./room-drag";

const ready = {
  tool: "select" as const,
  drawing: false,
  calibrating: false,
  linePickActive: false,
  circlePickActive: false,
  activeRoomId: null as string | null,
  activeStoreyId: "storey-gf",
  hitRoomStoreyId: "storey-gf",
};

describe("storey drag pointer helpers", () => {
  it("is enabled and begins only when the storey is selected under the official Select tool", () => {
    const onMoveStorey = vi.fn();
    expect(ROOM_DRAG_ENABLED).toBe(true);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey })).toBe(true);
    expect(shouldBeginStoreyDrag({ onMoveStorey })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, tool: "drawRoom" })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, tool: "calibrate" })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, drawing: true })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, calibrating: true })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, linePickActive: true })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, circlePickActive: true })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, activeRoomId: "room-1" })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, hitRoomStoreyId: "other" })).toBe(false);
    expect(shouldBeginStoreyDrag({ ...ready, onMoveStorey, activeStoreyId: null })).toBe(false);
  });

  it("treats pointer movement within the slop as a click that can still select a room", () => {
    const origin = { x: 10, y: 10 };
    expect(isStoreyDragClick(origin, origin)).toBe(true);
    expect(isStoreyDragClick(origin, { x: 10 + STOREY_DRAG_CLICK_SLOP_PX, y: 10 })).toBe(true);
    expect(isStoreyDragClick(origin, { x: 13, y: 12 })).toBe(true);
    expect(isStoreyDragClick(origin, { x: 10 + STOREY_DRAG_CLICK_SLOP_PX + 1, y: 10 })).toBe(false);
    expect(isStoreyDragClick(origin, { x: 20, y: 30 })).toBe(false);
  });

  it("applies the pointer delta and snaps to X or Y when Shift is held", () => {
    const onMoveStorey = vi.fn();
    const first = applyStoreyDrag(
      onMoveStorey,
      "storey-gf",
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 1 }
    );
    expect(first).toEqual({ x: 2, y: 1 });
    expect(onMoveStorey).toHaveBeenCalledWith("storey-gf", 2, 1);

    const second = applyStoreyDrag(
      onMoveStorey,
      "storey-gf",
      { x: 0, y: 0 },
      first,
      { x: 3, y: 0.5 },
      true
    );
    expect(second).toEqual({ x: 3, y: 0 });
    expect(onMoveStorey).toHaveBeenCalledWith("storey-gf", 1, -1);
  });

  it("does not start or apply a move without a handler or an active storey", () => {
    const onMoveStorey = vi.fn();
    expect(
      applyStoreyDrag(undefined, "storey-gf", { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    ).toEqual({ x: 0, y: 0 });
    expect(
      applyStoreyDrag(onMoveStorey, null, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    ).toEqual({ x: 0, y: 0 });
    expect(onMoveStorey).not.toHaveBeenCalled();
  });
});
