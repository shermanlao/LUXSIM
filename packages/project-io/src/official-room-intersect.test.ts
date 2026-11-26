import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import {
  INTERSECT_ROOMS_REFUSE_DISJOINT_STATUS,
  INTERSECT_ROOMS_REFUSE_MISSING_STATUS,
  INTERSECT_ROOMS_REFUSE_SAME_STATUS,
  INTERSECT_ROOMS_REFUSE_SPLIT_STATUS,
  INTERSECT_ROOMS_REFUSE_STOREY_STATUS,
  formatIntersectRoomsSuccessStatus,
  officialIntersectRooms,
  intersectOfficialRoomPolygons,
} from "./official-room-intersect";
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

describe("intersectOfficialRoomPolygons", () => {
  it("intersects two overlapping rectangles into a single rectangle", () => {
    const a = rectPolygon(0, 0, 4, 4);
    const b = rectPolygon(2, 1, 3, 2);
    const result = intersectOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ringsEquivalent(result.polygon, rectPolygon(2, 1, 2, 2))).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(
      4,
      6
    );
  });

  it("returns the inner room when one rectangle is contained in the other", () => {
    const a = rectPolygon(0, 0, 4, 4);
    const b = rectPolygon(1, 1, 1, 1);
    const result = intersectOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ringsEquivalent(result.polygon, rectPolygon(1, 1, 1, 1))).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(
      1,
      6
    );
  });

  it("refuses disjoint rooms and rooms that only share an edge", () => {
    const a = rectPolygon(0, 0, 1, 1);
    const disjoint = intersectOfficialRoomPolygons(a, rectPolygon(2, 2, 1, 1));
    expect(disjoint).toEqual({ ok: false, reason: "disjoint" });

    const edge = intersectOfficialRoomPolygons(rectPolygon(0, 0, 2, 2), rectPolygon(2, 0, 2, 2));
    expect(edge).toEqual({ ok: false, reason: "disjoint" });
  });

  it("refuses an intersection that would split into two pieces", () => {
    const u: Vec2[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const bar = rectPolygon(0.5, 2, 5, 1.5);
    const result = intersectOfficialRoomPolygons(u, bar);
    expect(result).toEqual({ ok: false, reason: "split" });
  });
});

