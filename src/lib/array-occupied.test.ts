import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray } from "./arrange-array";
import {
  ARRAY_OCCUPIED_EPS_M,
  filterPointsOccupiedInRoom,
  formatArrayApplyStatus,
  formatArrayOutsideConfirm,
  prepareFixtureArrayApply,
} from "./array-occupied";

const ROOM_A = "room_a";
const ROOM_B = "room_b";

function testRoom(id = ROOM_A): RoomV2 {
  return {
    id,
    storeyId: "gf",
    name: "Room 1",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: {
      gridSpacing: 0.5,
      maintenanceFactor: 0.8,
      en12464TemplateId: "",
    },
  };
}

const rect2x2Params = {
  mode: "rect" as const,
  rows: 2,
  cols: 2,
  count: 1,
  spacingX: 1.5,
  spacingY: 1.5,
  wallOffset: 0.5,
  rotationDeg: 0,
};

const targetEm4x3Params = {
  mode: "rect" as const,
  rows: 4,
  cols: 3,
  count: 1,
  spacingX: 2.0,
  spacingY: 1.0,
  wallOffset: 0.5,
  rotationDeg: 0,
  estimateByTargetEm: true,
};

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(__dirname, "../..", ...parts), "utf8");
}

describe("filterPointsOccupiedInRoom", () => {
  it("skips a point coincident with an existing instance in the same room (0.5, 0.5)", () => {
    const result = filterPointsOccupiedInRoom(
      [
        { x: 0.5, y: 0.5 },
        { x: 2.0, y: 0.5 },
        { x: 0.5, y: 2.0 },
        { x: 2.0, y: 2.0 },
      ],
      [{ roomId: ROOM_A, position: { x: 0.5, y: 0.5, z: 2.7 } }],
      ROOM_A
    );
    expect(result.skippedOccupied).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(result.placeable).toEqual([
      { x: 2.0, y: 0.5 },
      { x: 0.5, y: 2.0 },
      { x: 2.0, y: 2.0 },
    ]);
  });

  it("treats 1 mm as occupied and 2 mm as free (default 1 mm epsilon)", () => {
    expect(ARRAY_OCCUPIED_EPS_M).toBe(0.001);
    const existing = [{ roomId: ROOM_A, position: { x: 0.5, y: 0.5 } }];
    const at1mm = filterPointsOccupiedInRoom([{ x: 0.5 + 0.001, y: 0.5 }], existing, ROOM_A);
    const at2mm = filterPointsOccupiedInRoom([{ x: 0.5 + 0.002, y: 0.5 }], existing, ROOM_A);
    expect(at1mm.skippedOccupied).toHaveLength(1);
    expect(at1mm.placeable).toHaveLength(0);
    expect(at2mm.skippedOccupied).toHaveLength(0);
    expect(at2mm.placeable).toEqual([{ x: 0.5 + 0.002, y: 0.5 }]);
  });

  it("does not skip a coincident XY in a different room", () => {
    const result = filterPointsOccupiedInRoom(
      [{ x: 0.5, y: 0.5 }],
      [{ roomId: ROOM_B, position: { x: 0.5, y: 0.5 } }],
      ROOM_A
    );
    expect(result.placeable).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(result.skippedOccupied).toHaveLength(0);
  });

  it("places every point when the existing list is empty", () => {
    const points = [
      { x: 0.5, y: 0.5 },
      { x: 2.0, y: 2.0 },
    ];
    const result = filterPointsOccupiedInRoom(points, [], ROOM_A);
    expect(result.placeable).toEqual(points);
    expect(result.skippedOccupied).toHaveLength(0);
  });

  it("ignores Z when judging coincidence", () => {
    const result = filterPointsOccupiedInRoom(
      [{ x: 0.5, y: 0.5, z: 1.0 }],
      [{ roomId: ROOM_A, position: { x: 0.5, y: 0.5, z: 9.0 } }],
      ROOM_A
    );
    expect(result.placeable).toHaveLength(0);
    expect(result.skippedOccupied).toHaveLength(1);
  });
});

