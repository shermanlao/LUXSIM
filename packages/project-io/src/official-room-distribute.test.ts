import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { rectPolygon, roomAreaM2, roomBounds } from "./geometry";
import {
  DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_CROSS_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_MISSING_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_NOOP_STATUS,
  DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
  formatDistributeRoomsSuccessStatus,
  officialDistributeRooms,
  officialDistributeTranslations,
} from "./official-room-distribute";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

const CROSSING: Vec2[] = [
  { x: 3, y: 0 },
  { x: 7, y: 0 },
  { x: 3, y: 4 },
  { x: 7, y: 4 },
];

function addRoom(
  scene: ProjectSceneV2,
  id: string,
  polygon: Vec2[],
  name = id,
  storeyId = scene.ui.activeStoreyId
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

describe("officialDistributeTranslations", () => {
  it("keeps the extreme rooms put and evens the gaps between bounding boxes", () => {
    const planned = officialDistributeTranslations(
      [
        { id: "a", polygon: rectPolygon(0, 0, 2, 2) },
        { id: "b", polygon: rectPolygon(3, 0, 2, 2) },
        { id: "c", polygon: rectPolygon(10, 0, 2, 2) },
      ],
      "horizontal"
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.anchoredRoomIds).toEqual(["a", "c"]);
    expect(planned.moves).toEqual([{ roomId: "b", dx: 2, dy: 0 }]);
  });

  it("spaces rooms of different widths with equal gaps, including vertically", () => {
    const horizontal = officialDistributeTranslations(
      [
        { id: "a", polygon: rectPolygon(0, 0, 2, 2) },
        { id: "b", polygon: rectPolygon(3, 0, 1, 2) },
        { id: "c", polygon: rectPolygon(6, 0, 3, 2) },
        { id: "d", polygon: rectPolygon(12, 0, 2, 2) },
      ],
      "horizontal"
    );
    expect(horizontal.ok).toBe(true);
    if (horizontal.ok) {
      expect(horizontal.anchoredRoomIds).toEqual(["a", "d"]);
      expect(horizontal.moves).toEqual([
        { roomId: "b", dx: 1, dy: 0 },
        { roomId: "c", dx: 1, dy: 0 },
      ]);
    }

    const vertical = officialDistributeTranslations(
      [
        { id: "a", polygon: rectPolygon(0, 0, 2, 2) },
        { id: "b", polygon: rectPolygon(0, 3, 2, 2) },
        { id: "c", polygon: rectPolygon(0, 10, 2, 2) },
      ],
      "vertical"
    );
    expect(vertical.ok).toBe(true);
    if (vertical.ok) {
      expect(vertical.anchoredRoomIds).toEqual(["a", "c"]);
      expect(vertical.moves).toEqual([{ roomId: "b", dx: 0, dy: 2 }]);
    }
  });
});

describe("officialDistributeRooms", () => {
  it("distributes three rooms horizontally, moves only interior fixtures, and keeps extremes put", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 2, 2), "One");
    addRoom(scene, "b", rectPolygon(3, 1, 2, 2), "Two");
    addRoom(scene, "c", rectPolygon(10, 0, 2, 2), "Three");
    addRoom(scene, "other", rectPolygon(20, 0, 3, 3), "Other");
    scene.instances = [
      fixture(scene, { instanceId: "in-b", roomId: "b", x: 4, y: 2, z: 2.6 }),
      fixture(scene, { instanceId: "in-a", roomId: "a", x: 1, y: 1 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 5, y: 5 }),
    ];
    const beforeA = structuredClone(scene.rooms.find((r) => r.id === "a")!);
    const beforeC = structuredClone(scene.rooms.find((r) => r.id === "c")!);
    const beforeOther = structuredClone(scene.rooms.find((r) => r.id === "other")!);
    const beforeAFix = structuredClone(scene.instances[1]!);
    const beforeLoose = structuredClone(scene.instances[2]!);
    const beforeArea = roomAreaM2(scene.rooms.find((r) => r.id === "b")!);

    const result = officialDistributeRooms(scene, ["a", "b", "c"], "horizontal");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(formatDistributeRoomsSuccessStatus(3, "horizontal"));
    expect(result.movedRoomIds).toEqual(["b"]);
    expect(result.anchoredRoomIds).toEqual(["a", "c"]);
    const moved = result.scene.rooms.find((r) => r.id === "b")!;
    expect(moved.polygon).toEqual(rectPolygon(5, 1, 2, 2));
    expect(roomAreaM2(moved)).toBe(beforeArea);
    expect(roomBounds(moved).minX).toBe(5);
    expect(roomBounds(result.scene.rooms.find((r) => r.id === "a")!)).toEqual(roomBounds(beforeA));
    expect(result.scene.rooms.find((r) => r.id === "a")).toEqual(beforeA);
    expect(result.scene.rooms.find((r) => r.id === "c")).toEqual(beforeC);
    expect(result.scene.rooms.find((r) => r.id === "other")).toEqual(beforeOther);
    expect(result.scene.instances.find((i) => i.instanceId === "in-b")?.position).toEqual({
      x: 6,
      y: 2,
      z: 2.6,
    });
    expect(result.scene.instances.find((i) => i.instanceId === "in-b")?.rotationDeg).toBe(15);
    expect(result.scene.instances.find((i) => i.instanceId === "in-a")).toEqual(beforeAFix);
    expect(result.scene.instances.find((i) => i.instanceId === "loose")).toEqual(beforeLoose);
    expect(scene.rooms.find((r) => r.id === "b")?.polygon).toEqual(rectPolygon(3, 1, 2, 2));
  });

  it("distributes an L-shaped interior room by its bounding box without reshaping it", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(-2, 0, 2, 2), "Left");
    addRoom(scene, "l", L_POLYGON, "Lounge");
    addRoom(scene, "c", rectPolygon(20, 0, 2, 2), "Right");
    const before = scene.rooms.find((r) => r.id === "l")!.polygon.map((p) => ({ ...p }));
    const result = officialDistributeRooms(scene, ["a", "l", "c"], "horizontal");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.scene.rooms.find((r) => r.id === "l")!;
    const dx = roomBounds(moved).minX - 0;
    expect(moved.polygon).toEqual(before.map((p) => ({ x: p.x + dx, y: p.y })));
    expect(roomAreaM2(moved)).toBe(roomAreaM2({ polygon: before } as never));
  });

  it("refuses two rooms, a missing room, another storey, a no-op, and an invalid outline", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 2, 2));
    addRoom(scene, "b", rectPolygon(4, 0, 2, 2));
    addRoom(scene, "c", rectPolygon(8, 0, 2, 2));

    const few = officialDistributeRooms(scene, ["a", "b"], "horizontal");
    expect(few).toMatchObject({
      ok: false,
      status: DISTRIBUTE_ROOMS_REFUSE_COUNT_STATUS,
      reason: "count",
    });
    expect(few.scene).toBe(scene);

    const missing = officialDistributeRooms(scene, ["a", "b", "nope"], "horizontal");
    expect(missing).toMatchObject({
      ok: false,
      status: DISTRIBUTE_ROOMS_REFUSE_MISSING_STATUS,
      reason: "missing",
    });
    expect(missing.scene).toBe(scene);

    const withStorey = officialAppendStorey(scene, { id: "s2", name: "L2" });
    addRoom(withStorey, "d", rectPolygon(8, 0, 2, 2), "d", "s2");
    const other = officialDistributeRooms(withStorey, ["a", "b", "d"], "horizontal");
    expect(other).toMatchObject({
      ok: false,
      status: DISTRIBUTE_ROOMS_REFUSE_STOREY_STATUS,
      reason: "storey",
    });
    expect(other.scene).toBe(withStorey);

    const noop = officialDistributeRooms(scene, ["a", "b", "c"], "horizontal");
    expect(noop).toMatchObject({
      ok: false,
      status: DISTRIBUTE_ROOMS_REFUSE_NOOP_STATUS,
      reason: "noop",
    });
    expect(noop.scene).toBe(scene);

    const crossingScene = defaultSceneV2();
    addRoom(crossingScene, "a", rectPolygon(0, 0, 2, 2));
    addRoom(crossingScene, "bad", CROSSING);
    addRoom(crossingScene, "c", rectPolygon(10, 0, 2, 2));
    const snap = structuredClone(crossingScene);
    const crossing = officialDistributeRooms(crossingScene, ["a", "bad", "c"], "horizontal");
    expect(crossing).toMatchObject({
      ok: false,
      status: DISTRIBUTE_ROOMS_REFUSE_CROSS_STATUS,
      reason: "self-crossing",
    });
    expect(crossingScene).toEqual(snap);
  });
});

describe("official editor Distribute rooms wiring", () => {
  it("places the official command beside Align rooms and uses a multi-room pick confirmed with Enter", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain("Distribute rooms");
    expect(src).toContain("function startDistributeRooms");
    expect(src).toContain("officialDistributeRooms");
    expect(src).toContain('helpKey="tool.distributeRooms"');
    expect(src).toContain('data-help-key="tool.distributeRooms"');
    expect(src).toContain("endCoalesce()");
    expect(src).toContain("applyOfficialRoomDistributeCommit");
    expect(src).toContain("officialRoomDistributeAxisLabel");
    expect(src).toContain("OFFICIAL_ROOM_DISTRIBUTE_AXES");
    expect(src).toContain("equal gaps between bounding boxes");
    const alignBtn = src.indexOf("Align rooms");
    const distributeBtn = src.indexOf("Distribute rooms");
    expect(alignBtn).toBeGreaterThan(0);
    expect(distributeBtn).toBeGreaterThan(alignBtn);
    expect(top).toContain("unionPickActive");
    expect(top).toContain("onUnionRoomPick");
    expect(top).toContain("onDistributeApply");
    expect(top).toContain('unionPickMode === "distribute"');
    expect(top).toContain("Enter applies");
  });
});
