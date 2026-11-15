import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { officialNewRoom } from "./new-room-defaults";
import { DXF_CLOSED_ROOM_MIN_AREA_M2 } from "./official-dxf-closed-rooms";
import {
  VERTEX_STRETCH_REVERT_STATUS,
  commitStretchedRoomPolygon,
  moveRoomVertex,
  officialRoomPolygonSelfIntersects,
  officialSetRoomPolygon,
  officialStretchRoomVertex,
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
