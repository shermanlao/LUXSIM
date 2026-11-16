import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GREYSCALE_SRGB_MIN,
  OFFICIAL_FALSE_COLOR_SCALE,
  luxToRgb,
  luxToRgbLinear,
  type ResultsV2,
  type RoomV2,
} from "@luxsim/project-io";
import { officialFalseColorWorkplaneHeight, workplaneDisplayHeightM } from "./scene-3d-model";
import { isoluxWorkplaneHeightM } from "./scene-3d-isolux";
import {
  isolateRoomIdAfterFixtureSelect,
  next3dFixtureSelection,
  shouldClear3dFixtureSelection,
} from "./scene-3d-selection";
import {
  OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M,
  officialIlluminanceFieldHeightM,
  officialIlluminanceFloorHeightM,
  showWorkplaneFromUi,
} from "./workplane-display";
import { officialPlanIsoluxModelKey, officialPlanIsoluxModels } from "./plan-falsecolor-layer";
import { ROOM_TRANSLATE_ENABLED } from "./room-drag";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function room(partial?: Partial<RoomV2>): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: false, bounces: 0, computeUgr: false },
    ...partial,
  };
}

describe("official greyscale scale bar", () => {
  it("keeps 72 lx visible in greyscale after linear conversion and leaves the false-colour ramp alone", () => {
    const linear72 = luxToRgbLinear(72, OFFICIAL_FALSE_COLOR_SCALE, "greyscale")[0];
    expect(linear72).toBeGreaterThan(0.12);
    expect(luxToRgbLinear(0, OFFICIAL_FALSE_COLOR_SCALE, "greyscale")[0]).toBeGreaterThanOrEqual(
      0.12
    );
    expect(GREYSCALE_SRGB_MIN).toBeGreaterThan(0.3);
    expect(luxToRgb(72, OFFICIAL_FALSE_COLOR_SCALE, "falsecolor")).toEqual(luxToRgb(72));
  });

  it("shows the same interactive scale bar in greyscale with a grey title and gradient", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    const legend = read("src/components/editor/FalseColorLegend.tsx");
    expect(editor).toContain('display3d === "falsecolor" || display3d === "greyscale"');
    expect(editor).toContain('palette={viewMode === "persp3d" && display3d === "greyscale" ? "greyscale" : "falsecolor"}');
    expect(legend).toContain('palette === "greyscale" ? "Greyscale scale" : "False-colour scale"');
    expect(legend).toContain("legendStopsForScale(current, palette)");
    expect(legend).toContain("onReset");
    expect(legend).toContain("Minimum lux");
    expect(legend).toContain("Maximum lux");
    expect(legend).toContain("Reset");
  });
});

