import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getEn12464Template, rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray } from "./arrange-array";
import { computeRectSpacingFromBounds, estimateFixtureCountForTargetEm, pickSquareishGrid } from "./arrange-by-em";
import {
  automaticPlacementDefaultsFromRoom,
  defaultMaxSpacingToHm,
  DEFAULT_MAX_SPACING_TO_HM,
  DEFAULT_TARGET_EM_MAINTAINED_LX,
  formatAutomaticPlacementRefusal,
  minPointsAlongLength,
  mountingHeightAboveWorkplaneM,
  officialPointInRoomPolygon,
  planAutomaticPlacement,
  pointRespectsWallOffset,
  TIGHT_MAX_SPACING_TO_HM,
  type AutomaticPlacementInput,
} from "./automatic-placement";
import { filterPointsOccupiedInRoom } from "./array-occupied";

function baseRoom(over: Partial<RoomV2> = {}): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 5, 4),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "" },
    ...over,
  };
}

/** L-shape: 8×8 AABB with a 4×4 cut from the north-east corner. Area = 48 m². */
function lShapedRoom(over: Partial<RoomV2> = {}): RoomV2 {
  return baseRoom({
    name: "L office",
    polygon: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 8 },
      { x: 0, y: 8 },
    ],
    ...over,
  });
}

function input(over: Partial<AutomaticPlacementInput> = {}): AutomaticPlacementInput {
  return {
    targetEmMaintainedLx: 500,
    luminousFluxLm: 2000,
    utilance: 0.6,
    maintenanceFactor: 0.8,
    wallOffset: 0.5,
    rotationDeg: 0,
    maxSpacingToHm: DEFAULT_MAX_SPACING_TO_HM,
    utilanceIsDefault: true,
    ...over,
  };
}

describe("estimateFixtureCountForTargetEm (lumen method)", () => {
  it("rounds n up with ceil: 20 m² at 500 lx needs 11 of 2000 lm", () => {
    const n = estimateFixtureCountForTargetEm({
      areaM2: 20,
      targetEmMaintainedLx: 500,
      luminousFluxLm: 2000,
      utilance: 0.6,
      maintenanceFactor: 0.8,
    });
    expect(n).toBe(11);
  });
});

describe("EN-template default Ēm and S/Hm", () => {
  it("defaults Ēm to 500 lx and S/Hm to 1.5 when no template is set", () => {
    const d = automaticPlacementDefaultsFromRoom(baseRoom());
    expect(d.targetEmMaintainedLx).toBe(DEFAULT_TARGET_EM_MAINTAINED_LX);
    expect(d.maxSpacingToHm).toBe(DEFAULT_MAX_SPACING_TO_HM);
    expect(d.templateId).toBeNull();
    expect(d.templateUo).toBeNull();
  });

  it("defaults maintained Ēm to the EN assist template em and shows Uo", () => {
    const office = getEn12464Template("office");
    expect(office?.em).toBe(500);
    expect(office?.uo).toBe(0.6);
    const d = automaticPlacementDefaultsFromRoom(
      baseRoom({ calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "office" } })
    );
    expect(d.targetEmMaintainedLx).toBe(500);
    expect(d.templateId).toBe("office");
    expect(d.templateEm).toBe(500);
    expect(d.templateUo).toBe(0.6);
    expect(d.maxSpacingToHm).toBe(DEFAULT_MAX_SPACING_TO_HM);
  });

  it("tightens default S/Hm to 1.25 when Uo is at least 0.70", () => {
    expect(defaultMaxSpacingToHm(0.6)).toBe(DEFAULT_MAX_SPACING_TO_HM);
    expect(defaultMaxSpacingToHm(0.69)).toBe(DEFAULT_MAX_SPACING_TO_HM);
    expect(defaultMaxSpacingToHm(0.7)).toBe(TIGHT_MAX_SPACING_TO_HM);
    expect(defaultMaxSpacingToHm(0.8)).toBe(TIGHT_MAX_SPACING_TO_HM);
    expect(defaultMaxSpacingToHm(null)).toBe(DEFAULT_MAX_SPACING_TO_HM);
  });

  it("uses a classroom template em of 300 lx as the default target", () => {
    const d = automaticPlacementDefaultsFromRoom(
      baseRoom({ calc: { gridSpacing: 0.5, maintenanceFactor: 0.8, en12464TemplateId: "classroom" } })
    );
    expect(d.targetEmMaintainedLx).toBe(300);
    expect(d.templateUo).toBe(0.6);
  });
});

