import { describe, expect, it, vi } from "vitest";
import { ROOM_DRAG_ENABLED, applyRoomDrag, shouldBeginRoomDrag } from "./room-drag";

describe("room drag lock", () => {
  it("never begins or applies a room move, even if a handler is provided", () => {
    const onMoveRoom = vi.fn();
    expect(ROOM_DRAG_ENABLED).toBe(false);
    expect(shouldBeginRoomDrag(onMoveRoom)).toBe(false);
    const applied = applyRoomDrag(onMoveRoom, "room-1", { x: 0, y: 0 }, { x: 2, y: 1 });
    expect(applied).toBe(false);
    expect(onMoveRoom).not.toHaveBeenCalled();
  });
});