describe("formatArrayApplyStatus", () => {
  it("reports placed and skipped counts and that Apply adds rather than replaces", () => {
    const status = formatArrayApplyStatus({
      placed: 8,
      skippedOccupied: 4,
      roomName: "Room 1",
      suffix: " · Estimate only — run Calc for final Ēm / 估算 — 請用 Calc 確認",
    });
    expect(status).toBe(
      "Array placed 8 fixture(s) in Room 1 · skipped 4 already at that position (adds to the room, existing fixtures kept) / 套用為新增，不會取代既有燈具 · Estimate only — run Calc for final Ēm / 估算 — 請用 Calc 確認"
    );
    expect(status).toMatch(/skipped 4 already at that position/);
    expect(status).not.toMatch(/replac/i);
  });

  it("still states add-not-replace when nothing was skipped, without a skipped count", () => {
    const status = formatArrayApplyStatus({
      placed: 12,
      skippedOccupied: 0,
      roomName: "Room 1",
      suffix: " · calculated / 已計算",
    });
    expect(status).toBe(
      "Array placed 12 fixture(s) in Room 1 (adds to the room, existing fixtures kept) / 套用為新增，不會取代既有燈具 · calculated / 已計算"
    );
    expect(status).not.toMatch(/skipped/);
    expect(status).not.toMatch(/replac/i);
  });

  it("reports placed 0 and the skipped count when every in-room point is occupied", () => {
    const status = formatArrayApplyStatus({
      placed: 0,
      skippedOccupied: 4,
      roomName: "Room 1",
    });
    expect(status).toContain("Array placed 0 fixture(s) in Room 1");
    expect(status).toMatch(/skipped 4 already at that position/);
    expect(status).not.toMatch(/replac/i);
  });
});

describe("prepareFixtureArrayApply (Apply-equivalent)", () => {
  it("drops the documented (0.5, 0.5) overlap when a target-Ēm 4×3 is applied over an existing 2×2", () => {
    const room = testRoom();
    const existingPlan = planFixtureArray(room, rect2x2Params);
    expect(existingPlan.inside).toEqual(
      expect.arrayContaining([expect.objectContaining({ x: 0.5, y: 0.5 })])
    );
    const existing = existingPlan.inside.map((p) => ({
      roomId: room.id,
      position: { x: p.x, y: p.y, z: 2.7 },
    }));
    const targetPlan = planFixtureArray(room, targetEm4x3Params);
    expect(targetPlan.inside).toHaveLength(12);
    expect(targetPlan.inside.filter((p) => p.x === 0.5 && p.y === 0.5)).toHaveLength(1);

    const decision = prepareFixtureArrayApply(targetPlan, existing, room.id);
    expect(decision.placeable).toHaveLength(11);
    expect(decision.skippedOccupied).toEqual([expect.objectContaining({ x: 0.5, y: 0.5 })]);
    expect(decision.placeable).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ x: 0.5, y: 0.5 })])
    );
    expect(decision.placeable.some((p) => p.x === 0.5 && p.y === 0.5)).toBe(false);
    expect(decision.confirmMessage).toBeNull();
  });

  it("skips a coincident line-array point and keeps the remaining free points", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 3,
      spacingX: 1.2,
      spacingY: 1.5,
      wallOffset: 0.5,
      rotationDeg: 0,
    });
    expect(plan.inside.length).toBe(3);
    const first = plan.inside[0]!;
    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: first.x, y: first.y, z: 2.9 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(2);
    expect(decision.placeable.some((p) => p.x === first.x && p.y === first.y)).toBe(false);
  });

  it("places nothing when every planned in-room point is occupied, without treating it as a hard failure", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, rect2x2Params);
    const existing = plan.inside.map((p) => ({
      roomId: room.id,
      position: { x: p.x, y: p.y },
    }));
    const decision = prepareFixtureArrayApply(plan, existing, room.id);
    expect(decision.placeable).toHaveLength(0);
    expect(decision.skippedOccupied).toHaveLength(4);
    expect(decision.confirmMessage).toBeNull();
    const status = formatArrayApplyStatus({
      placed: decision.placeable.length,
      skippedOccupied: decision.skippedOccupied.length,
      roomName: room.name,
    });
    expect(status).toMatch(/Array placed 0 fixture\(s\) in Room 1/);
    expect(status).toMatch(/skipped 4 already at that position/);
  });

  it("mentions occupied in-room points in the outside-room confirm, and writes only free points", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "rect",
      rows: 6,
      cols: 6,
      count: 1,
      spacingX: 1.0,
      spacingY: 1.0,
      wallOffset: 0,
      rotationDeg: 0,
    });
    expect(plan.skippedOutside).toBeGreaterThan(0);
    expect(plan.inside.some((p) => p.x === 0 && p.y === 0)).toBe(true);
    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: 0, y: 0 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(plan.inside.length - 1);
    expect(decision.placeable.some((p) => p.x === 0 && p.y === 0)).toBe(false);
    expect(decision.confirmMessage).toBe(
      formatArrayOutsideConfirm({
        skippedOutside: plan.skippedOutside,
        skippedOccupied: 1,
        placeable: decision.placeable.length,
      })
    );
    expect(decision.confirmMessage).toContain(
      `${plan.skippedOutside} point(s) fall outside the room and will be skipped.`
    );
    expect(decision.confirmMessage).toContain(
      "1 already at an existing fixture will also be skipped."
    );
    expect(decision.confirmMessage).toContain(`Place ${decision.placeable.length} fixture(s)?`);
  });

  it("keeps the existing outside-room confirm when no in-room point is occupied", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "rect",
      rows: 6,
      cols: 6,
      count: 1,
      spacingX: 1.0,
      spacingY: 1.0,
      wallOffset: 0,
      rotationDeg: 0,
    });
    const decision = prepareFixtureArrayApply(plan, [], room.id);
    expect(decision.placeable).toEqual(plan.inside);
    expect(decision.skippedOccupied).toHaveLength(0);
    expect(decision.confirmMessage).toBe(
      `${plan.skippedOutside} point(s) fall outside the room and will be skipped. Place ${plan.inside.length} fixture(s)?`
    );
  });
});

