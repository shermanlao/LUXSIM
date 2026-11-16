import {
  DEFAULT_STOREY_HEIGHT_M,
  MIN_STOREY_HEIGHT_M,
} from "./official-storey-metrics";
import type { FixtureInstance, ProjectSceneV2, RoomV2, Storey } from "./types";

/** Elevation match used to treat a storey level as already taken. */
export const COPY_STOREY_ELEVATION_EPS_M = 1e-6;

export const COPY_STOREY_REFUSE_BUILDING_STATUS =
  "Copy storey refused: the building has no storey to copy.";

export const COPY_STOREY_REFUSE_MISSING_STATUS =
  "Copy storey refused: the current storey is missing.";

export const COPY_STOREY_REFUSE_INVALID_STATUS =
  "Copy storey refused: the copy would not be a valid storey.";

export function formatCopyStoreySuccessStatus(
  sourceName: string,
  copyName: string,
  elevationM: number
): string {
  const elevation =
    Number.isInteger(elevationM) || Math.abs(elevationM - Math.round(elevationM)) < 1e-9
      ? String(Math.round(elevationM))
      : elevationM.toFixed(3).replace(/\.?0+$/, "");
  return `Copied storey “${sourceName}” to “${copyName}” (${elevation} m).`;
}

export type OfficialCopyStoreyReason = "building" | "missing" | "invalid";

export type OfficialCopyStoreyResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      sourceStoreyId: string;
      storeyId: string;
      elevationM: number;
      roomIds: string[];
      instanceIds: string[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialCopyStoreyReason;
    };

export type OfficialCopyStoreyInput = {
  /** Id for the new storey. Must not collide with an existing storey. */
  storeyId: string;
  /** Defaults to the scene’s active storey. */
  sourceStoreyId?: string;
  nextRoomId: () => string;
  nextInstanceId: () => string;
};

function refuse(
  scene: ProjectSceneV2,
  reason: OfficialCopyStoreyReason
): OfficialCopyStoreyResult {
  const status =
    reason === "building"
      ? COPY_STOREY_REFUSE_BUILDING_STATUS
      : reason === "missing"
        ? COPY_STOREY_REFUSE_MISSING_STATUS
        : COPY_STOREY_REFUSE_INVALID_STATUS;
  return { ok: false, scene, status, reason };
}

function elevationsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < COPY_STOREY_ELEVATION_EPS_M;
}

function copyHeightM(source: Storey): number {
  if (Number.isFinite(source.heightM) && source.heightM >= MIN_STOREY_HEIGHT_M) {
    return source.heightM;
  }
  return DEFAULT_STOREY_HEIGHT_M;
}

/**
 * Name for a copied storey: “Copy of {name}”, then “Copy of {name} 2”, 3, …
 * if that name is already used.
 */
