import { describe, expect, it, vi } from "vitest";
import {
  ROOM_DRAG_ENABLED,
  ROOM_TRANSLATE_ENABLED,
  applyRoomDrag,
  roomDragDelta,
  shouldBeginRoomDrag,
} from "./room-drag";

const ready = {
  tool: "select" as const,
  drawing: false,
  calibrating: false,
  linePickActive: false,
  circlePickActive: false,
  polygonPickActive: false,
};

describe("room drag pointer helpers", () => {
  it("keeps vertex stretch available but does not begin whole-room translation", () => {
    const onMoveRoom = vi.fn();
    expect(ROOM_DRAG_ENABLED).toBe(true);
    expect(ROOM_TRANSLATE_ENABLED).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(false);
    expect(shouldBeginRoomDrag({ onMoveRoom })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, tool: "drawRoom" })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, tool: "calibrate" })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, drawing: true })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, calibrating: true })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, linePickActive: true })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, circlePickActive: true })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, polygonPickActive: true })).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom, unionPickActive: true })).toBe(false);
  });

  it("still computes pointer deltas, but does not apply a translation while it is off", () => {
    expect(roomDragDelta({ x: 0, y: 0 }, { x: 2, y: 1 })).toEqual({ x: 2, y: 1 });
    expect(roomDragDelta({ x: 0, y: 0 }, { x: 2, y: 1 }, true)).toEqual({ x: 2, y: 0 });
    expect(roomDragDelta({ x: 1, y: 1 }, { x: 1.2, y: 4 }, true)).toEqual({ x: 0, y: 3 });

    const onMoveRoom = vi.fn();
    const first = applyRoomDrag(
      onMoveRoom,
      "room-1",
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 1 }
    );
    expect(first).toEqual({ x: 0, y: 0 });
    expect(onMoveRoom).not.toHaveBeenCalled();
  });

  it("does not start or apply a move without a handler or an active room", () => {
    const onMoveRoom = vi.fn();
    expect(applyRoomDrag(undefined, "room-1", { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      applyRoomDrag(onMoveRoom, null, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })
    ).toEqual({ x: 0, y: 0 });
    expect(onMoveRoom).not.toHaveBeenCalled();
  });
});
