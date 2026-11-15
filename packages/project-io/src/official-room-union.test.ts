import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import {
  UNION_ROOMS_REFUSE_DISJOINT_STATUS,
  UNION_ROOMS_REFUSE_HOLE_STATUS,
  UNION_ROOMS_REFUSE_MISSING_STATUS,
  UNION_ROOMS_REFUSE_SAME_STATUS,
  UNION_ROOMS_REFUSE_STOREY_STATUS,
  formatUnionRoomsSuccessStatus,
  officialPointInPolygonInclusive,
  officialPolygonsOverlapOrShareEdge,
  officialSharedBoundaryLengthM,
  officialUnionRooms,
  unionOfficialRoomPolygons,
} from "./official-room-union";
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

describe("unionOfficialRoomPolygons", () => {
  it("unites two overlapping rectangles into one simple ring", () => {
    const a = rectPolygon(0, 0, 2, 2);
    const b = rectPolygon(1, 1, 2, 2);
    const result = unionOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      ringsEquivalent(result.polygon, [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ])
    ).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(7, 6);
    expect(officialPolygonsOverlapOrShareEdge(a, b)).toBe("overlap");
  });

  it("merges two edge-adjacent rectangles along a shared edge", () => {
    const a = rectPolygon(0, 0, 2, 2);
    const b = rectPolygon(2, 0, 2, 2);
    expect(officialSharedBoundaryLengthM(a, b)).toBeCloseTo(2, 6);
    expect(officialPolygonsOverlapOrShareEdge(a, b)).toBe("edge-adjacent");
    const result = unionOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ringsEquivalent(result.polygon, rectPolygon(0, 0, 4, 2))).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(8, 6);
  });

  it("merges rooms that share only part of an edge", () => {
    const a = rectPolygon(0, 0, 4, 2);
    const b = rectPolygon(1, 2, 1, 2);
    const result = unionOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      ringsEquivalent(result.polygon, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 1, y: 4 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ])
    ).toBe(true);
    expect(roomAreaM2({ polygon: result.polygon } as ProjectSceneV2["rooms"][number])).toBeCloseTo(10, 6);
  });

  it("refuses disjoint rooms", () => {
    const a = rectPolygon(0, 0, 1, 1);
    const b = rectPolygon(2, 2, 1, 1);
    expect(officialPolygonsOverlapOrShareEdge(a, b)).toBe("disjoint");
    const result = unionOfficialRoomPolygons(a, b);
    expect(result).toEqual({ ok: false, reason: "disjoint" });
  });

  it("refuses rooms that only touch at a point", () => {
    const a = rectPolygon(0, 0, 1, 1);
    const b = rectPolygon(1, 1, 1, 1);
    expect(officialSharedBoundaryLengthM(a, b)).toBeLessThan(1e-6);
    expect(officialPolygonsOverlapOrShareEdge(a, b)).toBe("disjoint");
    const result = unionOfficialRoomPolygons(a, b);
    expect(result).toEqual({ ok: false, reason: "disjoint" });
  });

  it("refuses a hole-producing pair of L-shaped rooms", () => {
    const a: Vec2[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ];
    const b: Vec2[] = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ];
    const result = unionOfficialRoomPolygons(a, b);
    expect(result).toEqual({ ok: false, reason: "hole" });
  });

  it("returns the outer room when one rectangle contains the other", () => {
    const a = rectPolygon(0, 0, 4, 4);
    const b = rectPolygon(1, 1, 1, 1);
    const result = unionOfficialRoomPolygons(a, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ringsEquivalent(result.polygon, a)).toBe(true);
  });
});

