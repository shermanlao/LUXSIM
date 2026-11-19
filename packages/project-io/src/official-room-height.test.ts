import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import { officialAppendDrawnRoom, officialNewRoom } from "./new-room-defaults";
import {
  DEFAULT_NEW_ROOM_HEIGHT_M,
  DEFAULT_NEW_ROOM_HEIGHT_MM,
  MIN_ROOM_HEIGHT_M,
  applyOfficialRoomHeightMm,
  resolveOfficialNewRoomHeightM,
} from "./official-room-height";

const L_POLYGON = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

function sceneWithLRoom() {
  const scene = defaultSceneV2();
  const room = officialNewRoom({
    id: "room-l",
    storeyId: scene.ui.activeStoreyId,
    name: "L lounge",
    polygon: L_POLYGON,
    heightM: DEFAULT_NEW_ROOM_HEIGHT_M,
  });
  scene.rooms = [room];
  scene.ui.activeRoomId = null;
  return scene;
}

function editorSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );
}

function buildingSection(src: string) {
  const start = src.indexOf('<p className="cad-section-title">Building</p>');
  const props = src.indexOf('<p className="cad-section-title">Properties</p>');
  expect(start).toBeGreaterThan(-1);
  expect(props).toBeGreaterThan(start);
  return src.slice(start, props);
}

function propertiesSection(src: string) {
  const start = src.indexOf('<p className="cad-section-title">Properties</p>');
  expect(start).toBeGreaterThan(-1);
  return src.slice(start);
}

describe("resolveOfficialNewRoomHeightM", () => {
  it("defaults to 2.8 m until the Building field is changed", () => {
    expect(DEFAULT_NEW_ROOM_HEIGHT_M).toBe(2.8);
    expect(DEFAULT_NEW_ROOM_HEIGHT_MM).toBe("2800");
    expect(MIN_ROOM_HEIGHT_M).toBe(0.5);
    expect(resolveOfficialNewRoomHeightM(DEFAULT_NEW_ROOM_HEIGHT_MM)).toBe(2.8);
    expect(resolveOfficialNewRoomHeightM("2800")).toBe(2.8);
  });

  it("uses a Building field of 3200 mm as 3.2 m for the next official room", () => {
    expect(resolveOfficialNewRoomHeightM("3200")).toBe(3.2);
    expect(resolveOfficialNewRoomHeightM("3.2m", 3)).toBe(3.2);
  });

  it("falls back without inventing a height from the selected room", () => {
    expect(resolveOfficialNewRoomHeightM("", 3)).toBe(3);
    expect(resolveOfficialNewRoomHeightM("400", 3)).toBe(3);
    expect(resolveOfficialNewRoomHeightM("", Number.NaN)).toBe(2.8);
  });
});

describe("applyOfficialRoomHeightMm", () => {
  it("does not mutate existing rooms when only the next-room default changes", () => {
    const scene = sceneWithLRoom();
    const before = structuredClone(scene.rooms[0]);
    const applied = applyOfficialRoomHeightMm(scene, "3200", null);
    expect(applied.fieldMm).toBe("3200");
    expect(applied.heightM).toBe(3.2);
    expect(applied.updatedRoomId).toBeNull();
    expect(applied.scene).toBe(scene);
    expect(applied.scene.rooms[0]).toBe(scene.rooms[0]);
    expect(applied.scene.rooms[0]).toEqual(before);
    expect(applied.scene.storeys[0]!.heightM).toBe(3);
  });

  it("updates only the selected room’s ceiling", () => {
    const scene = sceneWithLRoom();
    const other = officialNewRoom({
      id: "room-rect",
      storeyId: scene.ui.activeStoreyId,
      name: "Office",
      polygon: rectPolygon(10, 0, 5, 4),
      heightM: 2.8,
    });
    scene.rooms.push(other);
    const beforeOther = structuredClone(other);
    const applied = applyOfficialRoomHeightMm(scene, "3200", "room-l");
    expect(applied.updatedRoomId).toBe("room-l");
    expect(applied.scene.rooms.find((room) => room.id === "room-l")!.heightM).toBe(3.2);
    expect(applied.scene.rooms.find((room) => room.id === "room-rect")).toEqual(beforeOther);
    expect(scene.rooms[0]!.heightM).toBe(2.8);
    expect(applied.scene.storeys[0]!.heightM).toBe(3);
  });

  it("does not write an invalid or too-small field into a selected room", () => {
    const scene = sceneWithLRoom();
    scene.ui.activeRoomId = "room-l";
    const applied = applyOfficialRoomHeightMm(scene, "400", "room-l");
    expect(applied.updatedRoomId).toBeNull();
    expect(applied.scene).toBe(scene);
    expect(applied.scene.rooms[0]!.heightM).toBe(2.8);
  });
});

