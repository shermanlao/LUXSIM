import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { officialNewRoom } from "./new-room-defaults";
import { DXF_CLOSED_ROOM_MIN_AREA_M2 } from "./official-dxf-closed-rooms";
import {
  VERTEX_DELETE_REFUSE_STATUS,
  VERTEX_STRETCH_REVERT_STATUS,
  canDeleteRoomVertex,
  canInsertRoomVertex,
  commitDeletedRoomPolygon,
  commitStretchedRoomPolygon,
  deleteRoomVertex,
  insertRoomVertex,
  moveRoomVertex,
  officialDeleteRoomVertex,
  officialInsertRoomVertex,
  officialRoomEdges,
  officialRoomPolygonSelfIntersects,
  officialSetRoomPolygon,
  officialStretchRoomVertex,
  resolveOfficialEdgeInsert,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

function addRoom(scene: ProjectSceneV2, id: string, polygon: Vec2[]) {
  const room = officialNewRoom({
    id,
    storeyId: scene.ui.activeStoreyId,
    name: id,
    polygon,
    heightM: 2.8,
  });
  scene.rooms = [...scene.rooms, room];
  return room;
}

function fixture(
  scene: ProjectSceneV2,
  input: { instanceId: string; roomId: string | null; x: number; y: number }
): FixtureInstance {
  return {
    instanceId: input.instanceId,
    luminaireId: "lum-1",
    storeyId: scene.ui.activeStoreyId,
    roomId: input.roomId,
    name: input.instanceId,
    position: { x: input.x, y: input.y, z: 2.7 },
    rotationDeg: 15,
  };
}

describe("moveRoomVertex", () => {
  it("moves one corner of a rectangle and leaves the other vertices put", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const next = moveRoomVertex(rect, 2, { x: 6, y: 5 });
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 5 },
      { x: 0, y: 4 },
    ]);
    expect(rect[2]).toEqual({ x: 5, y: 4 });
  });

  it("moves one vertex of an L-shaped room and keeps vertex order", () => {
    const next = moveRoomVertex(L_POLYGON, 3, { x: 5, y: 3 });
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 5, y: 3 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ]);
    expect(L_POLYGON[3]).toEqual({ x: 4, y: 4 });
  });

  it("keeps a duplicated closing vertex coincident when either end moves", () => {
    const closed = [...rectPolygon(0, 0, 5, 4), { x: 0, y: 0 }];
    const fromFirst = moveRoomVertex(closed, 0, { x: -1, y: -1 });
    expect(fromFirst[0]).toEqual({ x: -1, y: -1 });
    expect(fromFirst[fromFirst.length - 1]).toEqual({ x: -1, y: -1 });
    expect(fromFirst).toHaveLength(5);
    const fromLast = moveRoomVertex(closed, 4, { x: 1, y: 1 });
    expect(fromLast[0]).toEqual({ x: 1, y: 1 });
    expect(fromLast[4]).toEqual({ x: 1, y: 1 });
  });
});

