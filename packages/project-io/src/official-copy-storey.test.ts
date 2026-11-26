import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSceneV2 } from "./migrate";
import { officialNewRoom } from "./new-room-defaults";
import { officialAppendStorey } from "./official-storey-metrics";
import { rectPolygon, roomAreaM2 } from "./geometry";
import {
  COPY_STOREY_REFUSE_BUILDING_STATUS,
  COPY_STOREY_REFUSE_INVALID_STATUS,
  COPY_STOREY_REFUSE_MISSING_STATUS,
  formatCopyStoreySuccessStatus,
  officialCopyStorey,
  officialCopyStoreyElevationM,
  officialCopyStoreyName,
} from "./official-copy-storey";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
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
  room.calc.maintenanceFactor = 0.8;
  room.calc.en12464TemplateId = "office";
  room.calc.mfBreakdown = { llmf: 0.95 };
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
    storeyId?: string;
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
    rcpProposalId: "rcp-1",
  };
}

function ids() {
  let rooms = 0;
  let instances = 0;
  return {
    nextRoomId: () => `copy-room-${++rooms}`,
    nextInstanceId: () => `copy-fix-${++instances}`,
  };
}

describe("officialCopyStoreyName and elevation", () => {
  it("uses Copy of and a numeric suffix when the name is taken, and steps over an occupied elevation", () => {
    expect(officialCopyStoreyName("GF", ["GF"])).toBe("Copy of GF");
    expect(officialCopyStoreyName("GF", ["GF", "Copy of GF"])).toBe("Copy of GF 2");
    expect(officialCopyStoreyName("GF", ["GF", "Copy of GF", "Copy of GF 2"])).toBe(
      "Copy of GF 3"
    );
    expect(officialCopyStoreyElevationM({ elevationM: 0, heightM: 3 }, [])).toBe(3);
    expect(officialCopyStoreyElevationM({ elevationM: 0, heightM: 3 }, [3])).toBe(6);
    expect(officialCopyStoreyElevationM({ elevationM: 0, heightM: 4 }, [3])).toBe(4);
  });
});

