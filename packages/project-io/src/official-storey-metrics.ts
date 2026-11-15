import type { ProjectSceneV2, Storey } from "./types";
import { DEFAULT_NEW_ROOM_HEIGHT_MM } from "./official-room-height";

/** Floor-to-floor height used for a newly added official storey. */
export const DEFAULT_STOREY_HEIGHT_M = 3;

/** Official editor minimum for a storey height field. */
export const MIN_STOREY_HEIGHT_M = 0.5;

/**
 * In-UI explanation of storey elevation, storey height, and room height.
 * The 0.2 m gap (3.0 m − 2.8 m) is left for slab / structure and is not modelled.
 */
export const STOREY_METRICS_EXPLANATION =
  "Storey elevation is the floor level of this storey. Storey height is the floor-to-floor spacing (default 3.0 m). Add storey places the next floor at this storey’s elevation + storey height. Room height is the ceiling inside a room (default " +
  DEFAULT_NEW_ROOM_HEIGHT_MM +
  " mm). The 0.2 m difference is left for the slab / structure — it is not modelled automatically. Changing these values does not move other storeys or existing rooms.";

export function officialNextStoreyElevationM(
  last?: Pick<Storey, "elevationM" | "heightM"> | null
): number {
  return (last?.elevationM ?? 0) + (last?.heightM ?? DEFAULT_STOREY_HEIGHT_M);
}

export function officialNewStorey(input: {
  id: string;
  name: string;
  last?: Pick<Storey, "elevationM" | "heightM"> | null;
}): Storey {
  return {
    id: input.id,
    name: input.name,
    elevationM: officialNextStoreyElevationM(input.last),
    heightM: DEFAULT_STOREY_HEIGHT_M,
  };
}

/**
 * Official Add storey write path. The new storey is named L{n}, placed at the
 * previous storey’s elevation + storey height, and given the default 3.0 m
 * storey height. Existing storeys and rooms are left unchanged.
 */
export function officialAppendStorey(
  scene: ProjectSceneV2,
  input: { id: string; name?: string }
): ProjectSceneV2 {
  const last = scene.storeys[scene.storeys.length - 1];
  const storey = officialNewStorey({
    id: input.id,
    name: input.name ?? `L${scene.storeys.length}`,
    last,
  });
  return {
    ...scene,
    storeys: [...scene.storeys, storey],
    ui: { ...scene.ui, activeStoreyId: storey.id, activeRoomId: null },
  };
}

/**
 * Update only the named storey’s elevation and/or height.
 * Does not move other storeys or any rooms.
 */
export function applyOfficialStoreyMetrics(
  scene: ProjectSceneV2,
  storeyId: string,
  patch: { elevationM?: number; heightM?: number }
): ProjectSceneV2 {
  const nextElevation =
    patch.elevationM != null && Number.isFinite(patch.elevationM)
      ? patch.elevationM
      : undefined;
  const nextHeight =
    patch.heightM != null &&
    Number.isFinite(patch.heightM) &&
    patch.heightM >= MIN_STOREY_HEIGHT_M
      ? patch.heightM
      : undefined;
  if (nextElevation == null && nextHeight == null) return scene;

  let changed = false;
  const storeys = scene.storeys.map((storey) => {
    if (storey.id !== storeyId) return storey;
    const elevationM = nextElevation ?? storey.elevationM;
    const heightM = nextHeight ?? storey.heightM;
    if (elevationM === storey.elevationM && heightM === storey.heightM) {
      return storey;
    }
    changed = true;
    return { ...storey, elevationM, heightM };
  });
  return changed ? { ...scene, storeys } : scene;
}