describe("officialUnionRooms", () => {
  it("keeps the first room's id, name, and MF, and removes the second room", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 2, 2), {
      name: "Office",
      heightM: 3.1,
      workplaneHeightM: 0.85,
      calc: { maintenanceFactor: 0.72, en12464TemplateId: "office" },
    });
    addRoom(scene, "drop", rectPolygon(1, 1, 2, 2), {
      name: "Store",
      calc: { maintenanceFactor: 0.9 },
    });
    const beforeDrop = scene.rooms.find((r) => r.id === "drop")!;
    const result = officialUnionRooms(scene, "keep", "drop");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keptRoomId).toBe("keep");
    expect(result.removedRoomId).toBe("drop");
    expect(result.status).toBe(formatUnionRoomsSuccessStatus("Office"));
    expect(result.scene.rooms.map((r) => r.id)).toEqual(["keep"]);
    const kept = result.scene.rooms[0]!;
    expect(kept.name).toBe("Office");
    expect(kept.heightM).toBe(3.1);
    expect(kept.workplaneHeightM).toBe(0.85);
    expect(kept.calc.maintenanceFactor).toBe(0.72);
    expect(kept.calc.en12464TemplateId).toBe("office");
    expect(roomAreaM2(kept)).toBeCloseTo(7, 6);
    expect(scene.rooms).toHaveLength(2);
    expect(beforeDrop.name).toBe("Store");
  });

  it("reassigns fixtures of the removed room that still lie in the union", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", rectPolygon(0, 0, 2, 2));
    addRoom(scene, "drop", rectPolygon(1, 1, 2, 2));
    scene.instances = [
      fixture(scene, { instanceId: "in-drop", roomId: "drop", x: 2.5, y: 2.5 }),
      fixture(scene, { instanceId: "in-keep", roomId: "keep", x: 0.5, y: 0.5 }),
      fixture(scene, { instanceId: "outside", roomId: "drop", x: 8, y: 8 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 2.2, y: 2.2 }),
    ];
    const result = officialUnionRooms(scene, "keep", "drop");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.scene.instances.map((i) => [i.instanceId, i]));
    expect(byId["in-drop"]!.roomId).toBe("keep");
    expect(byId["in-drop"]!.position).toEqual({ x: 2.5, y: 2.5, z: 2.7 });
    expect(byId["in-keep"]!.roomId).toBe("keep");
    expect(byId["outside"]!.roomId).toBeNull();
    expect(byId["outside"]!.storeyId).toBe(scene.ui.activeStoreyId);
    expect(byId["loose"]!.roomId).toBeNull();
    expect(result.scene.instances).toHaveLength(4);
    expect(officialPointInPolygonInclusive({ x: 2.5, y: 2.5 }, result.polygon)).toBe(true);
    expect(officialPointInPolygonInclusive({ x: 8, y: 8 }, result.polygon)).toBe(false);
  });

  it("refuses disjoint rooms, missing rooms, the same room, and another storey", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "a", rectPolygon(0, 0, 1, 1));
    addRoom(scene, "b", rectPolygon(3, 3, 1, 1));
    const withStorey = officialAppendStorey(scene, { id: "s2", name: "L2" });
    addRoom(withStorey, "c", rectPolygon(0, 0, 1, 1), { storeyId: "s2" });
    withStorey.ui.activeStoreyId = scene.ui.activeStoreyId;

    const disjoint = officialUnionRooms(scene, "a", "b");
    expect(disjoint.ok).toBe(false);
    if (!disjoint.ok) {
      expect(disjoint.reason).toBe("disjoint");
      expect(disjoint.status).toBe(UNION_ROOMS_REFUSE_DISJOINT_STATUS);
      expect(disjoint.scene).toBe(scene);
    }

    const missing = officialUnionRooms(scene, "a", "nope");
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe("missing");
      expect(missing.status).toBe(UNION_ROOMS_REFUSE_MISSING_STATUS);
    }

    const same = officialUnionRooms(scene, "a", "a");
    expect(same.ok).toBe(false);
    if (!same.ok) {
      expect(same.reason).toBe("same");
      expect(same.status).toBe(UNION_ROOMS_REFUSE_SAME_STATUS);
    }

    const other = officialUnionRooms(withStorey, "a", "c");
    expect(other.ok).toBe(false);
    if (!other.ok) {
      expect(other.reason).toBe("storey");
      expect(other.status).toBe(UNION_ROOMS_REFUSE_STOREY_STATUS);
      expect(withStorey.rooms.map((r) => r.id)).toEqual(expect.arrayContaining(["a", "b", "c"]));
    }
  });

  it("refuses a hole-producing union and leaves the scene unchanged", () => {
    const scene = defaultSceneV2();
    addRoom(scene, "keep", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]);
    addRoom(scene, "drop", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]);
    const snapshot = structuredClone(scene);
    const result = officialUnionRooms(scene, "keep", "drop");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("hole");
      expect(result.status).toBe(UNION_ROOMS_REFUSE_HOLE_STATUS);
    }
    expect(scene).toEqual(snapshot);
  });
});

describe("official editor Union rooms wiring", () => {
  it("places the official command beside Create rooms from DXF and uses a cancellable two-room pick", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    expect(src).toContain("Union rooms");
    expect(src).toContain("function startUnionRooms");
    expect(src).toContain("officialUnionRooms");
    expect(src).toContain("helpKey=\"tool.unionRooms\"");
    expect(src).toContain("data-help-key=\"tool.unionRooms\"");
    expect(src).toContain("endCoalesce()");
    expect(src).toContain("UNION_ROOMS_PICK_SECOND_STATUS");
    expect(src).toContain("Subtract, intersect, and alignment are not included");
    const dxfBtn = src.indexOf("Create rooms from DXF");
    const unionBtn = src.indexOf("Union rooms");
    expect(dxfBtn).toBeGreaterThan(0);
    expect(unionBtn).toBeGreaterThan(dxfBtn);
    expect(src).toContain("applyOfficialRoomUnionPick");
    expect(top).toContain("unionPickActive");
    expect(top).toContain("onUnionRoomPick");
    expect(top).toContain("roomUnionPickEscapeAction");
    expect(top).toContain("if (unionPickActive && onUnionRoomPick)");
    expect(top).not.toContain("subtractRooms");
    expect(top).not.toContain("intersectRooms");
    expect(src).not.toContain("subtractRooms");
    expect(src).not.toContain("alignRooms");
  });
});
