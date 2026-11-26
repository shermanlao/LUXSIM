import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";
import { officialNewRoom } from "./new-room-defaults";
import { DEFAULT_NEW_ROOM_HEIGHT_M, DEFAULT_NEW_ROOM_HEIGHT_MM } from "./official-room-height";
import {
  DEFAULT_STOREY_HEIGHT_M,
  MIN_STOREY_HEIGHT_M,
  STOREY_METRICS_EXPLANATION,
  applyOfficialStoreyMetrics,
  officialAppendStorey,
} from "./official-storey-metrics";

const L_POLYGON = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

function editorSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
    "utf8"
  );
}

function userGuide() {
  return readFileSync(path.join(process.cwd(), "docs/USER_GUIDE.md"), "utf8");
}

function uiTips() {
  return readFileSync(path.join(process.cwd(), "src/lib/ui-tips.ts"), "utf8");
}

describe("officialAppendStorey", () => {
  it("places L1 at elevation 3.0 m with storey height 3.0 m after the default GF", () => {
    const scene = defaultSceneV2();
    expect(scene.storeys).toHaveLength(1);
    expect(scene.storeys[0]!.name).toBe("GF");
    expect(scene.storeys[0]!.elevationM).toBe(0);
    expect(scene.storeys[0]!.heightM).toBe(3);
    expect(DEFAULT_STOREY_HEIGHT_M).toBe(3);
    expect(DEFAULT_NEW_ROOM_HEIGHT_M).toBe(2.8);

    const gf = structuredClone(scene.storeys[0]);
    const next = officialAppendStorey(scene, { id: "storey-l1" });
    expect(next.storeys).toHaveLength(2);
    expect(next.storeys[0]).toEqual(gf);
    expect(next.storeys[1]!.id).toBe("storey-l1");
    expect(next.storeys[1]!.name).toBe("L1");
    expect(next.storeys[1]!.elevationM).toBe(3);
    expect(next.storeys[1]!.heightM).toBe(3);
    expect(next.ui.activeStoreyId).toBe("storey-l1");
    expect(next.ui.activeRoomId).toBeNull();
    expect(scene.storeys).toHaveLength(1);
  });

  it("does not change existing rooms or the room-height default when adding a storey", () => {
    const scene = defaultSceneV2();
    const room = officialNewRoom({
      id: "room-l",
      storeyId: scene.ui.activeStoreyId,
      name: "L lounge",
      polygon: L_POLYGON,
      heightM: DEFAULT_NEW_ROOM_HEIGHT_M,
    });
    scene.rooms = [room];
    const before = structuredClone(room);
    const next = officialAppendStorey(scene, { id: "storey-l1" });
    expect(next.rooms[0]).toEqual(before);
    expect(next.rooms[0]!.heightM).toBe(2.8);
    expect(next.storeys[1]!.heightM).toBe(3);
  });
});

describe("applyOfficialStoreyMetrics", () => {
  it("updates only the selected storey and leaves rooms and other storeys unchanged", () => {
    const scene = officialAppendStorey(defaultSceneV2(), { id: "storey-l1" });
    const room = officialNewRoom({
      id: "room-l",
      storeyId: scene.storeys[0]!.id,
      name: "L lounge",
      polygon: L_POLYGON,
      heightM: 2.8,
    });
    scene.rooms = [room];
    const gfBefore = structuredClone(scene.storeys[0]);
    const roomBefore = structuredClone(room);
    const next = applyOfficialStoreyMetrics(scene, "storey-l1", {
      elevationM: 3.2,
      heightM: 3.5,
    });
    expect(next.storeys[1]!.elevationM).toBe(3.2);
    expect(next.storeys[1]!.heightM).toBe(3.5);
    expect(next.storeys[0]).toEqual(gfBefore);
    expect(next.rooms[0]).toEqual(roomBefore);
    expect(scene.storeys[1]!.elevationM).toBe(3);
    expect(MIN_STOREY_HEIGHT_M).toBe(0.5);
  });

  it("does not write a too-small storey height", () => {
    const scene = officialAppendStorey(defaultSceneV2(), { id: "storey-l1" });
    const next = applyOfficialStoreyMetrics(scene, "storey-l1", { heightM: 0.4 });
    expect(next).toBe(scene);
    expect(next.storeys[1]!.heightM).toBe(3);
  });
});

describe("storey metrics explanation", () => {
  it("states the relationship accurately, including the 3.0 m / 2.8 m defaults", () => {
    expect(STOREY_METRICS_EXPLANATION).toMatch(/Storey elevation is the floor level/);
    expect(STOREY_METRICS_EXPLANATION).toMatch(/floor-to-floor spacing \(default 3\.0 m\)/);
    expect(STOREY_METRICS_EXPLANATION).toMatch(
      /Add storey places the next floor at this storey’s elevation \+ storey height/
    );
    expect(STOREY_METRICS_EXPLANATION).toContain(
      `Room height is the ceiling inside a room (default ${DEFAULT_NEW_ROOM_HEIGHT_MM} mm)`
    );
    expect(STOREY_METRICS_EXPLANATION).toMatch(
      /0\.2 m difference is left for the slab \/ structure/
    );
    expect(STOREY_METRICS_EXPLANATION).toMatch(/not modelled automatically/);
    expect(STOREY_METRICS_EXPLANATION).toMatch(
      /Changing these values does not move other storeys or existing rooms/
    );
  });
});

describe("BuildingEditor and user-guide wiring", () => {
  const src = editorSrc();
  const guide = userGuide();
  const tips = uiTips();

  it("shows elevation, storey height, and the official help tip in Building", () => {
    const start = src.indexOf('<p className="cad-section-title">Building</p>');
    const tools = src.indexOf(">Tools</h3>");
    expect(start).toBeGreaterThan(-1);
    expect(tools).toBeGreaterThan(start);
    const building = src.slice(start, tools);
    expect(building).toContain('helpKey="tool.storeyHeight"');
    expect(building).not.toContain("STOREY_METRICS_EXPLANATION");
    expect(building).toContain('id="storeyElevationM"');
    expect(building).toContain("Elevation (m)");
    expect(building).toContain('id="storeyHeightM"');
    expect(building).toContain("Storey height (m)");
    expect(building).toContain("applyStoreyMetrics");
  });

  it("uses the official Add storey helper and does not change default L1 numbers", () => {
    const addStart = src.indexOf("function addStorey");
    const addEnd = src.indexOf("function applyRoomHeightMm");
    expect(addStart).toBeGreaterThan(-1);
    expect(addEnd).toBeGreaterThan(addStart);
    const addFn = src.slice(addStart, addEnd);
    expect(addFn).toContain("officialAppendStorey");
    expect(addFn).toContain("applyOfficialStoreyMetrics");
    expect(addFn).not.toMatch(/heightM:\s*2\.8/);
  });

  it("documents the same relationship in the user guide and tip", () => {
    expect(guide).toMatch(/Storey elevation/);
    expect(guide).toMatch(/floor-to-floor/);
    expect(guide).toMatch(/default 3\.0 m/);
    expect(guide).toMatch(/elevation \+ storey height/);
    expect(guide).toMatch(/2800/);
    expect(guide).toMatch(/0\.2 m/);
    expect(guide).toMatch(/樓層標高/);
    expect(guide).toMatch(/層高/);
    expect(tips).toContain("tool.storeyHeight");
    expect(tips).toContain("STOREY_METRICS_EXPLANATION");
  });
});
