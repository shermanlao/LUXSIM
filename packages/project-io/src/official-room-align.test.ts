import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { rectPolygon, roomAreaM2, roomBounds } from "./geometry";
import {
  ALIGN_ROOMS_REFUSE_CROSS_STATUS,
  ALIGN_ROOMS_REFUSE_MISSING_STATUS,
  ALIGN_ROOMS_REFUSE_NOOP_STATUS,
  ALIGN_ROOMS_REFUSE_SAME_STATUS,
  ALIGN_ROOMS_REFUSE_STOREY_STATUS,
  ALIGN_ROOMS_REFUSE_VERTICES_STATUS,
  formatAlignRoomsSuccessStatus,
  officialAlignRooms,
  officialAlignTranslation,
  officialRoomAlignAxisPhrase,
} from "./official-room-align";
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
  { x: 10, y: 0 },
  { x: 14, y: 0 },
  { x: 10, y: 4 },
  { x: 14, y: 4 },
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

describe("officialAlignTranslation", () => {
  it("aligns bounding-box edges and centres in world XY (Y up)", () => {
    const reference = rectPolygon(0, 0, 4, 6);
    const moving = rectPolygon(10, 1, 2, 2);
    expect(officialAlignTranslation(reference, moving, "left")).toEqual({ dx: -10, dy: 0 });
    expect(officialAlignTranslation(reference, moving, "right")).toEqual({ dx: -8, dy: 0 });
    expect(officialAlignTranslation(reference, moving, "top")).toEqual({ dx: 0, dy: 3 });
    expect(officialAlignTranslation(reference, moving, "bottom")).toEqual({ dx: 0, dy: -1 });
    expect(officialAlignTranslation(reference, moving, "hcentre")).toEqual({ dx: -9, dy: 0 });
    expect(officialAlignTranslation(reference, moving, "vcentre")).toEqual({ dx: 0, dy: 1 });
  });
});

