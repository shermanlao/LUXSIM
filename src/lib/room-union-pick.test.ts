import { describe, expect, it } from "vitest";
import {
  INTERSECT_ROOMS_PICK_FIRST_STATUS,
  INTERSECT_ROOMS_PICK_SECOND_STATUS,
  INTERSECT_ROOMS_REFUSE_SAME_STATUS,
  INTERSECT_ROOMS_REFUSE_STOREY_STATUS,
  XOR_ROOMS_PICK_FIRST_STATUS,
  XOR_ROOMS_PICK_SECOND_STATUS,
  XOR_ROOMS_REFUSE_SAME_STATUS,
  XOR_ROOMS_REFUSE_STOREY_STATUS,
  ALIGN_ROOMS_PICK_FIRST_STATUS,
  ALIGN_ROOMS_PICK_SECOND_STATUS,
  ALIGN_ROOMS_REFUSE_SAME_STATUS,
  ALIGN_ROOMS_REFUSE_STOREY_STATUS,
  SUBTRACT_ROOMS_PICK_FIRST_STATUS,
  SUBTRACT_ROOMS_PICK_SECOND_STATUS,
  SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
  SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
  UNION_ROOMS_PICK_FIRST_STATUS,
  UNION_ROOMS_PICK_SECOND_STATUS,
  UNION_ROOMS_REFUSE_SAME_STATUS,
  UNION_ROOMS_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";
import {
  EMPTY_ROOM_UNION_PICK,
  applyOfficialRoomIntersectPick,
  applyOfficialRoomSubtractPick,
  applyOfficialRoomUnionPick,
  applyOfficialRoomAlignPick,
  applyOfficialRoomXorPick,
  alignRoomsPickHint,
  intersectRoomsPickHint,
  roomUnionPickEscapeAction,
  startOfficialRoomAlignPick,
  startOfficialRoomIntersectPick,
  startOfficialRoomSubtractPick,
  startOfficialRoomUnionPick,
  startOfficialRoomXorPick,
  subtractRoomsPickHint,
  unionRoomsPickHint,
  xorRoomsPickHint,
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

describe("official Subtract rooms pick", () => {
  it("uses a selected room on the current storey as the first (kept) room", () => {
    const started = startOfficialRoomSubtractPick("keep", ["keep", "cutter"]);
    expect(started).toEqual({ active: true, firstRoomId: "keep" });
    expect(subtractRoomsPickHint(started)).toBe(SUBTRACT_ROOMS_PICK_SECOND_STATUS);
  });

  it("starts with no first room when nothing on this storey is selected", () => {
    const started = startOfficialRoomSubtractPick("other", ["keep", "cutter"]);
    expect(started).toEqual({ active: true, firstRoomId: null });
    expect(subtractRoomsPickHint(started)).toBe(SUBTRACT_ROOMS_PICK_FIRST_STATUS);
    expect(roomUnionPickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomUnionPickEscapeAction(EMPTY_ROOM_UNION_PICK)).toBe("pass");
  });

  it("picks the first room, then asks for a cutter, and refuses another storey or the same room", () => {
    const first = applyOfficialRoomSubtractPick(
      { active: true, firstRoomId: null },
      "keep",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: SUBTRACT_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: "keep",
    });

    const storey = applyOfficialRoomSubtractPick(
      { active: true, firstRoomId: "keep" },
      "cutter",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
    });

    const same = applyOfficialRoomSubtractPick(
      { active: true, firstRoomId: "keep" },
      "keep",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
    });

    const ready = applyOfficialRoomSubtractPick(
      { active: true, firstRoomId: "keep" },
      "cutter",
      "s1",
      "s1"
    );
    expect(ready).toEqual({
      kind: "subtract",
      state: { active: true, firstRoomId: "keep" },
      status: SUBTRACT_ROOMS_PICK_SECOND_STATUS,
      keepId: "keep",
      cutterId: "cutter",
      selectRoomId: "keep",
    });
  });
});

