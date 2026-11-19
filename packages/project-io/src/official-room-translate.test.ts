import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon, roomAreaM2, roomBounds } from "./geometry";
import { officialNewRoom } from "./new-room-defaults";
import { officialTranslateRoom } from "./official-room-translate";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

const SKEW_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 1 },
  { x: 3.5, y: 3.5 },
  { x: -0.5, y: 2 },
];

function addRoom(
  scene: ProjectSceneV2,
  id: string,
  polygon: Vec2[],
  name = id
) {
  const room = officialNewRoom({
    id,
    storeyId: scene.ui.activeStoreyId,
    name,
    polygon,
    heightM: 2.8,
  });
  scene.rooms = [...scene.rooms, room];
  return room;
}

function fixture(
  scene: ProjectSceneV2,
  input: {
    instanceId: string;
    roomId: string | null;
    x: number;
    y: number;
    z?: number;
    rotationDeg?: number;
  }
): FixtureInstance {
  return {
    instanceId: input.instanceId,
    luminaireId: "lum-1",
    storeyId: scene.ui.activeStoreyId,
    roomId: input.roomId,
    name: input.instanceId,
    position: { x: input.x, y: input.y, z: input.z ?? 2.7 },
    rotationDeg: input.rotationDeg ?? 15,
  };
}

describe("officialTranslateRoom", () => {
  it("translates a rectangle without reshaping it and updates the first-corner origin", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-rect", rectPolygon(0, 0, 5, 4));
    const moved = officialTranslateRoom(scene, "room-rect", 2, -1.5);
    const room = moved.rooms[0]!;
    expect(room.polygon).toEqual([
      { x: 2, y: -1.5 },
      { x: 7, y: -1.5 },
      { x: 7, y: 2.5 },
      { x: 2, y: 2.5 },
    ]);
    expect(roomAreaM2(room)).toBe(20);
    expect(room.polygon[0]).toEqual({ x: 2, y: -1.5 });
    const bounds = roomBounds(room);
    expect(bounds.minX).toBe(2);
    expect(bounds.minY).toBe(-1.5);
    expect(room.heightM).toBe(2.8);
    expect(moved.storeys[0]).toEqual(scene.storeys[0]);
  });

  it("translates an L-shaped room, keeps vertex order, and moves only that room's fixtures", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-l", L_POLYGON, "L lounge");
    addRoom(scene, "room-other", rectPolygon(20, 0, 4, 3), "Other");
    scene.instances = [
      fixture(scene, { instanceId: "in-l", roomId: "room-l", x: 1, y: 1, z: 2.6 }),
      fixture(scene, { instanceId: "in-other", roomId: "room-other", x: 21, y: 1 }),
      fixture(scene, { instanceId: "unassigned", roomId: null, x: 2, y: 2 }),
    ];
    const beforeArea = roomAreaM2(scene.rooms[0]!);
    const beforeOther = structuredClone(scene.rooms[1]!);
    const beforeOtherFix = structuredClone(scene.instances[1]!);
    const beforeLoose = structuredClone(scene.instances[2]!);
    const moved = officialTranslateRoom(scene, "room-l", 3, 0.5);
    const room = moved.rooms.find((r) => r.id === "room-l")!;
    expect(room.polygon.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 3, y: 0.5 },
      { x: 11, y: 0.5 },
      { x: 11, y: 4.5 },
      { x: 7, y: 4.5 },
      { x: 7, y: 8.5 },
      { x: 3, y: 8.5 },
    ]);
    expect(roomAreaM2(room)).toBe(beforeArea);
    expect(room.polygon[0]).toEqual({ x: 3, y: 0.5 });
    expect(moved.rooms.find((r) => r.id === "room-other")).toEqual(beforeOther);
    expect(moved.instances.find((i) => i.instanceId === "in-l")?.position).toEqual({
      x: 4,
      y: 1.5,
      z: 2.6,
    });
    expect(moved.instances.find((i) => i.instanceId === "in-l")?.rotationDeg).toBe(15);
    expect(moved.instances.find((i) => i.instanceId === "in-other")).toEqual(beforeOtherFix);
    expect(moved.instances.find((i) => i.instanceId === "unassigned")).toEqual(beforeLoose);
  });

  it("translates a non-orthogonal room and preserves area and winding", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-skew", SKEW_POLYGON, "Skew");
    const before = scene.rooms[0]!;
    const beforeArea = roomAreaM2(before);
    const moved = officialTranslateRoom(scene, "room-skew", -1, 2);
    const room = moved.rooms[0]!;
    expect(room.polygon).toEqual([
      { x: -1, y: 2 },
      { x: 3, y: 3 },
      { x: 2.5, y: 5.5 },
      { x: -1.5, y: 4 },
    ]);
    expect(roomAreaM2(room)).toBeCloseTo(beforeArea, 10);
    const bounds = roomBounds(room);
    expect(bounds.minX).toBe(-1.5);
    expect(bounds.minY).toBe(2);
    expect(room.polygon[0]).toEqual({ x: -1, y: 2 });
  });

  it("is a no-op for a missing room or a zero / non-finite delta", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-rect", rectPolygon(0, 0, 5, 4));
    const snapshot = structuredClone(scene);
    expect(officialTranslateRoom(scene, "missing", 1, 1)).toBe(scene);
    expect(officialTranslateRoom(scene, "room-rect", 0, 0)).toBe(scene);
    expect(officialTranslateRoom(scene, "room-rect", Number.NaN, 1)).toBe(scene);
    expect(officialTranslateRoom(scene, "room-rect", 1, Number.POSITIVE_INFINITY)).toBe(scene);
    expect(scene).toEqual(snapshot);
  });
});
