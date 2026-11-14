import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import type { RoomV2 } from "./types";
import {
  DEFAULT_NEW_ROOM_MAINTENANCE_FACTOR,
  appendOfficialNewRoom,
  defaultNewRoomCalc,
  officialNewRoom,
} from "./new-room-defaults";

function selectedOfficeRoom(): RoomV2 {
  return officialNewRoom({
    id: "room-selected",
    storeyId: "storey-gf",
    name: "Office",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 3.2,
  });
}

describe("defaultNewRoomCalc", () => {
  it("uses the documented blank defaults: MF 0.80 and no EN template", () => {
    const calc = defaultNewRoomCalc();
    expect(DEFAULT_NEW_ROOM_MAINTENANCE_FACTOR).toBe(0.8);
    expect(calc.maintenanceFactor).toBe(0.8);
    expect(calc.en12464TemplateId).toBe("");
    expect(calc.mfBreakdown).toBeUndefined();
    expect("mfBreakdown" in calc).toBe(false);
    expect(calc.gridSpacing).toBe(0.5);
    expect(calc.interreflection).toBe(true);
    expect(calc.bounces).toBe(2);
    expect(calc.computeUgr).toBe(true);
  });

  it("returns a fresh object so later edits do not leak into the next room", () => {
    const first = defaultNewRoomCalc();
    first.maintenanceFactor = 0.67;
    first.en12464TemplateId = "office";
    first.mfBreakdown = { llmf: 0.8, lsf: 1, lmf: 1, rsmf: 1 };
    const second = defaultNewRoomCalc();
    expect(second.maintenanceFactor).toBe(0.8);
    expect(second.en12464TemplateId).toBe("");
    expect(second.mfBreakdown).toBeUndefined();
  });
});

describe("appendOfficialNewRoom", () => {
  it("does not copy MF, EN template, or mfBreakdown from the selected room", () => {
    const selected = selectedOfficeRoom();
    selected.calc = {
      ...selected.calc,
      maintenanceFactor: 0.67,
      en12464TemplateId: "office",
      mfBreakdown: { llmf: 0.8, lsf: 0.9, lmf: 1, rsmf: 1 },
      gridSpacing: 1,
      interreflection: false,
      bounces: 0,
      computeUgr: false,
    };
    selected.workplaneHeightM = 0.9;
    selected.reflectance = { floor: 0.3, ceiling: 0.8, walls: 0.6 };

    const scene = defaultSceneV2();
    selected.storeyId = scene.ui.activeStoreyId;
    scene.rooms = [selected];
    scene.ui.activeRoomId = selected.id;

    const before = structuredClone(selected);
    const next = appendOfficialNewRoom(scene, {
      id: "room-new",
      polygon: rectPolygon(6, 0, 3, 3),
      heightM: 2.8,
    });
    const created = next.rooms.find((room) => room.id === "room-new");
    expect(created).toBeDefined();
    expect(created!.calc.maintenanceFactor).toBe(0.8);
    expect(created!.calc.en12464TemplateId).toBe("");
    expect(created!.calc.mfBreakdown).toBeUndefined();
    expect(created!.calc.gridSpacing).toBe(0.5);
    expect(created!.calc.interreflection).toBe(true);
    expect(created!.calc.bounces).toBe(2);
    expect(created!.calc.computeUgr).toBe(true);
    expect(created!.workplaneHeightM).toBe(0.75);
    expect(created!.reflectance).toEqual({ floor: 0.2, ceiling: 0.7, walls: 0.5 });
    expect(created!.heightM).toBe(2.8);
    expect(created!.name).toBe("Room 2");
    expect(next.ui.activeRoomId).toBe("room-new");
    expect(next.rooms).toHaveLength(2);
    expect(next.rooms[0]).toBe(selected);
    expect(next.rooms[0]).toEqual(before);
    expect(scene.rooms).toEqual([before]);
    expect(selected).toEqual(before);
  });

  it("still starts from blank defaults when no room is selected", () => {
    const scene = defaultSceneV2();
    expect(scene.ui.activeRoomId).toBeNull();
    const next = appendOfficialNewRoom(scene, {
      id: "room-first",
      polygon: rectPolygon(0, 0, 5, 4),
      heightM: 3,
    });
    expect(next.rooms).toHaveLength(1);
    expect(next.rooms[0]!.calc.maintenanceFactor).toBe(0.8);
    expect(next.rooms[0]!.calc.en12464TemplateId).toBe("");
    expect(next.rooms[0]!.calc.mfBreakdown).toBeUndefined();
    expect(next.rooms[0]!.name).toBe("Room 1");
  });
});

describe("official editor create-room paths", () => {
  it("uses the helper and does not inherit calc settings from activeRoom", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain("officialAppendDrawnRoom");
    expect(src).toContain("createRectRoom");
    const drawStart = src.indexOf("function drawRoomPolygon");
    const createStart = src.indexOf("function createRectRoom");
    const uploadStart = src.indexOf("async function onUploadPhotometry");
    expect(drawStart).toBeGreaterThan(-1);
    expect(createStart).toBeGreaterThan(drawStart);
    expect(uploadStart).toBeGreaterThan(createStart);
    const drawFn = src.slice(drawStart, createStart);
    const createFn = src.slice(createStart, uploadStart);
    expect(drawFn).toContain("officialAppendDrawnRoom");
    expect(drawFn).not.toMatch(/activeRoom/);
    expect(drawFn).not.toMatch(/maintenanceFactor/);
    expect(drawFn).not.toMatch(/en12464TemplateId/);
    expect(drawFn).not.toMatch(/mfBreakdown/);
    expect(createFn).toContain("drawRoomPolygon(");
    expect(src).not.toMatch(/activeRoom\?\.calc\.maintenanceFactor/);
    expect(src).not.toMatch(/activeRoom\?\.calc\.en12464TemplateId/);
    expect(src).not.toMatch(/activeRoom\?\.calc\.mfBreakdown/);
  });
});