describe("official Intersect rooms pick", () => {
  it("uses a selected room on the current storey as the first (kept) room", () => {
    const started = startOfficialRoomIntersectPick("keep", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: "keep" });
    expect(intersectRoomsPickHint(started)).toBe(INTERSECT_ROOMS_PICK_SECOND_STATUS);
  });

  it("starts with no first room when nothing on this storey is selected", () => {
    const started = startOfficialRoomIntersectPick("other", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: null });
    expect(intersectRoomsPickHint(started)).toBe(INTERSECT_ROOMS_PICK_FIRST_STATUS);
    expect(roomUnionPickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomUnionPickEscapeAction(EMPTY_ROOM_UNION_PICK)).toBe("pass");
  });

  it("picks the first room, then asks for a second, and refuses another storey or the same room", () => {
    const first = applyOfficialRoomIntersectPick(
      { active: true, firstRoomId: null },
      "keep",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: INTERSECT_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: "keep",
    });

    const storey = applyOfficialRoomIntersectPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: INTERSECT_ROOMS_REFUSE_STOREY_STATUS,
    });

    const same = applyOfficialRoomIntersectPick(
      { active: true, firstRoomId: "keep" },
      "keep",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: INTERSECT_ROOMS_REFUSE_SAME_STATUS,
    });

    const ready = applyOfficialRoomIntersectPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s1",
      "s1"
    );
    expect(ready).toEqual({
      kind: "intersect",
      state: { active: true, firstRoomId: "keep" },
      status: INTERSECT_ROOMS_PICK_SECOND_STATUS,
      keepId: "keep",
      removeId: "drop",
      selectRoomId: "keep",
    });
  });
});

describe("official XOR rooms pick", () => {
  it("uses a selected room on the current storey as the first (kept) room", () => {
    const started = startOfficialRoomXorPick("keep", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: "keep" });
    expect(xorRoomsPickHint(started)).toBe(XOR_ROOMS_PICK_SECOND_STATUS);
  });

  it("starts with no first room when nothing on this storey is selected", () => {
    const started = startOfficialRoomXorPick("other", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: null });
    expect(xorRoomsPickHint(started)).toBe(XOR_ROOMS_PICK_FIRST_STATUS);
    expect(roomUnionPickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomUnionPickEscapeAction(EMPTY_ROOM_UNION_PICK)).toBe("pass");
  });

  it("picks the first room, then asks for a second, and refuses another storey or the same room", () => {
    const first = applyOfficialRoomXorPick(
      { active: true, firstRoomId: null },
      "keep",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: XOR_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: "keep",
    });

    const storey = applyOfficialRoomXorPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: XOR_ROOMS_REFUSE_STOREY_STATUS,
    });

    const same = applyOfficialRoomXorPick(
      { active: true, firstRoomId: "keep" },
      "keep",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: XOR_ROOMS_REFUSE_SAME_STATUS,
    });

    const ready = applyOfficialRoomXorPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s1",
      "s1"
    );
    expect(ready).toEqual({
      kind: "xor",
      state: { active: true, firstRoomId: "keep" },
      status: XOR_ROOMS_PICK_SECOND_STATUS,
      keepId: "keep",
      removeId: "drop",
      selectRoomId: "keep",
    });
  });
});

describe("official Align rooms pick", () => {
  it("uses a selected room on the current storey as the reference", () => {
    const started = startOfficialRoomAlignPick("keep", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: "keep" });
    expect(alignRoomsPickHint(started)).toBe(ALIGN_ROOMS_PICK_SECOND_STATUS);
  });

  it("starts with no first room when nothing on this storey is selected", () => {
    const started = startOfficialRoomAlignPick("other", ["keep", "drop"]);
    expect(started).toEqual({ active: true, firstRoomId: null });
    expect(alignRoomsPickHint(started)).toBe(ALIGN_ROOMS_PICK_FIRST_STATUS);
    expect(roomUnionPickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomUnionPickEscapeAction(EMPTY_ROOM_UNION_PICK)).toBe("pass");
  });

  it("picks the reference, then asks for a room to move, and refuses another storey or the same room", () => {
    const first = applyOfficialRoomAlignPick(
      { active: true, firstRoomId: null },
      "keep",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: ALIGN_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: "keep",
    });

    const storey = applyOfficialRoomAlignPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: ALIGN_ROOMS_REFUSE_STOREY_STATUS,
    });

    const same = applyOfficialRoomAlignPick(
      { active: true, firstRoomId: "keep" },
      "keep",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, firstRoomId: "keep" },
      status: ALIGN_ROOMS_REFUSE_SAME_STATUS,
    });

    const ready = applyOfficialRoomAlignPick(
      { active: true, firstRoomId: "keep" },
      "drop",
      "s1",
      "s1"
    );
    expect(ready).toEqual({
      kind: "align",
      state: { active: true, firstRoomId: "keep" },
      status: ALIGN_ROOMS_PICK_SECOND_STATUS,
      referenceId: "keep",
      movingId: "drop",
      selectRoomId: "keep",
    });
  });
});
