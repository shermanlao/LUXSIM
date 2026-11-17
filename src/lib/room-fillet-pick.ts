import {
  FILLET_ALL_CORNERS_PICK_ROOM_STATUS,
  FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS,
  FILLET_CORNER_PICK_CORNER_STATUS,
  FILLET_CORNER_PICK_ROOM_STATUS,
  FILLET_CORNER_REFUSE_CORNER_STATUS,
  FILLET_CORNER_REFUSE_STOREY_STATUS,
} from "@luxsim/project-io";

export type RoomFilletPickState = {
  active: boolean;
  roomId: string | null;
};

export const EMPTY_ROOM_FILLET_PICK: RoomFilletPickState = {
  active: false,
  roomId: null,
};

export function startOfficialRoomFilletPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomFilletPickState {
  const first =
    selectedRoomId && currentStoreyRoomIds.includes(selectedRoomId) ? selectedRoomId : null;
  return { active: true, roomId: first };
}

export function filletCornerPickHint(state: RoomFilletPickState): string {
  if (!state.active) return "";
  return state.roomId ? FILLET_CORNER_PICK_CORNER_STATUS : FILLET_CORNER_PICK_ROOM_STATUS;
}

export function roomFilletPickEscapeAction(
  state: RoomFilletPickState
): "cancel-in-progress" | "pass" {
  return state.active ? "cancel-in-progress" : "pass";
}

export type OfficialRoomFilletPickResult =
  | {
      kind: "status";
      state: RoomFilletPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "fillet";
      state: RoomFilletPickState;
      status: string;
      roomId: string;
      vertexIndex: number;
    };

/**
 * Room pick for Fillet corner: if no room is selected, click a room on the
 * current storey first. A room already in the pick can be clicked again
 * (the next step is a corner handle). Rooms on another storey are refused.
 */
export function applyOfficialRoomFilletPick(
  state: RoomFilletPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomFilletPickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: FILLET_CORNER_PICK_ROOM_STATUS,
    };
  }
  if (roomStoreyId !== currentStoreyId) {
    return {
      kind: "status",
      state,
      status: FILLET_CORNER_REFUSE_STOREY_STATUS,
    };
  }
  const next: RoomFilletPickState = { active: true, roomId };
  return {
    kind: "status",
    state: next,
    status: FILLET_CORNER_PICK_CORNER_STATUS,
    selectRoomId: roomId,
  };
}

/**
 * Corner-handle pick for Fillet corner. A mid-edge insert handle is not a
 * target — only a non-negative ring-corner index is accepted.
 */
export function applyOfficialRoomFilletCornerPick(
  state: RoomFilletPickState,
  vertexIndex: number
): OfficialRoomFilletPickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: FILLET_CORNER_PICK_ROOM_STATUS,
    };
  }
  if (!state.roomId) {
    return {
      kind: "status",
      state,
      status: FILLET_CORNER_PICK_ROOM_STATUS,
    };
  }
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0) {
    return {
      kind: "status",
      state,
      status: FILLET_CORNER_REFUSE_CORNER_STATUS,
    };
  }
  return {
    kind: "fillet",
    state,
    status: FILLET_CORNER_PICK_CORNER_STATUS,
    roomId: state.roomId,
    vertexIndex,
  };
}

export type RoomFilletAllPickState = {
  active: boolean;
};

export const EMPTY_ROOM_FILLET_ALL_PICK: RoomFilletAllPickState = {
  active: false,
};

export type OfficialRoomFilletAllStartResult =
  | { kind: "apply"; roomId: string }
  | { kind: "pick"; state: RoomFilletAllPickState; status: string };

/**
 * Start Fillet all corners: if a room on the current storey is already
 * selected, apply immediately. Otherwise enter a room-pick mode. A corner
 * handle is not required.
 */
export function startOfficialRoomFilletAllPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): OfficialRoomFilletAllStartResult {
  const first =
    selectedRoomId && currentStoreyRoomIds.includes(selectedRoomId) ? selectedRoomId : null;
  if (first) return { kind: "apply", roomId: first };
  return {
    kind: "pick",
    state: { active: true },
    status: FILLET_ALL_CORNERS_PICK_ROOM_STATUS,
  };
}

export function filletAllCornersPickHint(state: RoomFilletAllPickState): string {
  if (!state.active) return "";
  return FILLET_ALL_CORNERS_PICK_ROOM_STATUS;
}

export function roomFilletAllPickEscapeAction(
  state: RoomFilletAllPickState
): "cancel-in-progress" | "pass" {
  return state.active ? "cancel-in-progress" : "pass";
}

export type OfficialRoomFilletAllPickResult =
  | {
      kind: "status";
      state: RoomFilletAllPickState;
      status: string;
    }
  | {
      kind: "apply";
      roomId: string;
    };

/**
 * Room pick for Fillet all corners. Mid-edge insert handles are not targets;
 * clicking a room on the current storey applies the command. Rooms on another
 * storey are refused and the pick stays active.
 */
export function applyOfficialRoomFilletAllPick(
  state: RoomFilletAllPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomFilletAllPickResult {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: FILLET_ALL_CORNERS_PICK_ROOM_STATUS,
    };
  }
  if (roomStoreyId !== currentStoreyId) {
    return {
      kind: "status",
      state,
      status: FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS,
    };
  }
  return { kind: "apply", roomId };
}