describe("official 3D workplane display", () => {
  it("moves the displayed plane with room.workplaneHeightM and stays shown by default", () => {
    const r = room({ workplaneHeightM: 0.75 });
    const results = { grid: { z: 1.4 } } as Parameters<typeof officialFalseColorWorkplaneHeight>[1];
    expect(officialFalseColorWorkplaneHeight(r, results, 0)).toBe(0.77);
    expect(workplaneDisplayHeightM({ ...r, workplaneHeightM: 1.2 }, 3)).toBe(3 + 1.2 + 0.02);
    expect(isoluxWorkplaneHeightM({ ...r, workplaneHeightM: 1.2 }, { grid: { z: 0.4 } } as never, 3)).toBe(
      3 + 1.2 + 0.02
    );
    expect(showWorkplaneFromUi(undefined)).toBe(true);
    expect(showWorkplaneFromUi({})).toBe(true);
    expect(showWorkplaneFromUi({ showWorkplane: false })).toBe(false);

    const scene = read("src/components/editor/BuildingScene3D.tsx");
    expect(scene).toContain("showWorkplane");
    expect(scene).toContain("createWorkplanePlateGeometry");
    expect(scene).toContain("FalseColorPlane");
    expect(scene).toContain("createFloorGeometry");
    expect(scene).toContain("createWallGeometry");
    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("data-show-workplane");
    expect(editor).toContain("onShowWorkplaneChange");
  });

  it("keeps the 3D illuminance field, isolines, and labels visible on the floor when the workplane is hidden", () => {
    const r = room({ workplaneHeightM: 0.75 });
    const results = { grid: { z: 1.4 } } as Parameters<typeof officialFalseColorWorkplaneHeight>[1];
    const elev = 3;
    expect(OFFICIAL_ILLUMINANCE_DISPLAY_LIFT_M).toBe(0.02);
    expect(officialIlluminanceFloorHeightM(elev)).toBe(elev + 0.02);
    expect(officialIlluminanceFieldHeightM(r, elev, true)).toBe(elev + 0.75 + 0.02);
    expect(officialIlluminanceFieldHeightM(r, elev, false)).toBe(elev + 0.02);
    expect(officialFalseColorWorkplaneHeight(r, results, elev, true)).toBe(elev + 0.75 + 0.02);
    expect(officialFalseColorWorkplaneHeight(r, results, elev, false)).toBe(elev + 0.02);
    expect(isoluxWorkplaneHeightM({ ...r, workplaneHeightM: 1.2 }, { grid: { z: 0.4 } } as never, elev, true)).toBe(
      elev + 1.2 + 0.02
    );
    expect(isoluxWorkplaneHeightM({ ...r, workplaneHeightM: 1.2 }, { grid: { z: 0.4 } } as never, elev, false)).toBe(
      elev + 0.02
    );
    // Floor mesh is at elevationM + 0.002; the field lift must stay above it.
    expect(officialIlluminanceFloorHeightM(elev)).toBeGreaterThan(elev + 0.002);

    const scene = read("src/components/editor/BuildingScene3D.tsx");
    expect(scene).not.toMatch(/showWorkplane && res && \(/);
    expect(scene).toMatch(/showWorkplane=\{showWorkplane\}/);
    expect(scene).toContain("createWorkplanePlateGeometry");
    expect(scene).toMatch(/showWorkplane && !\(results && results\.byRoomId\[room\.id\]\)/);
    const plane = read("src/components/editor/FalseColorPlane.tsx");
    expect(plane).toContain("showWorkplane");
    expect(plane).toContain("createOfficialFalseColorWorkplane(room, results, elevationM, scale, palette, showWorkplane)");
    const overlay = read("src/components/editor/Scene3dIsoluxOverlay.tsx");
    expect(overlay).toContain("showWorkplane");
    expect(overlay).toContain("official3dIsoluxOverlaysForRooms(rooms, results, elevationM, scene.instances, {");
  });
});

describe("official 3D fixture selection", () => {
  it("selects a fixture, toggles on re-click, and does not clear on room, background, or orbit", () => {
    expect(next3dFixtureSelection(null, "f1")).toBe("f1");
    expect(next3dFixtureSelection("f1", "f2")).toBe("f2");
    expect(next3dFixtureSelection("f1", "f1")).toBeNull();
    expect(shouldClear3dFixtureSelection("room")).toBe(false);
    expect(shouldClear3dFixtureSelection("background")).toBe(false);
    expect(shouldClear3dFixtureSelection("orbit")).toBe(false);
    expect(shouldClear3dFixtureSelection("empty")).toBe(false);
    expect(isolateRoomIdAfterFixtureSelect("room-a")).toBe("room-a");

    const scene = read("src/components/editor/BuildingScene3D.tsx");
    expect(scene).toContain("next3dFixtureSelection(selectedId, lum.instanceId)");
    expect(scene).not.toMatch(/onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*onSelect\(null\);/);
    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("{!selected && activeRoom ? (");
    expect(editor).toContain("data-fixture-properties");
    expect(scene).toContain("isolateId = scene.ui.activeRoomId");
  });
});

describe("official editor removes Bottom view", () => {
  it("drops the Bottom tab from the editor and keeps a capture/plan variant hook", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).not.toMatch(/mode: "bottom", label: "Bottom"/);
    expect(editor).toContain('scene.ui.viewMode === "bottom" ? "top"');
    expect(editor).toContain('viewMode: "top"');
    const top = read("src/components/editor/TopView2D.tsx");
    expect(top).toContain('variant?: "top" | "bottom"');
    const guide = read("docs/USER_GUIDE.md");
    expect(guide).toMatch(/There is no Bottom view button/);
    expect(guide).toMatch(/沒有 Bottom 視圖按鈕/);
    const svg = read("public/docs/guide/plan-view-controls.svg");
    expect(svg).not.toMatch(/>Bottom</);
    expect(svg).toMatch(/>Top</);
  });
});

describe("official Top false-colour lag guards", () => {
  it("does not include the live view or cursor in the isolux model key", () => {
    const results: ResultsV2 = { version: 2, byRoomId: {} };
    const a = officialPlanIsoluxModelKey({
      roomIds: ["r1"],
      results,
      showFalseColor: true,
      colorScale: { minLux: 0, maxLux: 2500 },
    });
    const b = officialPlanIsoluxModelKey({
      roomIds: ["r1"],
      results,
      showFalseColor: true,
      colorScale: { minLux: 0, maxLux: 2500 },
    });
    expect(a).toBe(b);
    expect(a).not.toMatch(/cursor|viewOx|viewOy|pointer/i);
    expect(officialPlanIsoluxModels({ rooms: [], results })).toEqual([]);

    const overlay = read("src/components/editor/PlanIsoluxOverlay.tsx");
    expect(overlay).toContain("officialPlanIsoluxModels");
    expect(overlay).toContain("data-plan-falsecolor-image");
    expect(overlay).not.toContain("useLayoutEffect");
    const top = read("src/components/editor/TopView2D.tsx");
    expect(top).toContain("liveViewRef");
    expect(top).toContain("usePlanPointerNav");
    expect(top).toContain("if (!snapNeeded)");
    expect(top).toContain("PLAN_PAN_BUTTON");
    expect(ROOM_TRANSLATE_ENABLED).toBe(false);
  });
});
