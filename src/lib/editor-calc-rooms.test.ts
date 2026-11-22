import { describe, expect, it } from "vitest";
import { defaultSceneV2, rectPolygon } from "@luxsim/project-io";
import type { ProjectSceneV2, RoomV2 } from "@luxsim/project-io";
import {
  formatCalcBusyStatus,
  formatCalcCompleteStatus,
  formatCalcEmptyError,
  planCalcRooms,
} from "./editor-calc-rooms";

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

function sceneWith(
  rooms: RoomV2[],
  instances: ProjectSceneV2["instances"],
  activeRoomId: string | null,
  activeStoreyId?: string
) {
  const base = defaultSceneV2();
  const storeyId = activeStoreyId ?? base.ui.activeStoreyId;
  return {
    ...base,
    rooms: rooms.map((r) => ({ ...r, storeyId })),
    instances: instances.map((i) => ({ ...i, storeyId })),
    ui: { ...base.ui, activeRoomId, activeStoreyId: storeyId },
  };
}

describe("planCalcRooms", () => {
  it("errors when Calc room has no active room", () => {
    const scene = sceneWith([], [], null);
    const plan = planCalcRooms(scene, "room");
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toBe("no-room");
      expect(plan.scope).toBe("room");
      expect(formatCalcEmptyError(plan)).toBe("Select or create a room first");
    }
  });

  it("errors when the only selected room has no fixtures", () => {
    const base = defaultSceneV2();
    const storey = base.ui.activeStoreyId;
    const scene = {
      ...base,
      rooms: [room("r1", "Office", storey)],
      instances: [],
      ui: { ...base.ui, activeRoomId: "r1", activeStoreyId: storey },
    };
    const plan = planCalcRooms(scene, "room");
    expect(plan).toMatchObject({ ok: false, reason: "all-empty", roomIds: [], scope: "room" });
    if (!plan.ok) {
      expect(formatCalcEmptyError(plan)).toBe("Room “Office” has no fixtures");
    }
  });

  it("skips empty rooms in Calc all but calculates the rest", () => {
    const base = defaultSceneV2();
    const storey = base.ui.activeStoreyId;
    const scene = {
      ...base,
      rooms: [room("r1", "Empty", storey), room("r2", "Lit", storey), room("r3", "Also empty", storey)],
      instances: [fixture("i1", "r2", storey)],
      ui: { ...base.ui, activeRoomId: "r1", activeStoreyId: storey },
    };
    const plan = planCalcRooms(scene, "all");
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
    const plan = planCalcRooms(scene, "all");
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toBe("all-empty");
    expect(plan.roomIds).toEqual([]);
  });

  it("plans only rooms on the active storey for Calc storey", () => {
    const base = defaultSceneV2();
    const s1 = base.ui.activeStoreyId;
    const s2 = "storey_other";
    const scene: ProjectSceneV2 = {
      ...base,
      storeys: [
        ...base.storeys,
        { id: s2, name: "1F", elevationM: 3, heightM: 3 },
      ],
      rooms: [
        room("r1", "GF Office", s1),
        room("r2", "GF Empty", s1),
        room("r3", "1F Lit", s2),
      ],
      instances: [fixture("i1", "r1", s1), fixture("i2", "r3", s2)],
      ui: { ...base.ui, activeStoreyId: s1, activeRoomId: "r3" },
    };
    const plan = planCalcRooms(scene, "storey");
    expect(plan.ok).toBe(true);
    expect(plan.roomIds).toEqual(["r1"]);
    expect(plan.skippedEmpty.map((s) => s.name)).toEqual(["GF Empty"]);
    expect(plan.roomIds).not.toContain("r3");
  });

  it("refuses Calc storey when the active storey has no rooms", () => {
    const base = defaultSceneV2();
    const s2 = "storey_empty";
    const scene: ProjectSceneV2 = {
      ...base,
      storeys: [...base.storeys, { id: s2, name: "Empty floor", elevationM: 3, heightM: 3 }],
      rooms: [room("r1", "GF", base.ui.activeStoreyId)],
      instances: [fixture("i1", "r1", base.ui.activeStoreyId)],
      ui: { ...base.ui, activeStoreyId: s2, activeRoomId: null },
    };
    const plan = planCalcRooms(scene, "storey");
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toBe("no-room");
      expect(formatCalcEmptyError(plan)).toBe("No rooms on this storey / 此樓層沒有房間");
    }
  });

  it("refuses Calc storey when every room on the storey lacks fixtures", () => {
    const base = defaultSceneV2();
    const storey = base.ui.activeStoreyId;
    const scene = {
      ...base,
      rooms: [room("r1", "A", storey), room("r2", "B", storey)],
      instances: [],
      ui: { ...base.ui, activeRoomId: "r1", activeStoreyId: storey },
    };
    const plan = planCalcRooms(scene, "storey");
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toBe("all-empty");
      expect(formatCalcEmptyError(plan)).toBe(
        "No rooms on this storey have fixtures to calculate / 此樓層沒有可計算的房間"
      );
    }
  });
});

describe("formatCalcBusyStatus", () => {
  it("uses a bilingual storey busy status", () => {
    expect(formatCalcBusyStatus("storey")).toBe("Calculating storey… / 正在計算樓層…");
    expect(formatCalcBusyStatus("room")).toBe("Calculating on client…");
    expect(formatCalcBusyStatus("all")).toBe("Calculating on client…");
  });
});

describe("formatCalcCompleteStatus", () => {
  it("keeps the empty-room skip wording", () => {
    expect(formatCalcCompleteStatus([{ id: "r2", name: "Room 2" }], true)).toBe(
      "Calculation complete (client-side) / 客戶端計算完成 · skipped Room 2 (no fixtures)"
    );
    expect(
      formatCalcCompleteStatus(
        [
          { id: "r1", name: "Empty" },
          { id: "r3", name: "Also empty" },
        ],
        true
      )
    ).toBe(
      "Calculation complete (client-side) / 客戶端計算完成 · skipped Empty, Also empty (no fixtures)"
    );
  });

  it("explains rooms skipped for missing photometry without dropping the empty-room clause", () => {
    expect(
      formatCalcCompleteStatus(
        [{ id: "r1", name: "Empty" }],
        true,
        [{ id: "r3", name: "Broken" }]
      )
    ).toBe(
      "Calculation complete (client-side) / 客戶端計算完成 · skipped Empty (no fixtures), Broken (missing photometry)"
    );
  });
});