describe("validate and commit stretched room polygons", () => {
  it("accepts a snapped landing on a stretched rectangle", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const snapped = moveRoomVertex(rect, 1, { x: 5.02, y: 0 });
    expect(validateStretchedRoomPolygon(snapped)).toEqual({ ok: true });
    const committed = commitStretchedRoomPolygon(rect, snapped);
    expect(committed.reverted).toBe(false);
    expect(committed.polygon[1]).toEqual({ x: 5.02, y: 0 });
    expect(committed.status).toBeUndefined();
  });

  it("reverts when fewer than 3 unique vertices remain", () => {
    const triangle: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    const collapsed = moveRoomVertex(triangle, 2, { x: 0, y: 0 });
    expect(validateStretchedRoomPolygon(collapsed)).toEqual({
      ok: false,
      reason: "degenerate-vertices",
    });
    const committed = commitStretchedRoomPolygon(triangle, collapsed);
    expect(committed.reverted).toBe(true);
    expect(committed.polygon).toEqual(triangle);
    expect(committed.status).toBe(VERTEX_STRETCH_REVERT_STATUS["degenerate-vertices"]);
  });

  it("reverts a self-crossing bow-tie", () => {
    const rect = rectPolygon(0, 0, 2, 2);
    const classicBow: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    expect(officialRoomPolygonSelfIntersects(classicBow)).toBe(true);
    expect(validateStretchedRoomPolygon(classicBow)).toEqual({
      ok: false,
      reason: "self-crossing",
    });
    expect(officialRoomPolygonSelfIntersects(rect)).toBe(false);
    expect(officialRoomPolygonSelfIntersects(L_POLYGON)).toBe(false);
    const committed = commitStretchedRoomPolygon(rect, classicBow);
    expect(committed.reverted).toBe(true);
    expect(committed.polygon).toEqual(rect);
    expect(committed.status).toBe(VERTEX_STRETCH_REVERT_STATUS["self-crossing"]);
  });

  it("reverts when the area would fall below the official 0.01 m² skip threshold", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const flat = moveRoomVertex(rect, 2, { x: 5, y: 0.001 });
    const thin: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.005 },
      { x: 0, y: 0.005 },
    ];
    expect(roomAreaM2({ polygon: thin } as never)).toBeLessThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
    expect(validateStretchedRoomPolygon(thin)).toEqual({ ok: false, reason: "area" });
    const committed = commitStretchedRoomPolygon(rect, thin);
    expect(committed.reverted).toBe(true);
    expect(committed.polygon).toEqual(rect);
    expect(committed.status).toBe(VERTEX_STRETCH_REVERT_STATUS.area);
    expect(flat).toHaveLength(4);
  });
});

describe("officialSetRoomPolygon / officialStretchRoomVertex", () => {
  it("updates only that room's polygon and does not translate fixtures or other rooms", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-l", L_POLYGON);
    addRoom(scene, "room-other", rectPolygon(20, 0, 4, 3));
    scene.instances = [
      fixture(scene, { instanceId: "in-l", roomId: "room-l", x: 1, y: 1 }),
      fixture(scene, { instanceId: "in-other", roomId: "room-other", x: 21, y: 1 }),
      fixture(scene, { instanceId: "unassigned", roomId: null, x: 2, y: 2 }),
    ];
    const beforeOther = structuredClone(scene.rooms[1]!);
    const beforeFixtures = structuredClone(scene.instances);
    const moved = officialStretchRoomVertex(scene, "room-l", 1, { x: 9, y: 0 });
    expect(moved.rooms[0]!.polygon[1]).toEqual({ x: 9, y: 0 });
    expect(moved.rooms[0]!.polygon[0]).toEqual({ x: 0, y: 0 });
    expect(moved.rooms[0]!.polygon[2]).toEqual({ x: 8, y: 4 });
    expect(moved.rooms.find((r) => r.id === "room-other")).toEqual(beforeOther);
    expect(moved.instances).toEqual(beforeFixtures);
    expect(officialSetRoomPolygon(scene, "missing", rectPolygon(0, 0, 1, 1))).toBe(scene);
  });
});

