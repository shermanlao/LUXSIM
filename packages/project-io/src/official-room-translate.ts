import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

/** Pure translation of a plan point. Vertex order is left to the caller. */
export function translatePlanPoint(point: Vec2, dx: number, dy: number): Vec2 {
  return { x: point.x + dx, y: point.y + dy };
}

function isFiniteDelta(dx: number, dy: number): boolean {
  return Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0);
}

/**
 * Official Select-tool room move: translate one room polygon in world XY
 * without reshaping it, and move fixtures that belong to that room by the
 * same delta. Other rooms, other fixtures, storey elevation / height, and
 * room height are left unchanged. Vertex order is preserved.
 * Does not invent an overlap ban, and does not clear calculation results
 * (matching fixture drag and room-height edits, which also leave results
 * in place until the user recalculates).
 */
export function officialTranslateRoom(
  scene: ProjectSceneV2,
  roomId: string,
  dx: number,
  dy: number
): ProjectSceneV2 {
  if (!isFiniteDelta(dx, dy)) return scene;
  if (!scene.rooms.some((room) => room.id === roomId)) return scene;
  return {
    ...scene,
    rooms: scene.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            polygon: room.polygon.map((point) => translatePlanPoint(point, dx, dy)),
          }
        : room
    ),
    instances: scene.instances.map((inst) =>
      translateOwnedFixture(inst, roomId, dx, dy)
    ),
  };
}

function translateOwnedFixture(
  inst: FixtureInstance,
  roomId: string,
  dx: number,
  dy: number
): FixtureInstance {
  if (inst.roomId !== roomId) return inst;
  return {
    ...inst,
    position: {
      ...inst.position,
      x: inst.position.x + dx,
      y: inst.position.y + dy,
    },
  };
}


/**
 * Official Select-tool storey move: translate every room on one storey by the
 * same world XY delta, without reshaping any room, and move fixtures whose
 * roomId belongs to those rooms by the same delta. Other storeys, unassigned
 * fixtures, storey elevation / height, and room height are left unchanged.
 * Overlap is allowed. Does not clear calculation results (same policy as
 * officialTranslateRoom).
 */
export function officialTranslateStorey(
  scene: ProjectSceneV2,
  storeyId: string,
  dx: number,
  dy: number
): ProjectSceneV2 {
  if (!isFiniteDelta(dx, dy)) return scene;
  if (!scene.storeys.some((storey) => storey.id === storeyId)) return scene;
  const roomIds = scene.rooms.filter((room) => room.storeyId === storeyId).map((room) => room.id);
  if (roomIds.length === 0) return scene;
  return roomIds.reduce(
    (next, roomId) => officialTranslateRoom(next, roomId, dx, dy),
    scene
  );
}
