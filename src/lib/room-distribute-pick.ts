import {
  DISTRIBUTE_ROOMS_MIN_COUNT,
  DISTRIBUTE_ROOMS_PICK_MORE_STATUS,
  DISTRIBUTE_ROOMS_PICK_READY_STATUS,
  DISTRIBUTE_ROOMS_PICK_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";

export type RoomDistributePickState = {
  active: boolean;
  roomIds: string[];
};

export const EMPTY_ROOM_DISTRIBUTE_PICK: RoomDistributePickState = {
  active: false,
  roomIds: [],
};

export function startOfficialRoomDistributePick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomDistributePickState {
  const first =
    selectedRoomId && currentStoreyRoomIds.includes(selectedRoomId)
      ? selectedRoomId
      : null;
  return { active: true, roomIds: first ? [first] : [] };
}

export function distributeRoomsPickHint(state: RoomDistributePickState): string {
  if (!state.active) return "";
  if (state.roomIds.length === 0) return DISTRIBUTE_ROOMS_PICK_STATUS;
  if (state.roomIds.length < DISTRIBUTE_ROOMS_MIN_COUNT) {
    return DISTRIBUTE_ROOMS_PICK_MORE_STATUS;
  }
  return DISTRIBUTE_ROOMS_PICK_READY_STATUS;
}

export function roomDistributePickEscapeAction(
  state: RoomDistributePickState
): "cancel-in-progress" | "pass" {
  return state.active ? "cancel-in-progress" : "pass";
}

export type OfficialRoomDistributePickResult =
  | {
      kind: "status";
      state: RoomDistributePickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "distribute";
      state: RoomDistributePickState;
      status: string;
      roomIds: string[];
      selectRoomId?: string;
    };

/**
 * Multi-room pick for Distribute rooms: click three or more rooms on the
 * current storey, then confirm with Enter. Rooms on another storey, or a
 * room already in the set, are refused. Esc cancels via
 * roomDistributePickEscapeAction.
 */
export function applyOfficialRoomDistributePick(
  state: RoomDistributePickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomDistributePickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: DISTRIBUTE_ROOMS_PICK_STATUS,
    };
  }
  if (roomStoreyId !== currentStoreyId) {
    return {
      kind: "status",
      state,
      status: DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
    };
  }
  if (state.roomIds.includes(roomId)) {
    return {
      kind: "status",
      state,
      status: DISTRIBUTE_ROOMS_REFUSE_SAME_STATUS,
    };
  }
  const roomIds = [...state.roomIds, roomId];
  const next: RoomDistributePickState = { active: true, roomIds };
  return {
    kind: "status",
    state: next,
    status: distributeRoomsPickHint(next),
    selectRoomId: roomId,
  };
}

export function applyOfficialRoomDistributeCommit(
  state: RoomDistributePickState
): OfficialRoomDistributePickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: DISTRIBUTE_ROOMS_PICK_STATUS,
    };
  }
  if (state.roomIds.length < DISTRIBUTE_ROOMS_MIN_COUNT) {
    return {
      kind: "status",
      state,
      status: DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
    };
  }
  return {
    kind: "distribute",
    state,
    status: DISTRIBUTE_ROOMS_PICK_READY_STATUS,
    roomIds: state.roomIds,
  };
}