describe("mounting height and S/Hm count raising", () => {
  it("uses (height − 0.1) − workplane, clamped to a small positive minimum", () => {
    expect(mountingHeightAboveWorkplaneM(baseRoom())).toBeCloseTo(1.95, 10);
    const tight = baseRoom({ heightM: 0.8, workplaneHeightM: 0.75 });
    expect(mountingHeightAboveWorkplaneM(tight)).toBe(0.01);
  });

  it("raises n above the lumen-method count when implied spacing would exceed S/Hm", () => {
    // Large 12×10 room, dim target so lumen n is small, tight S/Hm cap.
    const room = baseRoom({ polygon: rectPolygon(0, 0, 12, 10) });
    const hm = mountingHeightAboveWorkplaneM(room);
    const maxSOverHm = 1.5;
    const maxSpacing = maxSOverHm * hm;
    const lumenN = estimateFixtureCountForTargetEm({
      areaM2: 120,
      targetEmMaintainedLx: 50,
      luminousFluxLm: 8000,
      utilance: 0.6,
      maintenanceFactor: 0.8,
    });
    expect(lumenN).toBeGreaterThanOrEqual(1);
    expect(lumenN).toBeLessThan(8);

    const usableW = 12 - 1;
    const usableH = 10 - 1;
    const minCols = minPointsAlongLength(usableW, maxSpacing);
    const minRows = minPointsAlongLength(usableH, maxSpacing);
    expect(minCols * minRows).toBeGreaterThan(lumenN);

    const out = planAutomaticPlacement(
      room,
      input({
        targetEmMaintainedLx: 50,
        luminousFluxLm: 8000,
        maxSpacingToHm: maxSOverHm,
      })
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.estimate.lumenMethodCount).toBe(lumenN);
    expect(out.estimate.fixtureCount).toBeGreaterThan(lumenN);
    expect(out.points).toHaveLength(out.estimate.fixtureCount);
    expect(out.estimate.maxSpacingM).toBeLessThanOrEqual(maxSpacing + 1e-6);
    for (const p of out.points) {
      expect(pointRespectsWallOffset(p, room.polygon, 0.5)).toBe(true);
    }
  });
});

describe("polygon-aware layout for irregular rooms", () => {
  it("places at least the required n inside an L-shaped room where an AABB grid drops points", () => {
    const room = lShapedRoom();
    const area = 48;
    const flux = 3000;
    const lumenN = estimateFixtureCountForTargetEm({
      areaM2: area,
      targetEmMaintainedLx: 500,
      luminousFluxLm: flux,
      utilance: 0.6,
      maintenanceFactor: 0.8,
    });
    expect(lumenN).toBe(17);

    const { rows, cols } = pickSquareishGrid(lumenN);
    const wallOffset = 0.5;
    const spacing = computeRectSpacingFromBounds(room, rows, cols, wallOffset);
    const aabb = planFixtureArray(room, {
      mode: "rect",
      rows,
      cols,
      count: lumenN,
      spacingX: spacing.spacingX,
      spacingY: spacing.spacingY,
      wallOffset,
      rotationDeg: 0,
    });
    expect(aabb.skippedOutside).toBeGreaterThan(0);
    expect(aabb.inside.length).toBeLessThan(lumenN);

    const out = planAutomaticPlacement(
      room,
      input({ luminousFluxLm: flux, wallOffset, maxSpacingToHm: 1.5 })
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.estimate.lumenMethodCount).toBe(17);
    expect(out.points.length).toBeGreaterThanOrEqual(lumenN);
    expect(out.plan.skippedOutside).toBe(0);
    expect(out.points).toHaveLength(out.estimate.fixtureCount);
    for (const p of out.points) {
      expect(officialPointInRoomPolygon(p, room.polygon)).toBe(true);
      expect(pointRespectsWallOffset(p, room.polygon, wallOffset)).toBe(true);
      // Must not sit in the missing north-east cut-out.
      expect(p.x > 4 + 1e-9 && p.y > 4 + 1e-9).toBe(false);
    }
  });

  it("places all planned points inside a rectangular room", () => {
    const room = baseRoom();
    const out = planAutomaticPlacement(room, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.estimate.lumenMethodCount).toBe(11);
    expect(out.points.length).toBeGreaterThanOrEqual(11);
    expect(out.plan.skippedOutside).toBe(0);
    for (const p of out.points) {
      expect(pointRespectsWallOffset(p, room.polygon, 0.5)).toBe(true);
    }
  });
});

