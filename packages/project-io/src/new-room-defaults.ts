import type { ProjectSceneV2, RoomV2, Vec2 } from "./types";

/**
 * Documented blank-room overall maintenance factor (0.80).
 * This is the official new-room default, not the CIE 97 default
 * product from defaultMaintenanceFactor() (~0.80).
 */
export const DEFAULT_NEW_ROOM_MAINTENANCE_FACTOR = 0.8;

export const DEFAULT_NEW_ROOM_WORKPLANE_HEIGHT_M = 0.75;

export const DEFAULT_NEW_ROOM_REFLECTANCE = {
  floor: 0.2,
  ceiling: 0.7,
  walls: 0.5,
} as const;

/** Official editor defaults for a newly drawn or rectangle-created room. */
export function defaultNewRoomCalc(): RoomV2["calc"] {
  return {
    gridSpacing: 0.5,
    interreflection: true,
    bounces: 2,
    computeUgr: true,
    maintenanceFactor: DEFAULT_NEW_ROOM_MAINTENANCE_FACTOR,
    en12464TemplateId: "",
  };
}

export function officialNewRoom(input: {
  id: string;
  storeyId: string;
  name: string;
  polygon: Vec2[];
  heightM: number;
}): RoomV2 {
  return {
    id: input.id,
    storeyId: input.storeyId,
    name: input.name,
    polygon: input.polygon.map((p) => ({ x: p.x, y: p.y })),
    heightM: input.heightM,
    workplaneHeightM: DEFAULT_NEW_ROOM_WORKPLANE_HEIGHT_M,
    reflectance: { ...DEFAULT_NEW_ROOM_REFLECTANCE },
    calc: defaultNewRoomCalc(),
  };
}

/**
 * Append a blank official new room. Does not copy maintenance factor,
 * EN 12464 template, mfBreakdown, or other calc fields from the
 * currently selected room.
 */
export function appendOfficialNewRoom(
  scene: ProjectSceneV2,
  input: { id: string; polygon: Vec2[]; heightM: number }
): ProjectSceneV2 {
  const room = officialNewRoom({
    id: input.id,
    storeyId: scene.ui.activeStoreyId,
    name: `Room ${scene.rooms.length + 1}`,
    polygon: input.polygon,
    heightM: input.heightM,
  });
  return {
    ...scene,
    rooms: [...scene.rooms, room],
    ui: { ...scene.ui, activeRoomId: room.id, tool: "select" },
  };
}
