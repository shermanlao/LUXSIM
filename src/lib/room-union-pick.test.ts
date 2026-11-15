import { describe, expect, it } from "vitest";
import {
  UNION_ROOMS_PICK_FIRST_STATUS,
  UNION_ROOMS_PICK_SECOND_STATUS,
  UNION_ROOMS_REFUSE_SAME_STATUS,
  UNION_ROOMS_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";
import {
  EMPTY_ROOM_UNION_PICK,
  applyOfficialRoomUnionPick,
  roomUnionPickEscapeAction,
  startOfficialRoomUnionPick,
  unionRoomsPickHint,
} from "./room-union-pick";

describe("official Union rooms pick", () => {
  it("uses a selected room on the current storey as the first (surviving) room", () => {
    const started = startOfficialRoomUnionPick("keep", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: "keep" });
    expect(unionRoomsPickHint(started)).toBe(UNION_ROOMS_PICK_SECOND_STATUS);
  });

  it("starts with no first room when nothing on this storey is selected", () => {
    const started = startOfficialRoomUnionPick("other", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: null });
    expect(unionRoomsPickHint(started)).toBe(UNION_ROOMS_PICK_FIRST_STATUS);
    expect(roomUnionPickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomUnionPickEscapeAction(EMPTY_ROOM_UNION_PICK)).toBe("pass");
  });

  it("picks the first room, then asks for a second, and refuses another storey or the same room", () => {
    const first = applyOfficialRoomUnionPick(
      { active: true, firstRoomId: null },
      "keep",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: UNION_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: "keep",
    });

    const storey = applyOfficialRoomUnionPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: UNION_ROOMS_REFUSE_STOREY_STATUS,
    });

    const same = applyOfficialRoomUnionPick(
      { active: true, firstRoomId: "keep" },
      "keep",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: UNION_ROOMS_REFUSE_SAME_STATUS,
    });

    const ready = applyOfficialRoomUnionPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s1",
      "s1"
    );
    expect(ready).toEqual({
      kind: "union",
      state: { active: true, firstRoomId: "keep" },
      status: UNION_ROOMS_PICK_SECOND_STATUS,
      keepId: "keep",
      removeId: "drop",
      selectRoomId: "keep",
    });
  });
});
