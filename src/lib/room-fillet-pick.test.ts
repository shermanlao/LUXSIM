import { describe, expect, it } from "vitest";
import {
  FILLET_CORNER_PICK_CORNER_STATUS,
  FILLET_CORNER_PICK_ROOM_STATUS,
  FILLET_CORNER_REFUSE_CORNER_STATUS,
  FILLET_CORNER_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";
import {
  EMPTY_ROOM_FILLET_PICK,
  applyOfficialRoomFilletCornerPick,
  applyOfficialRoomFilletPick,
  filletCornerPickHint,
  roomFilletPickEscapeAction,
  startOfficialRoomFilletPick,
} from "./room-fillet-pick";

describe("official Fillet corner pick", () => {
  it("uses a selected room on the current storey as the fillet target", () => {
    const started = startOfficialRoomFilletPick("keep", ["keep", "other"]);
    expect(started).toEqual({ active: true, roomId: "keep" });
    expect(filletCornerPickHint(started)).toBe(FILLET_CORNER_PICK_CORNER_STATUS);
    expect(roomFilletPickEscapeAction(started)).toBe("cancel-in-progress");
  });

  it("starts without a room when nothing on this storey is selected", () => {
    const started = startOfficialRoomFilletPick("other", ["keep"]);
    expect(started).toEqual({ active: true, roomId: null });
    expect(filletCornerPickHint(started)).toBe(FILLET_CORNER_PICK_ROOM_STATUS);
    expect(roomFilletPickEscapeAction(EMPTY_ROOM_FILLET_PICK)).toBe("pass");
  });

  it("picks a room on this storey, refuses another storey, and requires a corner handle", () => {
    const first = applyOfficialRoomFilletPick(
      { active: true, roomId: null },
      "a",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, roomId: "a" },
      status: FILLET_CORNER_PICK_CORNER_STATUS,
      selectRoomId: "a",
    });

    const storey = applyOfficialRoomFilletPick(
      { active: true, roomId: "a" },
      "b",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, roomId: "a" },
      status: FILLET_CORNER_REFUSE_STOREY_STATUS,
    });

    const retarget = applyOfficialRoomFilletPick(
      { active: true, roomId: "a" },
      "c",
      "s1",
      "s1"
    );
    expect(retarget.selectRoomId).toBe("c");
    expect(retarget.state).toEqual({ active: true, roomId: "c" });

    const noRoom = applyOfficialRoomFilletCornerPick({ active: true, roomId: null }, 0);
    expect(noRoom).toEqual({
      kind: "status",
      state: { active: true, roomId: null },
      status: FILLET_CORNER_PICK_ROOM_STATUS,
    });

    const midEdge = applyOfficialRoomFilletCornerPick({ active: true, roomId: "a" }, -1);
    expect(midEdge).toEqual({
      kind: "status",
      state: { active: true, roomId: "a" },
      status: FILLET_CORNER_REFUSE_CORNER_STATUS,
    });

    const corner = applyOfficialRoomFilletCornerPick({ active: true, roomId: "a" }, 2);
    expect(corner).toEqual({
      kind: "fillet",
      state: { active: true, roomId: "a" },
      status: FILLET_CORNER_PICK_CORNER_STATUS,
      roomId: "a",
      vertexIndex: 2,
    });
  });
});
