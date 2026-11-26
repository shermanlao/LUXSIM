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

export type OfficialTwoRoomPickKind = "union" | "subtract" | "intersect" | "xor" | "align";

export type RoomUnionPickState = {
  active: boolean;
  firstRoomId: string | null;
};

export type OfficialTwoRoomPickState = RoomUnionPickState & {
  kind: OfficialTwoRoomPickKind;
};

export const EMPTY_OFFICIAL_TWO_ROOM_PICK: OfficialTwoRoomPickState = {
  active: false,
  firstRoomId: null,
  kind: "union",
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

type TwoRoomPickCopy = {
  pickFirst: string;
  pickSecond: string;
  refuseSame: string;
  refuseStorey: string;
};

const SUBTRACT_PICK_COPY: TwoRoomPickCopy = {
  pickFirst: SUBTRACT_ROOMS_PICK_FIRST_STATUS,
  pickSecond: SUBTRACT_ROOMS_PICK_SECOND_STATUS,
  refuseSame: SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
  refuseStorey: SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
};

export function startOfficialRoomSubtractPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomUnionPickState {
  return startOfficialRoomUnionPick(selectedRoomId, currentStoreyRoomIds);
}

export function subtractRoomsPickHint(state: RoomUnionPickState): string {
  if (!state.active) return "";
  return state.firstRoomId
    ? SUBTRACT_ROOMS_PICK_SECOND_STATUS
    : SUBTRACT_ROOMS_PICK_FIRST_STATUS;
}

export type OfficialRoomSubtractPickResult =
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "subtract";
      state: RoomUnionPickState;
      status: string;
      keepId: string;
      cutterId: string;
      selectRoomId?: string;
    };

/**
 * Same official two-step pick as Union rooms: the first room is kept and
 * cut, the second is the cutter. Rooms on another storey are refused. Esc
 * cancels via roomUnionPickEscapeAction.
 */
export function applyOfficialRoomSubtractPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomSubtractPickResult {
  const picked = applyOfficialTwoRoomPick(
    state,
    roomId,
    roomStoreyId,
    currentStoreyId,
    SUBTRACT_PICK_COPY
  );
  if (picked.kind === "ready") {
    return {
      kind: "subtract",
      state: picked.state,
      status: picked.status,
      keepId: picked.keepId,
      cutterId: picked.removeId,
      selectRoomId: picked.selectRoomId,
    };
  }
  return picked;
}

function applyOfficialTwoRoomPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string,
  copy: TwoRoomPickCopy
):
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "ready";
      state: RoomUnionPickState;
      status: string;
      keepId: string;
      removeId: string;
      selectRoomId?: string;
    } {
  if (!state.active) {
    return {
      kind: "status",
      state,
      status: copy.pickFirst,
    };
  }
  if (roomStoreyId !== currentStoreyId) {
    return {
      kind: "status",
      state,
      status: copy.refuseStorey,
    };
  }
  if (!state.firstRoomId) {
    return {
      kind: "status",
      state: { active: true, firstRoomId: roomId },
      status: copy.pickSecond,
      selectRoomId: roomId,
    };
  }
  if (roomId === state.firstRoomId) {
    return {
      kind: "status",
      state,
      status: copy.refuseSame,
    };
  }
  return {
    kind: "ready",
    state,
    status: copy.pickSecond,
    keepId: state.firstRoomId,
    removeId: roomId,
    selectRoomId: state.firstRoomId,
  };
}

const INTERSECT_PICK_COPY: TwoRoomPickCopy = {
  pickFirst: INTERSECT_ROOMS_PICK_FIRST_STATUS,
  pickSecond: INTERSECT_ROOMS_PICK_SECOND_STATUS,
  refuseSame: INTERSECT_ROOMS_REFUSE_SAME_STATUS,
  refuseStorey: INTERSECT_ROOMS_REFUSE_STOREY_STATUS,
};

export function startOfficialRoomIntersectPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomUnionPickState {
  return startOfficialRoomUnionPick(selectedRoomId, currentStoreyRoomIds);
}

export function intersectRoomsPickHint(state: RoomUnionPickState): string {
  if (!state.active) return "";
  return state.firstRoomId
    ? INTERSECT_ROOMS_PICK_SECOND_STATUS
    : INTERSECT_ROOMS_PICK_FIRST_STATUS;
}

export type OfficialRoomIntersectPickResult =
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "intersect";
      state: RoomUnionPickState;
      status: string;
      keepId: string;
      removeId: string;
      selectRoomId?: string;
    };