export function officialCopyStoreyName(
  sourceName: string,
  existingNames: string[]
): string {
  const used = new Set(existingNames);
  const base = `Copy of ${sourceName}`;
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/**
 * Elevation for a copied storey: immediately above the source at
 * source elevation + source storey height, so the new floor sits on top
 * of the source slab rather than overlapping it. If another storey already
 * occupies that elevation (within COPY_STOREY_ELEVATION_EPS_M), step up by
 * the source storey height until a free slot is found.
 */
export function officialCopyStoreyElevationM(
  source: Pick<Storey, "elevationM" | "heightM">,
  occupiedElevations: number[]
): number {
  const step = copyHeightM(source as Storey);
  let elevation = source.elevationM + step;
  let guard = 0;
  while (
    occupiedElevations.some((value) => elevationsMatch(value, elevation)) &&
    guard < 1000
  ) {
    elevation += step;
    guard += 1;
  }
  return elevation;
}

function cloneRoom(room: RoomV2, id: string, storeyId: string): RoomV2 {
  return {
    ...room,
    id,
    storeyId,
    polygon: room.polygon.map((point) => ({ x: point.x, y: point.y })),
    reflectance: { ...room.reflectance },
    calc: {
      ...room.calc,
      mfBreakdown: room.calc.mfBreakdown ? { ...room.calc.mfBreakdown } : undefined,
    },
  };
}

function cloneFixture(
  inst: FixtureInstance,
  instanceId: string,
  storeyId: string,
  roomId: string | null
): FixtureInstance {
  return {
    instanceId,
    luminaireId: inst.luminaireId,
    storeyId,
    roomId,
    name: inst.name,
    position: { x: inst.position.x, y: inst.position.y, z: inst.position.z },
    rotationDeg: inst.rotationDeg,
  };
}

/**
 * Copy the current (or named) storey into a new storey in the same building.
 * The source storey, its rooms, and its luminaires are left unchanged.
 * New rooms and luminaire instances get new ids. Calculation results are
 * not written (they live outside the scene and stay until Calculate).
 * Underlays are not copied.
 */
export function officialCopyStorey(
  scene: ProjectSceneV2,
  input: OfficialCopyStoreyInput
): OfficialCopyStoreyResult {
  if (!scene.storeys.length) {
    return refuse(scene, "building");
  }
  const sourceId = input.sourceStoreyId ?? scene.ui.activeStoreyId;
  if (!sourceId) {
    return refuse(scene, "missing");
  }
  const source = scene.storeys.find((storey) => storey.id === sourceId);
  if (!source) {
    return refuse(scene, "missing");
  }
  if (!input.storeyId || scene.storeys.some((storey) => storey.id === input.storeyId)) {
    return refuse(scene, "invalid");
  }

  const name = officialCopyStoreyName(
    source.name,
    scene.storeys.map((storey) => storey.name)
  );
  const elevationM = officialCopyStoreyElevationM(
    source,
    scene.storeys.map((storey) => storey.elevationM)
  );
  if (
    !Number.isFinite(elevationM) ||
    scene.storeys.some((storey) => elevationsMatch(storey.elevationM, elevationM))
  ) {
    return refuse(scene, "invalid");
  }

  const storey: Storey = {
    id: input.storeyId,
    name,
    elevationM,
    heightM: copyHeightM(source),
  };

  const usedRoomIds = new Set(scene.rooms.map((room) => room.id));
  const roomIdMap = new Map<string, string>();
  const copiedRooms: RoomV2[] = [];
  for (const room of scene.rooms) {
    if (room.storeyId !== source.id) continue;
    const id = input.nextRoomId();
    if (!id || usedRoomIds.has(id) || roomIdMap.has(id)) {
      return refuse(scene, "invalid");
    }
    usedRoomIds.add(id);
    roomIdMap.set(room.id, id);
    copiedRooms.push(cloneRoom(room, id, storey.id));
  }

  const usedInstanceIds = new Set(scene.instances.map((inst) => inst.instanceId));
  const copiedInstances: FixtureInstance[] = [];
  const instanceIds: string[] = [];
  for (const inst of scene.instances) {
    if (inst.storeyId !== source.id) continue;
    const instanceId = input.nextInstanceId();
    if (!instanceId || usedInstanceIds.has(instanceId)) {
      return refuse(scene, "invalid");
    }
    usedInstanceIds.add(instanceId);
    // Assigned rooms on this storey are remapped; a dangling roomId is cleared
    // rather than pointing at the source storey.
    const nextRoomId = inst.roomId == null ? null : roomIdMap.get(inst.roomId) ?? null;
    copiedInstances.push(cloneFixture(inst, instanceId, storey.id, nextRoomId));
    instanceIds.push(instanceId);
  }

  return {
    ok: true,
    scene: {
      ...scene,
      storeys: [...scene.storeys, storey],
      rooms: [...scene.rooms, ...copiedRooms],
      instances: [...scene.instances, ...copiedInstances],
      ui: { ...scene.ui, activeStoreyId: storey.id, activeRoomId: null },
    },
    status: formatCopyStoreySuccessStatus(source.name, name, elevationM),
    sourceStoreyId: source.id,
    storeyId: storey.id,
    elevationM,
    roomIds: copiedRooms.map((room) => room.id),
    instanceIds,
  };
}
