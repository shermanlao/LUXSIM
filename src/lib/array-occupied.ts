/** Same-room XY coincidence threshold used when applying fixture arrays (1 mm). Z is ignored. */
export const ARRAY_OCCUPIED_EPS_M = 0.001;

/** Inclusive XY box, with a tiny float slop so a true 1 mm offset counts as occupied. */
export function xyWithinOccupiedEps(
  a: { x: number; y: number },
  b: { x: number; y: number },
  epsM: number = ARRAY_OCCUPIED_EPS_M
): boolean {
  const slopM = 1e-12;
  return Math.abs(a.x - b.x) <= epsM + slopM && Math.abs(a.y - b.y) <= epsM + slopM;
}

export type OccupiedFixtureRef = {
  roomId: string | null;
  position: { x: number; y: number; z?: number };
};

export type OccupiedFilterResult<T extends { x: number; y: number }> = {
  placeable: T[];
  skippedOccupied: T[];
};

export type FixtureArrayApplyPlan<T extends { x: number; y: number }> = {
  inside: T[];
  skippedOutside: number;
};

export type FixtureArrayApplyDecision<T extends { x: number; y: number }> = {
  placeable: T[];
  skippedOccupied: T[];
  skippedOutside: number;
  /**
   * Confirm copy when some proposed points fall outside the room and at least
   * one in-room point remains free to place. Null means no confirm is needed.
   */
  confirmMessage: string | null;
};

/**
 * Drop proposed array points that already have an instance in the same room
 * at the same X/Y (within eps). Existing instances are never moved or deleted.
 * Instances in other rooms are ignored even if XY matches. Z is ignored.
 */
export function filterPointsOccupiedInRoom<T extends { x: number; y: number }>(
  points: T[],
  existing: OccupiedFixtureRef[],
  roomId: string,
  epsM: number = ARRAY_OCCUPIED_EPS_M
): OccupiedFilterResult<T> {
  const inRoom = existing.filter((inst) => inst.roomId === roomId);
  const placeable: T[] = [];
  const skippedOccupied: T[] = [];

  for (const point of points) {
    const occupied = inRoom.some((inst) =>
      xyWithinOccupiedEps({ x: point.x, y: point.y }, inst.position, epsM)
    );
    if (occupied) skippedOccupied.push(point);
    else placeable.push(point);
  }

  return { placeable, skippedOccupied };
}

/** Confirm copy kept when some planned points fall outside the room. */
export function formatArrayOutsideConfirm(args: {
  skippedOutside: number;
  skippedOccupied: number;
  placeable: number;
}): string {
  const occupiedNote =
    args.skippedOccupied > 0
      ? ` ${args.skippedOccupied} already at an existing fixture will also be skipped.`
      : "";
  return `${args.skippedOutside} point(s) fall outside the room and will be skipped.${occupiedNote} Place ${args.placeable} fixture(s)?`;
}

/**
 * Apply-equivalent decision for Rectangular / Line / target-Ēm arrays:
 * keep in-room points, drop same-room occupied XY, and build the outside-room
 * confirm when something remains to place. Does not write or delete instances.
 */
export function prepareFixtureArrayApply<T extends { x: number; y: number }>(
  plan: FixtureArrayApplyPlan<T>,
  existing: OccupiedFixtureRef[],
  roomId: string,
  epsM: number = ARRAY_OCCUPIED_EPS_M
): FixtureArrayApplyDecision<T> {
  const occupied = filterPointsOccupiedInRoom(plan.inside, existing, roomId, epsM);
  const confirmMessage =
    plan.skippedOutside > 0 && occupied.placeable.length > 0
      ? formatArrayOutsideConfirm({
          skippedOutside: plan.skippedOutside,
          skippedOccupied: occupied.skippedOccupied.length,
          placeable: occupied.placeable.length,
        })
      : null;
  return {
    placeable: occupied.placeable,
    skippedOccupied: occupied.skippedOccupied,
    skippedOutside: plan.skippedOutside,
    confirmMessage,
  };
}

/** Status line after Rectangular / Line / target-Ēm Apply. */
export function formatArrayApplyStatus(args: {
  placed: number;
  skippedOccupied: number;
  roomName: string;
  suffix?: string;
}): string {
  const placedPart = `Array placed ${args.placed} fixture(s) in ${args.roomName}`;
  const skipPart =
    args.skippedOccupied > 0
      ? ` · skipped ${args.skippedOccupied} already at that position`
      : "";
  const keepPart =
    " (adds to the room, existing fixtures kept) / 套用為新增，不會取代既有燈具";
  return `${placedPart}${skipPart}${keepPart}${args.suffix ?? ""}`;
}