describe("official array Apply wiring", () => {
  const editorSrc = readSrc("src/components/editor/BuildingEditor.tsx");
  const panelSrc = readSrc("src/components/editor/FixtureArrayPanel.tsx");
  const applyFn = editorSrc.slice(
    editorSrc.indexOf("async function applyFixtureArray"),
    editorSrc.indexOf("async function exportFullPdf")
  );

  it("filters occupied points through the Apply-equivalent helper before writeFixtureInstances", () => {
    expect(applyFn).toContain("prepareFixtureArrayApply");
    expect(applyFn).toContain("formatArrayApplyStatus");
    expect(applyFn).toMatch(/planFixtureArray\s*\(\s*activeRoom,\s*params\s*\)/);
    expect(applyFn).toMatch(/prepareFixtureArrayApply\s*\(/);
    expect(applyFn).toMatch(/decision\.placeable/);
    expect(applyFn).not.toMatch(/drafts = plan\.inside\.map/);
    expect(applyFn).toMatch(/window\.confirm\s*\(\s*decision\.confirmMessage\s*\)/);
    expect(applyFn).toMatch(/if\s*\(\s*!ok\s*\)\s*return/);
    expect(applyFn).toMatch(/if\s*\(\s*!decision\.placeable\.length\s*\)/);
    expect(applyFn).toMatch(/placed:\s*out\.instanceIds\.length/);
    expect(applyFn).toMatch(/skippedOccupied:\s*decision\.skippedOccupied\.length/);
  });

  it("uses the same occupancy helper in the Arrange preview and reports a skipped count", () => {
    expect(panelSrc).toContain("filterPointsOccupiedInRoom");
    expect(panelSrc).toContain("existingInstances");
    expect(panelSrc).toMatch(/filterPointsOccupiedInRoom\s*\(/);
    expect(panelSrc).toMatch(/skipped \(already at that position\)/);
    expect(editorSrc).toMatch(/existingInstances=\{scene\.instances\}/);
  });
});