describe("insertRoomVertex", () => {
  it("inserts a vertex on a rectangle edge and leaves the other corners put", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const next = insertRoomVertex(rect, 0, { x: 2.5, y: 0 });
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 2.5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
    ]);
    expect(rect).toHaveLength(4);
    expect(canInsertRoomVertex(rect, 0, { x: 2.5, y: 0 })).toBe(true);
    expect(officialRoomEdges(rect)).toHaveLength(4);
  });

  it("inserts on an L-shaped room edge, including the closing edge", () => {
    const onLeg = insertRoomVertex(L_POLYGON, 2, { x: 6, y: 4 });
    expect(onLeg).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 6, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ]);
    const closing = insertRoomVertex(L_POLYGON, 5, { x: 0, y: 4 });
    expect(closing[closing.length - 1]).toEqual({ x: 0, y: 4 });
    expect(closing).toHaveLength(7);
    expect(L_POLYGON).toHaveLength(6);
  });

  it("keeps a duplicated closing vertex when inserting on the first or last edge", () => {
    const closed = [...rectPolygon(0, 0, 5, 4), { x: 0, y: 0 }];
    const onFirst = insertRoomVertex(closed, 0, { x: 2.5, y: 0 });
    expect(onFirst).toEqual([
      { x: 0, y: 0 },
      { x: 2.5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);
    const onLast = insertRoomVertex(closed, 3, { x: 0, y: 2 });
    expect(onLast[0]).toEqual({ x: 0, y: 0 });
    expect(onLast[onLast.length - 1]).toEqual({ x: 0, y: 0 });
    expect(onLast[4]).toEqual({ x: 0, y: 2 });
    expect(onLast).toHaveLength(6);
  });

  it("does not insert a point coincident with either endpoint, or on a zero-length edge", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    expect(canInsertRoomVertex(rect, 0, { x: 0, y: 0 })).toBe(false);
    expect(canInsertRoomVertex(rect, 0, { x: 5, y: 0 })).toBe(false);
    expect(canInsertRoomVertex(rect, 0, { x: 0, y: 1e-7 })).toBe(false);
    expect(insertRoomVertex(rect, 0, { x: 0, y: 0 })).toEqual(rect);
    const collapsed = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(canInsertRoomVertex(collapsed, 0, { x: 0, y: 0 })).toBe(false);
    expect(insertRoomVertex(collapsed, 0, { x: 0.1, y: 0 })).toEqual(collapsed);
  });

  it("uses a DXF snap landing when one is supplied, otherwise the closest point on the edge", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const snapped = resolveOfficialEdgeInsert(rect, 1, { x: 5, y: 2 }, { x: 5.02, y: 1.9 });
    expect(snapped).not.toBeNull();
    expect(snapped!.point).toEqual({ x: 5.02, y: 1.9 });
    expect(snapped!.vertexIndex).toBe(2);
    expect(snapped!.polygon[2]).toEqual({ x: 5.02, y: 1.9 });
    const raw = resolveOfficialEdgeInsert(rect, 0, { x: 2.4, y: -0.3 }, null);
    expect(raw!.point).toEqual({ x: 2.4, y: 0 });
    expect(raw!.vertexIndex).toBe(1);
    expect(resolveOfficialEdgeInsert(rect, 0, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it("reverts an invalid insert-and-stretch back to the pre-insert polygon", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const inserted = insertRoomVertex(rect, 0, { x: 2.5, y: 0 });
    const crossed = moveRoomVertex(inserted, 1, { x: 2.5, y: 5 });
    expect(validateStretchedRoomPolygon(crossed).ok).toBe(false);
    const committed = commitStretchedRoomPolygon(rect, crossed);
    expect(committed.reverted).toBe(true);
    expect(committed.polygon).toEqual(rect);
    expect(committed.polygon).toHaveLength(4);
    expect(committed.status).toBe(VERTEX_STRETCH_REVERT_STATUS["self-crossing"]);

    const slim = rectPolygon(0, 0, 0.2, 0.06);
    const slimInserted = insertRoomVertex(slim, 1, { x: 0.2, y: 0.03 });
    const tiny = moveRoomVertex(slimInserted, 2, { x: 0.001, y: 0.03 });
    expect(roomAreaM2({ polygon: tiny } as never)).toBeLessThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
    const thinCommit = commitStretchedRoomPolygon(slim, tiny);
    expect(thinCommit.reverted).toBe(true);
    expect(thinCommit.polygon).toEqual(slim);
    expect(thinCommit.polygon).toHaveLength(4);
    expect(thinCommit.status).toBe(VERTEX_STRETCH_REVERT_STATUS.area);

    const kept = commitStretchedRoomPolygon(rect, inserted);
    expect(kept.reverted).toBe(false);
    expect(kept.polygon).toEqual(inserted);
  });

  it("updates only that room when inserting a vertex through the scene helper", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-l", L_POLYGON);
    addRoom(scene, "room-other", rectPolygon(20, 0, 4, 3));
    const beforeOther = structuredClone(scene.rooms[1]!);
    const moved = officialInsertRoomVertex(scene, "room-l", 0, { x: 4, y: 0 });
    expect(moved.rooms[0]!.polygon).toHaveLength(7);
    expect(moved.rooms[0]!.polygon[1]).toEqual({ x: 4, y: 0 });
    expect(moved.rooms.find((r) => r.id === "room-other")).toEqual(beforeOther);
    expect(officialInsertRoomVertex(scene, "missing", 0, { x: 1, y: 0 })).toBe(scene);
  });
});

