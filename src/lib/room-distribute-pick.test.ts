import { describe, expect, it } from "vitest";
import {
  DISTRIBUTE_ROOMS_PICK_MORE_STATUS,
  DISTRIBUTE_ROOMS_PICK_READY_STATUS,
  DISTRIBUTE_ROOMS_PICK_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";
import {
  EMPTY_ROOM_DISTRIBUTE_PICK,
  applyOfficialRoomDistributeCommit,
  applyOfficialRoomDistributePick,
  distributeRoomsPickHint,
  roomDistributePickEscapeAction,
  startOfficialRoomDistributePick,
} from "./room-distribute-pick";

describe("official Distribute rooms pick", () => {
  it("uses a selected room on the current storey as the first picked room", () => {
    const started = startOfficialRoomDistributePick("keep", ["keep", "mid", "drop"]);
    expect(started).toEqual({ active: true, roomIds: ["keep"] });
    expect(distributeRoomsPickHint(started)).toBe(DISTRIBUTE_ROOMS_PICK_MORE_STATUS);
  });

  it("starts empty when nothing on this storey is selected", () => {
    const started = startOfficialRoomDistributePick("other", ["keep", "mid", "drop"]);
    expect(started).toEqual({ active: true, roomIds: [] });
    expect(distributeRoomsPickHint(started)).toBe(DISTRIBUTE_ROOMS_PICK_STATUS);
    expect(roomDistributePickEscapeAction(started)).toBe("cancel-in-progress");
    expect(roomDistributePickEscapeAction(EMPTY_ROOM_DISTRIBUTE_PICK)).toBe("pass");
  });

  it("collects three rooms, refuses another storey or a repeat, and commits only at three or more", () => {
    const first = applyOfficialRoomDistributePick(
      { active: true, roomIds: [] },
      "a",
      "s1",
      "s1"
    );
    expect(first).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a"] },
      status: DISTRIBUTE_ROOMS_PICK_MORE_STATUS,
      selectRoomId: "a",
    });

    const storey = applyOfficialRoomDistributePick(
      { active: true, roomIds: ["a"] },
      "b",
      "s2",
      "s1"
    );
    expect(storey).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a"] },
      status: DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
    });

    const second = applyOfficialRoomDistributePick(
      { active: true, roomIds: ["a"] },
      "b",
      "s1",
      "s1"
    );
    expect(second).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a", "b"] },
      status: DISTRIBUTE_ROOMS_PICK_MORE_STATUS,
      selectRoomId: "b",
    });

    const same = applyOfficialRoomDistributePick(
      { active: true, roomIds: ["a", "b"] },
      "a",
      "s1",
      "s1"
    );
    expect(same).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a", "b"] },
      status: DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS,
    });

    const early = applyOfficialRoomDistributeCommit({
      active: true,
      roomIds: ["a", "b"],
    });
    expect(early).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a", "b"] },
      status: DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
    });

    const third = applyOfficialRoomDistributePick(
      { active: true, roomIds: ["a", "b"] },
      "c",
      "s1",
      "s1"
    );
    expect(third).toEqual({
      kind: "status",
      state: { active: true, roomIds: ["a", "b", "c"] },
      status: DISTRIBUTE_ROOMS_PICK_READY_STATUS,
      selectRoomId: "c",
    });

    const ready = applyOfficialRoomDistributeCommit({
      active: true,
      roomIds: ["a", "b", "c"],
    });
    expect(ready).toEqual({
      kind: "distribute",
      state: { active: true, roomIds: ["a", "b", "c"] },
      status: DISTRIBUTE_ROOMS_PICK_READY_STATUS,
      roomIds: ["a", "b", "c"],
    });
  });
});
