import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import {
  SUBTRACT_ROOMS_REFUSE_DISJOINT_STATUS,
  SUBTRACT_ROOMS_REFUSE_HOLE_STATUS,
  SUBTRACT_ROOMS_REFUSE_MISSING_STATUS,
  SUBTRACT_ROOMS_REFUSE_SAME_STATUS,
  SUBTRACT_ROOMS_REFUSE_SPLIT_STATUS,
  SUBTRACT_ROOMS_REFUSE_STOREY_STATUS,
  formatSubtractRoomsSuccessStatus,
  officialSubtractRooms,
  subtractOfficialRoomPolygons,
} from "./official-room-subtract";
import { officialPointInPolygonInclusive } from "./official-room-union";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

function ringsEquivalent(a: Vec2[], b: Vec2[]): boolean {
  if (a.length !== b.length) return false;
  const n = a.length;
  if (n === 0) return true;
  for (let start = 0; start < n; start++) {
    let fwd = true;
    let rev = true;
    for (let i = 0; i < n; i++) {
      if (!officialDxfPointsCoincide(a[i]!, b[(start + i) % n]!)) fwd = false;
      if (!officialDxfPointsCoincide(a[i]!, b[(start - i + n) % n]!)) rev = false;
    }
    if (fwd || rev) return true;
  }
  return false;
}

function addRoom(
  scene: ProjectSceneV2,
  id: string,
  polygon: Vec2[],
  extra?: Partial<ProjectSceneV2["rooms"][number]>
) {
  const room = officialNewRoom({
    id,
    storeyId: extra?.storeyId ?? scene.ui.activeStoreyId,
    name: extra?.name ?? id,
    polygon,
    heightM: extra?.heightM ?? 2.8,
  });
  if (extra?.calc) room.calc = { ...room.calc, ...extra.calc };
  if (extra?.workplaneHeightM != null) room.workplaneHeightM = extra.workplaneHeightM;
  scene.rooms = [...scene.rooms, room];
  return room;
}

function fixture(
  scene: ProjectSceneV2,
  input: { instanceId: string; roomId: string | null; x: number; y: number; storeyId?: string }
): FixtureInstance {
  return {
    instanceId: input.instanceId,
    luminaireId: "lum-1",
    storeyId: input.storeyId ?? scene.ui.activeStoreyId,
    roomId: input.roomId,
    name: input.instanceId,
    position: { x: input.x, y: input.y, z: 2.7 },
    rotationDeg: 15,
  };
}

describe("subtractOfficialRoomPolygons", () => {
  it("subtracts two overlapping rectangles and leaves a single L-shaped ring", () => {
    const a = rectPolygon(0, 0, 4, 4);
    const b = rectPolygon(2, 2, 2, 2);
    const result = subtractOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      ringsEquivalent(result.polygon, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ])
    ).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(
      12,
      6
    );
  });

  it("refuses disjoint rooms and rooms that only share an edge", () => {
    const a = rectPolygon(0, 0, 1, 1);
    const disjoint = subtractOfficialRoomPolygons(a, rectPolygon(2, 2, 1, 1));
    expect(disjoint).toEqual({ ok: false, reason: "disjoint" });

    const edge = subtractOfficialRoomPolygons(rectPolygon(0, 0, 2, 2), rectPolygon(2, 0, 2, 2));
    expect(edge).toEqual({ ok: false, reason: "disjoint" });
  });

  it("refuses a subtract that would split the first room into two pieces", () => {
    const a = rectPolygon(0, 0, 4, 2);
    const b = rectPolygon(1.5, 0, 1, 2);
    const result = subtractOfficialRoomPolygons(a, b);
    expect(result).toEqual({ ok: false, reason: "split" });
  });

  it("refuses a hole-producing subtract when the cutter is strictly inside the first room", () => {
    const a = rectPolygon(0, 0, 4, 4);
    const b = rectPolygon(1, 1, 1, 1);
    const result = subtractOfficialRoomPolygons(a, b);
    expect(result).toEqual({ ok: false, reason: "hole" });
  });
});