describe("officialCopyStorey", () => {
  it("copies rooms and luminaires onto a new storey above the source and leaves the source unchanged", () => {
    const scene = defaultSceneV2();
    const sourceId = scene.ui.activeStoreyId;
    addRoom(scene, "office", rectPolygon(0, 0, 4, 3), "Office");
    addRoom(scene, "lounge", L_POLYGON, "Lounge");
    scene.instances = [
      fixture(scene, { instanceId: "in-office", roomId: "office", x: 1, y: 1, z: 2.6 }),
      fixture(scene, { instanceId: "loose", roomId: null, x: 9, y: 9 }),
    ];
    const before = structuredClone(scene);
    const result = officialCopyStorey(scene, { storeyId: "storey-copy", ...ids() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(formatCopyStoreySuccessStatus("GF", "Copy of GF", 3));
    expect(result.elevationM).toBe(3);
    expect(result.sourceStoreyId).toBe(sourceId);
    const copy = result.scene.storeys.find((st) => st.id === "storey-copy")!;
    expect(copy).toMatchObject({ name: "Copy of GF", elevationM: 3, heightM: 3 });
    expect(result.scene.ui.activeStoreyId).toBe("storey-copy");
    expect(result.scene.ui.activeRoomId).toBeNull();
    expect(result.scene.storeys.find((st) => st.id === sourceId)).toEqual(before.storeys[0]);
    expect(result.scene.rooms.filter((r) => r.storeyId === sourceId)).toEqual(before.rooms);
    expect(result.scene.instances.filter((i) => i.storeyId === sourceId)).toEqual(before.instances);

    const copiedOffice = result.scene.rooms.find((r) => r.id === "copy-room-1")!;
    const copiedLounge = result.scene.rooms.find((r) => r.id === "copy-room-2")!;
    expect(copiedOffice.storeyId).toBe("storey-copy");
    expect(copiedOffice.name).toBe("Office");
    expect(copiedOffice.polygon).toEqual(rectPolygon(0, 0, 4, 3));
    expect(copiedOffice.heightM).toBe(2.8);
    expect(copiedOffice.calc.maintenanceFactor).toBe(0.8);
    expect(copiedOffice.calc.en12464TemplateId).toBe("office");
    expect(copiedOffice.calc.mfBreakdown).toEqual({ llmf: 0.95 });
    expect(copiedLounge.polygon).toEqual(L_POLYGON);
    expect(roomAreaM2(copiedLounge)).toBe(roomAreaM2(scene.rooms.find((r) => r.id === "lounge")!));
    expect(copiedOffice.id).not.toBe("office");

    const copiedFix = result.scene.instances.find((i) => i.instanceId === "copy-fix-1")!;
    const copiedLoose = result.scene.instances.find((i) => i.instanceId === "copy-fix-2")!;
    expect(copiedFix).toMatchObject({
      luminaireId: "lum-1",
      storeyId: "storey-copy",
      roomId: "copy-room-1",
      rotationDeg: 15,
      position: { x: 1, y: 1, z: 2.6 },
    });
    expect(copiedFix.rcpProposalId).toBeUndefined();
    expect(copiedLoose.roomId).toBeNull();
    expect(copiedLoose.storeyId).toBe("storey-copy");
    expect(scene.storeys).toHaveLength(1);
  });

  it("uses the next free elevation when the slot above the source is already taken, and keeps source height", () => {
    let scene = defaultSceneV2();
    scene.storeys[0]!.heightM = 4;
    addRoom(scene, "office", rectPolygon(0, 0, 2, 2), "Office");
    scene = officialAppendStorey(scene, { id: "l1", name: "L1" });
    expect(scene.storeys[1]?.elevationM).toBe(4);
    const result = officialCopyStorey(scene, {
      storeyId: "copy-1",
      sourceStoreyId: scene.storeys[0]!.id,
      ...ids(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // L1 already sits at 4 m, so the copy steps up by the source height again to 8 m.
    expect(result.elevationM).toBe(8);
    expect(result.scene.storeys.find((st) => st.id === "copy-1")).toMatchObject({
      name: "Copy of GF",
      elevationM: 8,
      heightM: 4,
    });
  });

  it("refuses an empty building, a missing storey, and a colliding storey id", () => {
    const empty = defaultSceneV2();
    empty.storeys = [];
    const building = officialCopyStorey(empty, { storeyId: "copy", ...ids() });
    expect(building).toMatchObject({
      ok: false,
      status: COPY_STOREY_REFUSE_BUILDING_STATUS,
      reason: "building",
    });
    expect(building.scene).toBe(empty);

    const scene = defaultSceneV2();
    const missing = officialCopyStorey(scene, {
      storeyId: "copy",
      sourceStoreyId: "nope",
      ...ids(),
    });
    expect(missing).toMatchObject({
      ok: false,
      status: COPY_STOREY_REFUSE_MISSING_STATUS,
      reason: "missing",
    });
    expect(missing.scene).toBe(scene);

    const withL1 = officialAppendStorey(scene, { id: "l1" });
    const clash = officialCopyStorey(withL1, { storeyId: "l1", ...ids() });
    expect(clash).toMatchObject({
      ok: false,
      status: COPY_STOREY_REFUSE_INVALID_STATUS,
      reason: "invalid",
    });
    expect(clash.scene).toBe(withL1);
  });
});

describe("official editor Copy storey wiring", () => {
  it("places the official command in Building beside Add storey", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain("Copy storey");
    expect(src).toContain("function copyStorey");
    expect(src).toContain("officialCopyStorey");
    expect(src).toContain('helpKey="tool.copyStorey"');
    expect(src).toContain('data-help-key="tool.copyStorey"');
    expect(src).toContain("endCoalesce()");
    const addBtn = src.indexOf("Add storey");
    const copyBtn = src.indexOf("Copy storey");
    expect(addBtn).toBeGreaterThan(0);
    expect(copyBtn).toBeGreaterThan(addBtn);
    const buildingStart = src.indexOf('<p className="cad-section-title">Building</p>');
    const tools = src.indexOf(">Tools</h3>");
    expect(copyBtn).toBeGreaterThan(buildingStart);
    expect(copyBtn).toBeLessThan(tools);
  });
});