describe("officialIntersectRooms", () => {
  it("keeps the first room's id, name, and MF, and removes the second room", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 4, 4), {
      name: "Office",
      heightM: 3.1,
      workplaneHeightM: 0.85,
      calc: { maintenanceFactor: 0.72, en12464TemplateId: "office" },
    });
    addRoom(scene, "drop", rectPolygon(2, 2, 2, 2), {
      name: "Store",
      calc: { maintenanceFactor: 0.9 },
    });
    const result = officialIntersectRooms(scene, "keep", "drop");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keptRoomId).toBe("keep");
    expect(result.removedRoomId).toBe("drop");
    expect(result.status).toBe(formatIntersectRoomsSuccessStatus("Office"));
    expect(result.scene.rooms.map((r) => r.id)).toEqual(["keep"]);
    const kept = result.scene.rooms.find((r) => r.id === "keep")!;
    expect(kept.name).toBe("Office");
    expect(kept.heightM).toBe(3.1);
    expect(kept.workplaneHeightM).toBe(0.85);
    expect(kept.calc.maintenanceFactor).toBe(0.72);
    expect(kept.calc.en12464TemplateId).toBe("office");
    expect(roomAreaM2(kept)).toBeCloseTo(4, 6);
    expect(ringsEquivalent(kept.polygon, rectPolygon(2, 2, 2, 2))).toBe(true);
    expect(scene.rooms).toHaveLength(2);
    expect(ringsEquivalent(scene.rooms.find((r) => r.id === "keep")!.polygon, rectPolygon(0, 0, 4, 4))).toBe(
      true
    );
  });

  it("reassigns fixtures inside the intersection and unassigns those that fall outside", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 4, 4));
    addRoom(scene, "drop", rectPolygon(2, 2, 2, 2));
    scene.instances = [
      fixture(scene, { instanceId: "kept-out", roomId: "keep", x: 0.5, y: 0.5 }),
      fixture(scene, { instanceId: "kept-in", roomId: "keep", x: 3, y: 3 }),
      fixture(scene, { instanceId: "drop-in", roomId: "drop", x: 3, y: 3.2 }),
      fixture(scene, { instanceId: "drop-out", roomId: "drop", x: 5, y: 5 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 3, y: 3 }),
    ];
    const result = officialIntersectRooms(scene, "keep", "drop");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.scene.instances.map((i) => [i.instanceId, i]));
    expect(byId["kept-in"]!.roomId).toBe("keep");
    expect(byId["kept-in"]!.position).toEqual({ x: 3, y: 3, z: 2.7 });
    expect(byId["drop-in"]!.roomId).toBe("keep");
    expect(byId["drop-in"]!.position).toEqual({ x: 3, y: 3.2, z: 2.7 });
    expect(byId["kept-out"]!.roomId).toBeNull();
    expect(byId["kept-out"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["drop-out"]!.roomId).toBeNull();
    expect(byId["drop-out"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["loose"]!.roomId).toBeNull();
    expect(result.scene.instances).toHaveLength(5);
    expect(officialPointInPolygonInclusive({ x: 3, y: 3 }, result.polygon)).toBe(true);
    expect(officialPointInPolygonInclusive({ x: 0.5, y: 0.5 }, result.polygon)).toBe(false);
  });

  it("refuses no overlap, the same room twice, a missing room, and another storey", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 1, 1));
    addRoom(scene, "b", rectPolygon(3, 3, 1, 1));
    const withStorey = officialAppendStorey(scene, { id: "s2", name: "L2" });
    addRoom(withStorey, "c", rectPolygon(0, 0, 1, 1), { storeyId: "s2" });
    withStorey.ui.activeStoreyId = scene.ui.activeStoreyId;

    const disjoint = officialIntersectRooms(scene, "a", "b");
    expect(disjoint.ok).toBe(false);
    if (!disjoint.ok) {
      expect(disjoint.reason).toBe("disjoint");
      expect(disjoint.status).toBe(INTERSECT_ROOMS_REFUSE_DISJOINT_STATUS);
      expect(disjoint.scene).toBe(scene);
    }

    const missing = officialIntersectRooms(scene, "a", "nope");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe("missing");
      expect(missing.status).toBe(INTERSECT_ROOMS_REFUSE_MISSING_STATUS);
    }

    const same = officialIntersectRooms(scene, "a", "a");
    expect(same.ok).toBe(false);
    if (!same.ok) {
      expect(same.reason).toBe("same");
      expect(same.status).toBe(INTERSECT_ROOMS_REFUSE_SAME_STATUS);
    }

    const other = officialIntersectRooms(withStorey, "a", "c");
    expect(other.ok).toBe(false);
    if (!other.ok) {
      expect(other.reason).toBe("storey");
      expect(other.status).toBe(INTERSECT_ROOMS_REFUSE_STOREY_STATUS);
      expect(withStorey.rooms.map((r) => r.id)).toEqual(expect.arrayContaining(["a", "b", "c"]));
    }
  });

  it("refuses a splitting intersection and leaves the scene unchanged", () => {
    const splitScene = defaultSceneV2();
    const u: Vec2[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    addRoom(splitScene, "keep", u);
    addRoom(splitScene, "drop", rectPolygon(0.5, 2, 5, 1.5));
    const splitSnap = structuredClone(splitScene);
    const split = officialIntersectRooms(splitScene, "keep", "drop");
    expect(split.ok).toBe(false);
    if (!split.ok) {
      expect(split.reason).toBe("split");
      expect(split.status).toBe(INTERSECT_ROOMS_REFUSE_SPLIT_STATUS);
    }
    expect(splitScene).toEqual(splitSnap);
  });
});

describe("official editor Intersect rooms wiring", () => {
  it("places the official command beside Subtract rooms and reuses the two-room pick", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain("Intersect rooms");
    expect(src).toContain("function startIntersectRooms");
    expect(src).toContain("officialIntersectRooms");
    expect(src).toContain("helpKey=\"tool.intersectRooms\"");
    expect(src).toContain("data-help-key=\"tool.intersectRooms\"");
    expect(src).toContain("endCoalesce()");
    expect(src).toContain("INTERSECT_ROOMS_PICK_SECOND_STATUS");
    const tips = readFileSync(path.join(process.cwd(), "src/lib/ui-tips.ts"), "utf8");
    expect(tips).toContain("Alignment is not included");
    const subtractBtn = src.indexOf("Subtract rooms");
    const intersectBtn = src.indexOf("Intersect rooms");
    expect(subtractBtn).toBeGreaterThan(0);
    expect(intersectBtn).toBeGreaterThan(subtractBtn);
    expect(src).toContain("applyOfficialRoomIntersectPick");
    expect(top).toContain("unionPickActive");
    expect(top).toContain("onUnionRoomPick");
    expect(top).toContain("if (unionPickActive && onUnionRoomPick)");
    expect(top).toContain('unionPickMode === "intersect"');
  });
});