describe("occupied skip and refusals", () => {
  it("skips planned points within 1 mm of an existing same-room fixture and keeps the rest", () => {
    const room = baseRoom();
    const out = planAutomaticPlacement(room, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const first = out.points[0]!;
    const filtered = filterPointsOccupiedInRoom(
      out.points,
      [{ roomId: room.id, position: { x: first.x, y: first.y, z: 2.7 } }],
      room.id
    );
    expect(filtered.skippedOccupied).toHaveLength(1);
    expect(filtered.placeable).toHaveLength(out.points.length - 1);
    expect(filtered.placeable.some((p) => p.x === first.x && p.y === first.y)).toBe(false);
  });

  it("reports all-occupied when every planned point is taken", () => {
    const room = baseRoom();
    const out = planAutomaticPlacement(room, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const existing = out.points.map((p) => ({
      roomId: room.id,
      position: { x: p.x, y: p.y },
    }));
    const filtered = filterPointsOccupiedInRoom(out.points, existing, room.id);
    expect(filtered.placeable).toHaveLength(0);
    expect(filtered.skippedOccupied).toHaveLength(out.points.length);
    expect(formatAutomaticPlacementRefusal("all-occupied")).toMatch(/already occupied/);
    expect(formatAutomaticPlacementRefusal("all-occupied")).toMatch(/沒有寫入新燈具/);
  });

  it("refuses an invalid target, missing flux, a collapsed wall offset, and a bad S/Hm", () => {
    const room = baseRoom();
    expect(planAutomaticPlacement(room, input({ targetEmMaintainedLx: 0 })).ok).toBe(false);
    if (planAutomaticPlacement(room, input({ targetEmMaintainedLx: 0 })).ok === false) {
      expect(planAutomaticPlacement(room, input({ targetEmMaintainedLx: 0 }))).toMatchObject({
        reason: "invalid-target",
      });
    }
    expect(planAutomaticPlacement(room, input({ luminousFluxLm: 0 }))).toMatchObject({
      ok: false,
      reason: "no-flux",
    });
    expect(planAutomaticPlacement(room, input({ maxSpacingToHm: 0 }))).toMatchObject({
      ok: false,
      reason: "invalid-max-s-over-hm",
    });
    expect(planAutomaticPlacement(room, input({ wallOffset: 3 }))).toMatchObject({
      ok: false,
      reason: "no-usable-area",
    });
    expect(formatAutomaticPlacementRefusal("invalid-target")).toMatch(/greater than 0/);
    expect(formatAutomaticPlacementRefusal("no-flux")).toMatch(/Luminous flux/);
    expect(formatAutomaticPlacementRefusal("no-usable-area")).toMatch(/Wall offset/);
    expect(formatAutomaticPlacementRefusal("no-room")).toMatch(/Select a room/);
  });
});

describe("official Automatic Placement quantity", () => {
  it("still reports at least the lumen-method count for a 5×4 rectangle", () => {
    const out = planAutomaticPlacement(baseRoom(), input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.estimate.fixtureCount).toBeGreaterThanOrEqual(11);
    expect(out.estimate.arrayParams.automaticPlacement).toBe(true);
  });
});

describe("minPointsAlongLength", () => {
  it("is 1 when the span is within the maximum spacing", () => {
    expect(minPointsAlongLength(2.925, 2.925)).toBe(1);
    expect(minPointsAlongLength(2.0, 2.925)).toBe(1);
  });

  it("adds points so that edge-to-edge spacing stays within the cap", () => {
    expect(minPointsAlongLength(6, 2.925)).toBeGreaterThanOrEqual(4);
    const n = minPointsAlongLength(6, 2.925);
    expect(6 / (n - 1)).toBeLessThanOrEqual(2.925 + 1e-12);
  });
});

describe("official Automatic Placement wiring", () => {
  it("labels the Arrange operation Automatic placement / 自動佈燈 and hides it in view-only", () => {
    const panel = readFileSync(path.join(__dirname, "../components/editor/FixtureArrayPanel.tsx"), "utf8");
    const editor = readFileSync(path.join(__dirname, "../components/editor/BuildingEditor.tsx"), "utf8");
    expect(panel).toContain('["automatic", "Automatic placement", "自動佈燈"]');
    expect(panel).not.toMatch(/DIALux|evo/);
    expect(panel).toContain("planAutomaticPlacement");
    expect(panel).toContain("OFFICIAL_WAIT_COPY.planningAutomaticPlacement");
    expect(panel).toContain('helpKey="tool.automaticPlacement"');
    expect(editor).toContain("planAutomaticPlacement");
    expect(editor).toContain("OFFICIAL_WAIT_COPY.planningAutomaticPlacement");
    expect(editor).toContain("workflow === \"light\" && !readOnly && (");
    expect(editor).toContain("runOfficialWait={officialWait.run}");
    expect(editor).toContain("formatAutomaticPlacementRefusal");
    expect(editor).toContain("requestFixtureWrite");
    expect(editor).toContain("writeFixtureInstances");
  });
});