describe("officialSubtractRooms", () => {
  it("keeps the first room's id, name, and MF, and leaves the cutter in place", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 4, 4), {
      name: "Office",
      heightM: 3.1,
      workplaneHeightM: 0.85,
      calc: { maintenanceFactor: 0.72, en12464TemplateId: "office" },
    });
    addRoom(scene, "cutter", rectPolygon(2, 2, 2, 2), {
      name: "Store",
      calc: { maintenanceFactor: 0.9 },
    });
    const beforeCutter = scene.rooms.find((r) => r.id === "cutter")!;
    const result = officialSubtractRooms(scene, "keep", "cutter");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keptRoomId).toBe("keep");
    expect(result.cutterRoomId).toBe("cutter");
    expect(result.status).toBe(formatSubtractRoomsSuccessStatus("Office"));
    expect(result.scene.rooms.map((r) => r.id)).toEqual(["keep", "cutter"]);
    const kept = result.scene.rooms.find((r) => r.id === "keep")!;
    const cutter = result.scene.rooms.find((r) => r.id === "cutter")!;
    expect(kept.name).toBe("Office");
    expect(kept.heightM).toBe(3.1);
    expect(kept.workplaneHeightM).toBe(0.85);
    expect(kept.calc.maintenanceFactor).toBe(0.72);
    expect(kept.calc.en12464TemplateId).toBe("office");
    expect(roomAreaM2(kept)).toBeCloseTo(12, 6);
    expect(cutter.name).toBe("Store");
    expect(cutter.calc.maintenanceFactor).toBe(0.9);
    expect(ringsEquivalent(cutter.polygon, rectPolygon(2, 2, 2, 2))).toBe(true);
    expect(scene.rooms).toHaveLength(2);
    expect(beforeCutter.name).toBe("Store");
    expect(ringsEquivalent(scene.rooms.find((r) => r.id === "keep")!.polygon, rectPolygon(0, 0, 4, 4))).toBe(
      true
    );
  });

  it("unassigns fixtures of the surviving room that fall outside the cut, and leaves cutter fixtures unchanged", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 4, 4));
    addRoom(scene, "cutter", rectPolygon(2, 2, 2, 2));
    scene.instances = [
      fixture(scene, { instanceId: "stays", roomId: "keep", x: 0.5, y: 0.5 }),
      fixture(scene, { instanceId: "cut-away", roomId: "keep", x: 3, y: 3 }),
      fixture(scene, { instanceId: "in-cutter", roomId: "cutter", x: 3, y: 3 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 3, y: 3 }),
    ];
    const result = officialSubtractRooms(scene, "keep", "cutter");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.scene.instances.map((i) => [i.instanceId, i]));
    expect(byId["stays"]!.roomId).toBe("keep");
    expect(byId["stays"]!.position).toEqual({ x: 0.5, y: 0.5, z: 2.7 });
    expect(byId["cut-away"]!.roomId).toBeNull();
    expect(byId["cut-away"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["cut-away"]!.position).toEqual({ x: 3, y: 3, z: 2.7 });
    expect(byId["in-cutter"]!.roomId).toBe("cutter");
    expect(byId["loose"]!.roomId).toBeNull();
    expect(result.scene.instances).toHaveLength(4);
    expect(officialPointInPolygonInclusive({ x: 0.5, y: 0.5 }, result.polygon)).toBe(true);
    expect(officialPointInPolygonInclusive({ x: 3, y: 3 }, result.polygon)).toBe(false);
  });

  it("refuses no overlap, the same room twice, a missing room, and another storey", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 1, 1));
    addRoom(scene, "b", rectPolygon(3, 3, 1, 1));
    const withStorey = officialAppendStorey(scene, { id: "s2", name: "L2" });
    addRoom(withStorey, "c", rectPolygon(0, 0, 1, 1), { storeyId: "s2" });
    withStorey.ui.activeStoreyId = scene.ui.activeStoreyId;

    const disjoint = officialSubtractRooms(scene, "a", "b");
    expect(disjoint.ok).toBe(false);
    if (!disjoint.ok) {
      expect(disjoint.reason).toBe("disjoint");
      expect(disjoint.status).toBe(SUBTRACT_ROOMS_REFUSE_DISJOINT_STATUS);
      expect(disjoint.scene).toBe(scene);
    }

    const missing = officialSubtractRooms(scene, "a", "nope");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe("missing");
      expect(missing.status).toBe(SUBTRACT_ROOMS_REFUSE_MISSING_STATUS);
    }

    const same = officialSubtractRooms(scene, "a", "a");
    expect(same.ok).toBe(false);
    if (!same.ok) {
      expect(same.reason).toBe("same");
      expect(same.status).toBe(SUBTRACT_ROOMS_REFUSE_SAME_STATUS);
    }

    const other = officialSubtractRooms(withStorey, "a", "c");
    expect(other.ok).toBe(false);
    if (!other.ok) {
      expect(other.reason).toBe("storey");
      expect(other.status).toBe(SUBTRACT_ROOMS_REFUSE_STOREY_STATUS);
      expect(withStorey.rooms.map((r) => r.id)).toEqual(expect.arrayContaining(["a", "b", "c"]));
    }
  });

  it("refuses a hole-producing or splitting subtract and leaves the scene unchanged", () => {
    const holeScene = defaultSceneV2();
    addRoom(holeScene, "keep", rectPolygon(0, 0, 4, 4));
    addRoom(holeScene, "cutter", rectPolygon(1, 1, 1, 1));
    const holeSnap = structuredClone(holeScene);
    const hole = officialSubtractRooms(holeScene, "keep", "cutter");
    expect(hole.ok).toBe(false);
    if (!hole.ok) {
      expect(hole.reason).toBe("hole");
      expect(hole.status).toBe(SUBTRACT_ROOMS_REFUSE_HOLE_STATUS);
    }
    expect(holeScene).toEqual(holeSnap);

    const splitScene = defaultSceneV2();
    addRoom(splitScene, "keep", rectPolygon(0, 0, 4, 2));
    addRoom(splitScene, "cutter", rectPolygon(1.5, 0, 1, 2));
    const splitSnap = structuredClone(splitScene);
    const split = officialSubtractRooms(splitScene, "keep", "cutter");
    expect(split.ok).toBe(false);
    if (!split.ok) {
      expect(split.reason).toBe("split");
      expect(split.status).toBe(SUBTRACT_ROOMS_REFUSE_SPLIT_STATUS);
    }
    expect(splitScene).toEqual(splitSnap);
  });
});

describe("official editor Subtract rooms wiring", () => {
  it("places the official command beside Union rooms and reuses the two-room pick", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain("Subtract rooms");
    expect(src).toContain("function startSubtractRooms");
    expect(src).toContain("officialSubtractRooms");
    expect(src).toContain("helpKey=\"tool.subtractRooms\"");
    expect(src).toContain("data-help-key=\"tool.subtractRooms\"");
    expect(src).toContain("endCoalesce()");
    expect(src).toContain("SUBTRACT_ROOMS_PICK_SECOND_STATUS");
    expect(src).toContain("Alignment is not included");
    const unionBtn = src.indexOf("Union rooms");
    const subtractBtn = src.indexOf("Subtract rooms");
    expect(unionBtn).toBeGreaterThan(0);
    expect(subtractBtn).toBeGreaterThan(unionBtn);
    expect(src).toContain("applyOfficialRoomSubtractPick");
    expect(top).toContain("unionPickActive");
    expect(top).toContain("onUnionRoomPick");
    expect(top).toContain("if (unionPickActive && onUnionRoomPick)");
    expect(top).toContain("unionPickMode");
    expect(src).not.toContain("alignRooms");
    expect(top).not.toContain("alignRooms");
  });
});