describe("officialAlignRooms", () => {
  it("aligns the moving room left to the reference and moves only that room's fixtures", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "ref", rectPolygon(0, 0, 4, 3), "Lobby");
    addRoom(scene, "move", rectPolygon(10, 1, 2, 2), "Office");
    addRoom(scene, "other", rectPolygon(20, 0, 3, 3), "Store");
    scene.instances = [
      fixture(scene, { instanceId: "in-move", roomId: "move", x: 11, y: 2, z: 2.6 }),
      fixture(scene, { instanceId: "in-ref", roomId: "ref", x: 1, y: 1 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 5, y: 5 }),
    ];
    const beforeRef = structuredClone(scene.rooms.find((r) => r.id === "ref")!);
    const beforeOther = structuredClone(scene.rooms.find((r) => r.id === "other")!);
    const beforeRefFix = structuredClone(scene.instances[1]!);
    const beforeLoose = structuredClone(scene.instances[2]!);
    const beforeArea = roomAreaM2(scene.rooms.find((r) => r.id === "move")!);

    const result = officialAlignRooms(scene, "ref", "move", "left");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(
      formatAlignRoomsSuccessStatus("Office", "Lobby", "left")
    );
    expect(result.status).toContain(officialRoomAlignAxisPhrase("left"));
    expect(result.dx).toBe(-10);
    expect(result.dy).toBe(0);
    const moved = result.scene.rooms.find((r) => r.id === "move")!;
    expect(moved.polygon).toEqual(rectPolygon(0, 1, 2, 2));
    expect(roomAreaM2(moved)).toBe(beforeArea);
    expect(roomBounds(moved).minX).toBe(0);
    expect(result.scene.rooms.find((r) => r.id === "ref")).toEqual(beforeRef);
    expect(result.scene.rooms.find((r) => r.id === "other")).toEqual(beforeOther);
    expect(result.scene.rooms).toHaveLength(3);
    expect(result.scene.instances.find((i) => i.instanceId === "in-move")?.position).toEqual({
      x: 1,
      y: 2,
      z: 2.6,
    });
    expect(result.scene.instances.find((i) => i.instanceId === "in-move")?.rotationDeg).toBe(15);
    expect(result.scene.instances.find((i) => i.instanceId === "in-ref")).toEqual(beforeRefFix);
    expect(result.scene.instances.find((i) => i.instanceId === "loose")).toEqual(beforeLoose);
    expect(result.scene.ui.activeRoomId).toBe("ref");
    expect(moved.name).toBe("Office");
    expect(moved.heightM).toBe(2.8);
    expect(scene.rooms.find((r) => r.id === "move")?.polygon).toEqual(rectPolygon(10, 1, 2, 2));
  });

  it("aligns right, top, bottom, and both centres", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "ref", rectPolygon(0, 0, 4, 6), "Lobby");
    addRoom(scene, "move", rectPolygon(10, 1, 2, 2), "Office");

    const right = officialAlignRooms(scene, "ref", "move", "right");
    expect(right.ok).toBe(true);
    if (right.ok) {
      expect(roomBounds(right.scene.rooms.find((r) => r.id === "move")!).maxX).toBe(4);
      expect(roomBounds(right.scene.rooms.find((r) => r.id === "move")!).minY).toBe(1);
    }

    const top = officialAlignRooms(scene, "ref", "move", "top");
    expect(top.ok).toBe(true);
    if (top.ok) {
      expect(roomBounds(top.scene.rooms.find((r) => r.id === "move")!).maxY).toBe(6);
      expect(roomBounds(top.scene.rooms.find((r) => r.id === "move")!).minX).toBe(10);
    }

    const bottom = officialAlignRooms(scene, "ref", "move", "bottom");
    expect(bottom.ok).toBe(true);
    if (bottom.ok) {
      expect(roomBounds(bottom.scene.rooms.find((r) => r.id === "move")!).minY).toBe(0);
    }

    const hcentre = officialAlignRooms(scene, "ref", "move", "hcentre");
    expect(hcentre.ok).toBe(true);
    if (hcentre.ok) {
      const b = roomBounds(hcentre.scene.rooms.find((r) => r.id === "move")!);
      expect((b.minX + b.maxX) / 2).toBe(2);
    }

    const vcentre = officialAlignRooms(scene, "ref", "move", "vcentre");
    expect(vcentre.ok).toBe(true);
    if (vcentre.ok) {
      const b = roomBounds(vcentre.scene.rooms.find((r) => r.id === "move")!);
      expect((b.minY + b.maxY) / 2).toBe(3);
    }
  });

  it("aligns an L-shaped room by its bounding box without reshaping it", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "ref", rectPolygon(20, 0, 4, 4), "Lobby");
    addRoom(scene, "move", L_POLYGON, "Lounge");
    const before = scene.rooms.find((r) => r.id === "move")!.polygon.map((p) => ({ ...p }));
    const result = officialAlignRooms(scene, "ref", "move", "left");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.scene.rooms.find((r) => r.id === "move")!;
    expect(moved.polygon).toEqual(before.map((p) => ({ x: p.x + 20, y: p.y })));
    expect(roomBounds(moved).minX).toBe(20);
    expect(roomAreaM2(moved)).toBe(roomAreaM2({ polygon: before } as never));
  });

  it("refuses a missing room, the same room, another storey, a no-op, and invalid outlines", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 4, 3));
    addRoom(scene, "b", rectPolygon(10, 1, 2, 2));
    const withStorey = officialAppendStorey(scene, { id: "s2", name: "L2" });
    addRoom(withStorey, "c", rectPolygon(8, 0, 2, 2), "c", "s2");

    const missing = officialAlignRooms(scene, "a", "nope", "left");
    expect(missing).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_MISSING_STATUS,
      reason: "missing",
    });
    expect(missing.scene).toBe(scene);

    const same = officialAlignRooms(scene, "a", "a", "left");
    expect(same).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_SAME_STATUS,
      reason: "same",
    });
    expect(same.scene).toBe(scene);

    const other = officialAlignRooms(withStorey, "a", "c", "left");
    expect(other).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_STOREY_STATUS,
      reason: "storey",
    });
    expect(other.scene).toBe(withStorey);

    const already = officialAlignRooms(scene, "a", "b", "left");
    expect(already.ok).toBe(true);
    if (!already.ok) return;
    const noop = officialAlignRooms(already.scene, "a", "b", "left");
    expect(noop).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_NOOP_STATUS,
      reason: "noop",
    });
    expect(noop.scene).toBe(already.scene);

    const crossingScene = defaultSceneV2();
    addRoom(crossingScene, "ref", rectPolygon(0, 0, 4, 3));
    addRoom(crossingScene, "bad", CROSSING);
    const snap = structuredClone(crossingScene);
    const crossing = officialAlignRooms(crossingScene, "ref", "bad", "left");
    expect(crossing).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_CROSS_STATUS,
      reason: "self-crossing",
    });
    expect(crossingScene).toEqual(snap);

    const skinny = defaultSceneV2();
    addRoom(skinny, "ref", rectPolygon(0, 0, 4, 3));
    addRoom(skinny, "line", [
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ]);
    const vertices = officialAlignRooms(skinny, "ref", "line", "left");
    expect(vertices).toMatchObject({
      ok: false,
      status: ALIGN_ROOMS_REFUSE_VERTICES_STATUS,
      reason: "degenerate-vertices",
    });
  });
});

describe("official editor Align rooms wiring", () => {
  it("places the official command beside XOR rooms and reuses the two-room pick", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain("Align rooms");
    expect(src).toContain("function startAlignRooms");
    expect(src).toContain("officialAlignRooms");
    expect(src).toContain("helpKey=\"tool.alignRooms\"");
    expect(src).toContain("data-help-key=\"tool.alignRooms\"");
    expect(src).toContain("endCoalesce()");
    expect(src).toContain("ALIGN_ROOMS_PICK_SECOND_STATUS");
    expect(src).toContain("officialRoomAlignAxisLabel");
    expect(src).toContain("OFFICIAL_ROOM_ALIGN_AXES");
    expect(src).toContain("Even spacing is not included");
    const alignSrc = readFileSync(
      path.join(process.cwd(), "packages/project-io/src/official-room-align.ts"),
      "utf8"
    );
    expect(alignSrc).toContain("H centre");
    expect(alignSrc).toContain("V centre");
    const xorBtn = src.indexOf("XOR rooms");
    const alignBtn = src.indexOf("Align rooms");
    expect(xorBtn).toBeGreaterThan(0);
    expect(alignBtn).toBeGreaterThan(xorBtn);
    expect(src).toContain("applyOfficialRoomAlignPick");
    expect(top).toContain("unionPickActive");
    expect(top).toContain("onUnionRoomPick");
    expect(top).toContain("if (unionPickActive && onUnionRoomPick)");
    expect(top).toContain('unionPickMode === "align"');
    expect(src).not.toContain("distributeRooms");
    expect(top).not.toContain("distributeRooms");
  });
});