/**
 * Same official two-step pick as Union rooms: the first room is kept as the
 * intersection, the second is removed after a successful intersect. Rooms
 * on another storey are refused. Esc cancels via roomUnionPickEscapeAction.
 */
export function applyOfficialRoomIntersectPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomIntersectPickResult {
  const picked = applyOfficialTwoRoomPick(
    state,
    roomId,
    roomStoreyId,
    currentStoreyId,
    INTERSECT_PICK_COPY
  );
  if (picked.kind === "ready") {
    return {
      kind: "intersect",
      state: picked.state,
      status: picked.status,
      keepId: picked.keepId,
      removeId: picked.removeId,
      selectRoomId: picked.selectRoomId,
    };
  }
  return picked;
}

const XOR_PICK_COPY: TwoRoomPickCopy = {
  pickFirst: XOR_ROOMS_PICK_FIRST_STATUS,
  pickSecond: XOR_ROOMS_PICK_SECOND_STATUS,
  refuseSame: XOR_ROOMS_REFUSE_SAME_STATUS,
  refuseStorey: XOR_ROOMS_REFUSE_STOREY_STATUS,
};

export function startOfficialRoomXorPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomUnionPickState {
  return startOfficialRoomUnionPick(selectedRoomId, currentStoreyRoomIds);
}

export function xorRoomsPickHint(state: RoomUnionPickState): string {
  if (!state.active) return "";
  return state.firstRoomId
    ? XOR_ROOMS_PICK_SECOND_STATUS
    : XOR_ROOMS_PICK_FIRST_STATUS;
}

export type OfficialRoomXorPickResult =
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "xor";
      state: RoomUnionPickState;
      status: string;
      keepId: string;
      removeId: string;
      selectRoomId?: string;
    };

/**
 * Same official two-step pick as Union rooms: the first room is kept as the
 * XOR result, the second is removed after a successful XOR. Rooms on
 * another storey are refused. Esc cancels via roomUnionPickEscapeAction.
 */
export function applyOfficialRoomXorPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomXorPickResult {
  const picked = applyOfficialTwoRoomPick(
    state,
    roomId,
    roomStoreyId,
    currentStoreyId,
    XOR_PICK_COPY
  );
  if (picked.kind === "ready") {
    return {
      kind: "xor",
      state: picked.state,
      status: picked.status,
      keepId: picked.keepId,
      removeId: picked.removeId,
      selectRoomId: picked.selectRoomId,
    };
  }
  return picked;
}

const ALIGN_PICK_COPY: TwoRoomPickCopy = {
  pickFirst: ALIGN_ROOMS_PICK_FIRST_STATUS,
  pickSecond: ALIGN_ROOMS_PICK_SECOND_STATUS,
  refuseSame: ALIGN_ROOMS_REFUSE_SAME_STATUS,
  refuseStorey: ALIGN_ROOMS_REFUSE_STOREY_STATUS,
};

export function startOfficialRoomAlignPick(
  selectedRoomId: string | null,
  currentStoreyRoomIds: string[]
): RoomUnionPickState {
  return startOfficialRoomUnionPick(selectedRoomId, currentStoreyRoomIds);
}

export function alignRoomsPickHint(state: RoomUnionPickState): string {
  if (!state.active) return "";
  return state.firstRoomId
    ? ALIGN_ROOMS_PICK_SECOND_STATUS
    : ALIGN_ROOMS_PICK_FIRST_STATUS;
}

export type OfficialRoomAlignPickResult =
  | {
      kind: "status";
      state: RoomUnionPickState;
      status: string;
      selectRoomId?: string;
    }
  | {
      kind: "align";
      state: RoomUnionPickState;
      status: string;
      referenceId: string;
      movingId: string;
      selectRoomId?: string;
    };

/**
 * Same official two-step pick as Union rooms: the first room is the
 * reference and stays put, the second is the room to move. Rooms on
 * another storey are refused. Esc cancels via roomUnionPickEscapeAction.
 */
export function applyOfficialRoomAlignPick(
  state: RoomUnionPickState,
  roomId: string,
  roomStoreyId: string,
  currentStoreyId: string
): OfficialRoomAlignPickResult {
  const picked = applyOfficialTwoRoomPick(
    state,
    roomId,
    roomStoreyId,
    currentStoreyId,
    ALIGN_PICK_COPY
  );
  if (picked.kind === "ready") {
    return {
      kind: "align",
      state: picked.state,
      status: picked.status,
      referenceId: picked.keepId,
      movingId: picked.removeId,
      selectRoomId: picked.selectRoomId,
    };
  }
  return picked;
}