describe("official new room uses the Building-level height", () => {
  it("creates the next official room at 3.2 m after the field is set with no room selected", () => {
    const scene = sceneWithLRoom();
    const before = structuredClone(scene.rooms[0]);
    const applied = applyOfficialRoomHeightMm(scene, "3200", null);
    const heightM = resolveOfficialNewRoomHeightM(applied.fieldMm);
    expect(heightM).toBe(3.2);
    const created = officialAppendDrawnRoom(applied.scene, {
      id: "room-next",
      polygon: rectPolygon(12, 0, 5, 4),
      heightM,
    });
    expect(created.created).toBe(true);
    const nextRoom = created.scene.rooms.find((room) => room.id === "room-next");
    expect(nextRoom).toBeDefined();
    expect(nextRoom!.heightM).toBe(3.2);
    expect(nextRoom!.calc.maintenanceFactor).toBe(0.8);
    expect(nextRoom!.calc.en12464TemplateId).toBe("");
    const existing = created.scene.rooms.find((room) => room.id === "room-l");
    expect(existing).toEqual(before);
    expect(existing!.polygon).toEqual(L_POLYGON);
    expect(created.scene.storeys[0]!.heightM).toBe(3);
  });

  it("still uses 2.8 m when the field is left at the default", () => {
    const scene = defaultSceneV2();
    const heightM = resolveOfficialNewRoomHeightM(DEFAULT_NEW_ROOM_HEIGHT_MM);
    const created = officialAppendDrawnRoom(scene, {
      id: "room-first",
      polygon: rectPolygon(0, 0, 5, 4),
      heightM,
    });
    expect(created.scene.rooms[0]!.heightM).toBe(2.8);
  });
});

describe("BuildingEditor Room height wiring", () => {
  const src = editorSrc();
  const building = buildingSection(src);
  const properties = propertiesSection(src);

  it("shows a Building-level Room height field when no room is selected", () => {
    expect(building).toContain('id="buildingRoomHeightMm"');
    expect(building).toContain("Room height (mm)");
    expect(building).toContain("applyRoomHeightMm");
    expect(building).not.toMatch(/activeRoom \?/);
    expect(building).toContain('helpKey="tool.roomHeight"');
    const tips = readFileSync(path.join(process.cwd(), "src/lib/ui-tips.ts"), "utf8");
    expect(tips).toMatch(/default 2800/);
    expect(src).toContain("DEFAULT_NEW_ROOM_HEIGHT_MM");
    expect(src).toMatch(/id="buildingRoomHeightMm"[\s\S]*value=\{roomHeightMm\}/);
  });

  it("uses the Building field for the next official new room", () => {
    const drawStart = src.indexOf("function resolveNewRoomHeightM");
    const drawEnd = src.indexOf("function refuseUncalibratedDrawRoom");
    expect(drawStart).toBeGreaterThan(-1);
    expect(drawEnd).toBeGreaterThan(drawStart);
    const resolveFn = src.slice(drawStart, drawEnd);
    expect(resolveFn).toContain("resolveOfficialNewRoomHeightM");
    expect(resolveFn).toContain("roomHeightMm");
    const polyStart = src.indexOf("function drawRoomPolygon");
    const polyEnd = src.indexOf("function createRectRoom");
    const drawFn = src.slice(polyStart, polyEnd);
    expect(drawFn).toContain("resolveNewRoomHeightM");
    expect(drawFn).toContain("officialAppendDrawnRoom");
    expect(drawFn).toContain("heightM");
  });

  it("updates the selected room from the same field and leaves others alone", () => {
    const applyStart = src.indexOf("function applyRoomHeightMm");
    const applyEnd = src.indexOf("function resolveNewRoomHeightM") > applyStart
      ? src.indexOf("function resolveNewRoomHeightM")
      : src.indexOf("function refuseUncalibratedDrawRoom");
    // applyRoomHeightMm may sit next to resolveNewRoomHeightM in either order
    const applyFn = src.includes("function applyRoomHeightMm")
      ? src.slice(
          src.indexOf("function applyRoomHeightMm"),
          src.indexOf("function applyRoomHeightMm") + 500
        )
      : "";
    expect(applyFn).toContain("applyOfficialRoomHeightMm");
    expect(applyFn).toContain("activeRoom");
    expect(properties).toContain('id="roomHeightMm"');
    expect(properties).toContain("applyRoomHeightMm");
    expect(properties).toMatch(/No room selected[\s\S]*Building/);
    expect(src).not.toMatch(/storeys:[\s\S]{0,80}heightM:\s*(next|heightM)/);
  });
});
