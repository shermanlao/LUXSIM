import {
  UNION_ROOMS_PICK_FIRST_STATUS,
  UNION_ROOMS_PICK_SECOND_STATUS,
  UNION_ROOMS_REFUSE_SAME_STATUS,
  UNION_ROOMS_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";

export type RoomUnionPickState = {
  active: boolean;
  firstRoomId: string | null;
};

export const EMPTY_ROOM_UNION_PICK: RoomUnionPickState = {
  active: false,
  firstRoomId: null,
};

export function startOfficialRoomUnionPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomUnionPickState {
  const first =
    selectedRoomId && currentStoreyRoomIds.includes(selectedRoomId)
      ? selectedRoomId
      : null;
  return { active: true, firstRoomId: first };
}

export function unionRoomsPickHint(state: RoomUnionPickState): string {
  if (!state.active) return "";
  return state.firstRoomId
    ? UNION_ROOMS_PICK_SECOND_STATUS
    : UNION_ROOMS_PICK_FIRST_STATUS;
}

export function roomUnionPickEscapeAction(
  state: RoomUnionPickState
): "cancel-in-progress" | "pass" {
  return state.active ? "cancel-in-progress" : "pass";
}

export type OfficialRoomUnionPickResult =
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "union";
      state: RoomUnionPickState;
      status: string;
      keepId: string;
      removeId: string;
      selectRoomId?: string;
    };

/**
 * Minimum official two-step pick: the first room is the survivor, the second
 * is merged into it. Rooms on another storey are refused. Esc cancels via
 * roomUnionPickEscapeAction.
 */
export function applyOfficialRoomUnionPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomUnionPickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: UNION_ROOMS_PICK_FIRST_STATUS,
    };
  }
  if (roomStoreyId !== currentStoreyId) {
    return {
      kind: "status",
      state,
      status: UNION_ROOMS_REFUSE_STOREY_STATUS,
    };
  }
  if (!state.firstRoomId) {
    return {
      kind: "status",
      state: { active: true, firstRoomId: roomId },
      status: UNION_ROOMS_PICK_SECOND_STATUS,
      selectRoomId: roomId,
    };
  }
  if (roomId === state.firstRoomId) {
    return {
      kind: "status",
      state,
      status: UNION_ROOMS_REFUSE_SAME_STATUS,
    };
  }
  return {
    kind: "union",
    state,
    status: UNION_ROOMS_PICK_SECOND_STATUS,
    keepId: state.firstRoomId,
    removeId: roomId,
    selectRoomId: state.firstRoomId,
  };
}
