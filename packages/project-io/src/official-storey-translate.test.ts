import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon, roomAreaM2, roomBounds } from "./geometry";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { officialTranslateStorey } from "./official-room-translate";
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
  storeyId = scene.ui.activeStoreyId,
  name = id
) {
  const room = officialNewRoom({
    id,
    storeyId,
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
    storeyId?: string;
    x: number;
    y: number;
    z?: number;
    rotationDeg?: number;
  }
): FixtureInstance {
  return {
    instanceId: input.instanceId,
    luminaireId: "lum-1",
    storeyId: input.storeyId ?? scene.ui.activeStoreyId,
    roomId: input.roomId,
    name: input.instanceId,
    position: { x: input.x, y: input.y, z: input.z ?? 2.7 },
    rotationDeg: input.rotationDeg ?? 15,
  };
}

describe("officialTranslateStorey", () => {
  it("translates every room on a storey, including an L-shape, and moves only those rooms' fixtures", () => {
    const scene = defaultSceneV2();
    const gfId = scene.ui.activeStoreyId;
    addRoom(scene, "room-l", L_POLYGON, gfId, "L lounge");
    addRoom(scene, "room-rect", rectPolygon(20, 0, 4, 3), gfId, "Rect");
    scene.instances = [
      fixture(scene, { instanceId: "in-l", roomId: "room-l", x: 1, y: 1, z: 2.6 }),
      fixture(scene, { instanceId: "in-rect", roomId: "room-rect", x: 21, y: 1, rotationDeg: 40 }),
      fixture(scene, { instanceId: "unassigned", roomId: null, x: 2, y: 2 }),
    ];
    const beforeLArea = roomAreaM2(scene.rooms[0]!);
    const beforeRectArea = roomAreaM2(scene.rooms[1]!);
    const beforeLoose = structuredClone(scene.instances[2]!);
    const beforeStorey = structuredClone(scene.storeys[0]!);

    const moved = officialTranslateStorey(scene, gfId, 3, 0.5);
    const roomL = moved.rooms.find((r) => r.id === "room-l")!;
    const roomRect = moved.rooms.find((r) => r.id === "room-rect")!;

    expect(roomL.polygon.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 3, y: 0.5 },
      { x: 11, y: 0.5 },
      { x: 11, y: 4.5 },
      { x: 7, y: 4.5 },
      { x: 7, y: 8.5 },
      { x: 3, y: 8.5 },
    ]);
    expect(roomAreaM2(roomL)).toBe(beforeLArea);
    expect(roomL.polygon[0]).toEqual({ x: 3, y: 0.5 });
    expect(roomRect.polygon).toEqual([
      { x: 23, y: 0.5 },
      { x: 27, y: 0.5 },
      { x: 27, y: 3.5 },
      { x: 23, y: 3.5 },
    ]);
    expect(roomAreaM2(roomRect)).toBe(beforeRectArea);
    const bounds = roomBounds(roomRect);
    expect(bounds.minX).toBe(23);
    expect(bounds.minY).toBe(0.5);

    expect(moved.instances.find((i) => i.instanceId === "in-l")?.position).toEqual({
      x: 4,
      y: 1.5,
      z: 2.6,
    });
    expect(moved.instances.find((i) => i.instanceId === "in-l")?.rotationDeg).toBe(15);
    expect(moved.instances.find((i) => i.instanceId === "in-rect")?.position).toEqual({
      x: 24,
      y: 1.5,
      z: 2.7,
    });
    expect(moved.instances.find((i) => i.instanceId === "in-rect")?.rotationDeg).toBe(40);
    expect(moved.instances.find((i) => i.instanceId === "unassigned")).toEqual(beforeLoose);
    expect(moved.storeys[0]).toEqual(beforeStorey);
    expect(roomL.heightM).toBe(2.8);
  });

  it("leaves rooms and fixtures on other storeys unchanged", () => {
    let scene = defaultSceneV2();
    const gfId = scene.ui.activeStoreyId;
    addRoom(scene, "gf-room", rectPolygon(0, 0, 5, 4), gfId, "GF");
    scene.instances = [fixture(scene, { instanceId: "gf-fix", roomId: "gf-room", x: 1, y: 1 })];
    scene = officialAppendStorey(scene, { id: "storey-l1", name: "L1" });
    const l1Id = scene.storeys.find((s) => s.id === "storey-l1")!.id;
    addRoom(scene, "l1-room", SKEW_POLYGON, l1Id, "Skew");
    scene.instances = [
      ...scene.instances,
      fixture(scene, {
        instanceId: "l1-fix",
        roomId: "l1-room",
        storeyId: l1Id,
        x: 1,
        y: 1,
        z: 5.6,
        rotationDeg: 25,
      }),
    ];
    const beforeL1Room = structuredClone(scene.rooms.find((r) => r.id === "l1-room")!);
    const beforeL1Fix = structuredClone(scene.instances.find((i) => i.instanceId === "l1-fix")!);
    const beforeL1Storey = structuredClone(scene.storeys.find((s) => s.id === l1Id)!);
    const beforeArea = roomAreaM2(beforeL1Room);

    const moved = officialTranslateStorey(scene, gfId, 2, -1);
    expect(moved.rooms.find((r) => r.id === "gf-room")?.polygon[0]).toEqual({ x: 2, y: -1 });
    expect(moved.instances.find((i) => i.instanceId === "gf-fix")?.position).toEqual({
      x: 3,
      y: 0,
      z: 2.7,
    });
    expect(moved.rooms.find((r) => r.id === "l1-room")).toEqual(beforeL1Room);
    expect(roomAreaM2(moved.rooms.find((r) => r.id === "l1-room")!)).toBeCloseTo(beforeArea, 10);
    expect(moved.instances.find((i) => i.instanceId === "l1-fix")).toEqual(beforeL1Fix);
    expect(moved.storeys.find((s) => s.id === l1Id)).toEqual(beforeL1Storey);
  });

  it("is a no-op for a missing storey, an empty storey, or a zero / non-finite delta", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "room-rect", rectPolygon(0, 0, 5, 4));
    const snapshot = structuredClone(scene);
    expect(officialTranslateStorey(scene, "missing", 1, 1)).toBe(scene);
    expect(officialTranslateStorey(scene, scene.ui.activeStoreyId, 0, 0)).toBe(scene);
    expect(officialTranslateStorey(scene, scene.ui.activeStoreyId, Number.NaN, 1)).toBe(scene);
    expect(
      officialTranslateStorey(scene, scene.ui.activeStoreyId, 1, Number.POSITIVE_INFINITY)
    ).toBe(scene);

    const empty = officialAppendStorey(structuredClone(scene), { id: "empty-l1" });
    const emptyId = "empty-l1";
    expect(officialTranslateStorey(empty, emptyId, 2, 2)).toBe(empty);
    expect(scene).toEqual(snapshot);
  });
});