describe("deleteRoomVertex", () => {
  it("deletes one corner of a rectangle and leaves a triangle", () => {
    const rect = rectPolygon(0, 0, 5, 4);
    const next = deleteRoomVertex(rect, 2);
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 0, y: 4 },
    ]);
    expect(rect).toHaveLength(4);
    expect(canDeleteRoomVertex(rect, 2)).toBe(true);
    expect(canDeleteRoomVertex(rect, 4)).toBe(false);
    expect(deleteRoomVertex(rect, 4)).toEqual(rect);
  });

  it("deletes one vertex of an L-shaped room and keeps the official ring order", () => {
    const next = deleteRoomVertex(L_POLYGON, 3);
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ]);
    expect(L_POLYGON).toHaveLength(6);
    expect(L_POLYGON[3]).toEqual({ x: 4, y: 4 });
  });

  it("drops a duplicated closing vertex first, then restores it after the delete", () => {
    const closed = [...rectPolygon(0, 0, 5, 4), { x: 0, y: 0 }];
    const fromFirst = deleteRoomVertex(closed, 0);
    expect(fromFirst).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 4 },
      { x: 5, y: 0 },
    ]);
    const fromLastRing = deleteRoomVertex(closed, 3);
    expect(fromLastRing[0]).toEqual({ x: 0, y: 0 });
    expect(fromLastRing[fromLastRing.length - 1]).toEqual({ x: 0, y: 0 });
    expect(fromLastRing).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 0, y: 0 },
    ]);
    expect(canDeleteRoomVertex(closed, 4)).toBe(false);
  });

  it("refuses a delete that would leave fewer than 3 unique vertices", () => {
    const triangle: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    const next = deleteRoomVertex(triangle, 1);
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
    ]);
    expect(validateStretchedRoomPolygon(next)).toEqual({
      ok: false,
      reason: "degenerate-vertices",
    });
    const committed = commitDeletedRoomPolygon(triangle, next);
    expect(committed.reverted).toBe(true);
    expect(committed.polygon).toEqual(triangle);
    expect(committed.status).toBe(VERTEX_DELETE_REFUSE_STATUS["degenerate-vertices"]);
  });

  it("refuses a delete that would self-cross, and a delete that would go below 0.01 m²", () => {
    const simplePentagon: Vec2[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    expect(officialRoomPolygonSelfIntersects(simplePentagon)).toBe(false);
    const bow = deleteRoomVertex(simplePentagon, 2);
    expect(bow).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(officialRoomPolygonSelfIntersects(bow)).toBe(true);
    const crossed = commitDeletedRoomPolygon(simplePentagon, bow);
    expect(crossed.reverted).toBe(true);
    expect(crossed.polygon).toEqual(simplePentagon);
    expect(crossed.status).toBe(VERTEX_DELETE_REFUSE_STATUS["self-crossing"]);

    const slim = rectPolygon(0, 0, 1, 0.015);
    expect(roomAreaM2({ polygon: slim } as never)).toBeGreaterThanOrEqual(DXF_CLOSED_ROOM_MIN_AREA_M2);
    const tiny = deleteRoomVertex(slim, 2);
    expect(roomAreaM2({ polygon: tiny } as never)).toBeLessThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
    const thinCommit = commitDeletedRoomPolygon(slim, tiny);
    expect(thinCommit.reverted).toBe(true);
    expect(thinCommit.polygon).toEqual(slim);
    expect(thinCommit.polygon).toHaveLength(4);
    expect(thinCommit.status).toBe(VERTEX_DELETE_REFUSE_STATUS.area);
  });

  it("updates only that room when deleting a vertex through the scene helper", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-l", L_POLYGON);
    addRoom(scene, "room-other", rectPolygon(20, 0, 4, 3));
    const beforeOther = structuredClone(scene.rooms[1]!);
    const moved = officialDeleteRoomVertex(scene, "room-l", 3);
    expect(moved.rooms[0]!.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ]);
    expect(moved.rooms.find((r) => r.id === "room-other")).toEqual(beforeOther);
    expect(officialDeleteRoomVertex(scene, "missing", 0)).toBe(scene);
  });
});
