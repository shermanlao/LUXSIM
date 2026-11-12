import { describe, expect, it } from "vitest";
import { defaultSceneV2, rectPolygon } from "@luxsim/project-io";
import type { ProjectSceneV2, RoomV2 } from "@luxsim/project-io";
import { formatCalcEmptyError, planCalcRooms } from "./editor-calc-rooms";

function room(id: string, name: string, storeyId: string): RoomV2 {
  return {
    id,
    storeyId,
    name,
    polygon: rectPolygon(0, 0, 4, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
  };
}

function fixture(id: string, roomId: string, storeyId: string): ProjectSceneV2["instances"][number] {
  return {
    instanceId: id,
    luminaireId: "lum_1",
    storeyId,
    roomId,
    name: "A",
    position: { x: 1, y: 1, z: 2.7 },
    rotationDeg: 0,
  };
}

function sceneWith(rooms: RoomV2[], instances: ProjectSceneV2["instances"], activeRoomId: string | null) {
  const base = defaultSceneV2();
  const storeyId = base.ui.activeStoreyId;
  return {
    ...base,
    rooms: rooms.map((r) => ({ ...r, storeyId })),
    instances: instances.map((i) => ({ ...i, storeyId })),
    ui: { ...base.ui, activeRoomId },
  };
}

describe("planCalcRooms", () => {
  it("errors when Calc room has no active room", () => {
    const scene = sceneWith([], [], null);
    const plan = planCalcRooms(scene, false);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toBe("no-room");
      expect(formatCalcEmptyError(plan)).toBe("Select or create a room first");
    }
  });

  it("errors when the only selected room has no fixtures", () => {
    const scene = sceneWith([room("r1", "Office", "s")], [], "r1");
    const plan = planCalcRooms(scene, false);
    expect(plan).toMatchObject({ ok: false, reason: "all-empty", roomIds: [] });
    if (!plan.ok) {
      expect(formatCalcEmptyError(plan)).toBe("Room “Office” has no fixtures");
    }
  });

  it("skips empty rooms in Calc all but calculates the rest", () => {
    const storey = defaultSceneV2().ui.activeStoreyId;
    const scene = sceneWith(
      [room("r1", "Empty", storey), room("r2", "Lit", storey), room("r3", "Also empty", storey)],
      [fixture("i1", "r2", storey)],
      "r1"
    );
    const plan = planCalcRooms(scene, true);
    expect(plan.ok).toBe(true);
    expect(plan.roomIds).toEqual(["r2"]);
    expect(plan.skippedEmpty.map((s) => s.name)).toEqual(["Empty", "Also empty"]);
  });

  it("aborts Calc all only when every room lacks fixtures", () => {
    const scene = sceneWith(
      [room("r1", "A", "s"), room("r2", "B", "s")],
      [],
      "r1"
    );
    const plan = planCalcRooms(scene, true);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toBe("all-empty");
    expect(plan.roomIds).toEqual([]);
  });
});
