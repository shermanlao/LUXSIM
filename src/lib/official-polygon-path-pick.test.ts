import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray, pointsRoughlyEqual } from "./arrange-array";
import { prepareFixtureArrayApply } from "./array-occupied";
import {
  POLYGON_ARRAY_HINT,
  POLYGON_ARRAY_ROTATION_REASON,
  POLYGON_ARRAY_UNUSED_FIELDS_REASON,
} from "./polygon-array";
import {
  applyPolygonPathVertexPick,
  cancelPolygonPathPick,
  EMPTY_POLYGON_PATH_PICK,
  finishOpenPolygonPath,
  isPolygonPathInProgress,
  POLYGON_ARRAY_PICK_HINT,
  POLYGON_PATH_CLOSE_SNAP_CSS_PX,
} from "./polygon-array-pick";

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function testRoom(): RoomV2 {
  return {
    id: "room_a",
    storeyId: "gf",
    name: "Office",
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

function params(over: Partial<Parameters<typeof planFixtureArray>[1]> = {}) {
  return {
    mode: "polygon" as const,
    rows: 1,
    cols: 1,
    count: 3,
    spacingX: 9,
    spacingY: 9,
    wallOffset: 2,
    rotationDeg: 15,
    ...over,
  };
}

const SNAP = { closeSnapM: 0.1 };

describe("official Polygon custom-path pick wiring", () => {
  it("uses the official path-pick helpers in TopView2D, the array panel, and the editor", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const panel = readSrc("src/components/editor/FixtureArrayPanel.tsx");
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    const arrange = readSrc("src/lib/arrange-array.ts");
    const roomDrag = readSrc("src/lib/room-drag.ts");
    const storeyDrag = readSrc("src/lib/storey-drag.ts");

    expect(arrange).toContain("polygonPath");
    expect(arrange).toContain("polygonPathClosed");
    expect(arrange).toContain("planOpenPathArray");
    expect(arrange).toContain("planClosedPathArray");

    expect(top).toContain('from "@/lib/polygon-array-pick"');
    expect(top).toContain("applyPolygonPathVertexPick");
    expect(top).toContain("finishOpenPolygonPath");
    expect(top).toContain("polygonPathEscapeAction");
    expect(top).toContain("polygonPathEnterAction");
    expect(top).toContain('polygonPathEscapeAction(current) === "pass"');
    expect(top).toContain("e.stopImmediatePropagation()");
    expect(top).toContain('addEventListener("keydown", onKey, { capture: true })');
    expect(top).toContain("onPolygonPickChange");
    expect(top).toContain("polygonPickActive");
    expect(top).toContain("toWorld");
    expect(top).toContain("e.detail === 1");
    expect(top).toContain(
      "if (drawing || linePickActive || circlePickActive || polygonPickActive) return;"
    );
    expect(top).toContain("usePlanPointerNav");
    expect(top).toContain("polygonPathCloseSnapM");
    expect(POLYGON_PATH_CLOSE_SNAP_CSS_PX).toBe(4);

    expect(panel).toContain('from "@/lib/polygon-array-pick"');
    expect(panel).toContain("polygonPath");
    expect(panel).toContain("polygonPathClosed");
    expect(panel).toContain("planFixtureArray");
    expect(panel).toContain('helpKey="tool.polygonArray"');
    expect(panel).toContain("POLYGON_ARRAY_UNUSED_FIELDS_REASON");
    expect(panel).toContain("POLYGON_ARRAY_ROTATION_REASON");
    expect(panel).toContain("POLYGON_ARRAY_HINT");
    expect(panel).toContain("Clear path / 清除路徑");
    expect(panel).toContain(
      'disabled={mode === "line" || mode === "circle" || mode === "polygon"}'
    );

    expect(editor).toContain("EMPTY_POLYGON_PATH_PICK");
    expect(editor).toContain("polygonPick={polygonPick}");
    expect(editor).toContain("onPolygonPickChange");
    expect(editor).toContain("polygonPickActive");
    expect(editor).toContain("planFixtureArray(activeRoom, params)");

    expect(roomDrag).toContain("polygonPickActive");
    expect(storeyDrag).toContain("polygonPickActive");
    expect(top).toContain("if (polygonPickActive && onPolygonPickChange)");
    // Mid-pick still blocks zoom-reset the same way line / circle already do.
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    const fixtureDown = top.slice(top.indexOf("{instances.map((inst) => {"));
    expect(fixtureDown).toContain("if (polygonPickActive && onPolygonPickChange)");
    expect(fixtureDown).not.toContain("shouldBeginRoomDrag");
    expect(fixtureDown).not.toContain("beginRoomDrag");
    expect(fixtureDown).not.toContain("shouldBeginStoreyDrag");
  });

  it("spaces an open path from start to end, a closed path by perimeter/Count, and Count = 1 at the first vertex", () => {
    const room = testRoom();
    const open = planFixtureArray(room, params({
      count: 3,
      polygonPath: [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
      ],
      polygonPathClosed: false,
    }));
    expect(open.inside).toHaveLength(3);
    expect(pointsRoughlyEqual(open.inside[0]!, { x: 1, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(open.inside[1]!, { x: 3, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(open.inside[2]!, { x: 3, y: 3 })).toBe(true);
    expect(open.inside.every((pt) => pt.rotationDeg === 15)).toBe(true);

    const openOne = planFixtureArray(room, params({
      count: 1,
      polygonPath: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
      ],
      polygonPathClosed: false,
    }));
    expect(openOne.inside).toHaveLength(1);
    expect(pointsRoughlyEqual(openOne.inside[0]!, { x: 1, y: 1 })).toBe(true);

    const closed = planFixtureArray(room, params({
      count: 4,
      polygonPath: [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
      ],
      polygonPathClosed: true,
    }));
    // Closed 2×2 m square, perimeter 8 m, spacing 2 m. Last point is not the start.
    expect(closed.inside).toHaveLength(4);
    expect(pointsRoughlyEqual(closed.inside[0]!, { x: 1, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(closed.inside[1]!, { x: 3, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(closed.inside[2]!, { x: 3, y: 3 })).toBe(true);
    expect(pointsRoughlyEqual(closed.inside[3]!, { x: 1, y: 3 })).toBe(true);
    expect(pointsRoughlyEqual(closed.inside[0]!, closed.inside[3]!)).toBe(false);

    const closedOne = planFixtureArray(room, params({
      count: 1,
      polygonPath: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
      polygonPathClosed: true,
    }));
    expect(closedOne.inside).toHaveLength(1);
    expect(pointsRoughlyEqual(closedOne.inside[0]!, { x: 2, y: 1 })).toBe(true);
  });

  it("returns to the room-outline fallback after Esc or Clear, and still matches official outline placement", () => {
    const room = testRoom();
    const mid = applyPolygonPathVertexPick(
      applyPolygonPathVertexPick(EMPTY_POLYGON_PATH_PICK, { x: 1, y: 1 }, SNAP),
      { x: 2, y: 2 },
      SNAP
    );
    expect(isPolygonPathInProgress(mid)).toBe(true);
    expect(cancelPolygonPathPick()).toEqual(EMPTY_POLYGON_PATH_PICK);
    expect(finishOpenPolygonPath(mid).finished).toBe(true);
    expect(cancelPolygonPathPick()).toEqual(EMPTY_POLYGON_PATH_PICK);

    const fallback = planFixtureArray(room, params({ count: 4, polygonPath: null }));
    expect(fallback.inside).toHaveLength(4);
    expect(pointsRoughlyEqual(fallback.inside[0]!, { x: 0, y: 0 })).toBe(true);
    expect(pointsRoughlyEqual(fallback.inside[1]!, { x: 4.5, y: 0 })).toBe(true);
    expect(pointsRoughlyEqual(fallback.inside[2]!, { x: 5, y: 4 })).toBe(true);
    expect(pointsRoughlyEqual(fallback.inside[3]!, { x: 0.5, y: 4 })).toBe(true);
    expect(pointsRoughlyEqual(fallback.inside[0]!, fallback.inside[3]!)).toBe(false);
  });

  it("skips an occupied point on a custom path and drops planned points outside the room", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, params({
      count: 3,
      rotationDeg: 0,
      polygonPath: [
        { x: 1, y: 1 },
        { x: 7, y: 1 },
      ],
      polygonPathClosed: false,
    }));
    // Equally spaced (1,1), (4,1), (7,1); the last point is outside the 5×4 m room.
    expect(plan.proposed).toHaveLength(3);
    expect(plan.inside).toHaveLength(2);
    expect(plan.skippedOutside).toBe(1);
    expect(pointsRoughlyEqual(plan.inside[0]!, { x: 1, y: 1 })).toBe(true);
    expect(pointsRoughlyEqual(plan.inside[1]!, { x: 4, y: 1 })).toBe(true);

    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: 1, y: 1, z: 2.7 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(1);
    expect(pointsRoughlyEqual(decision.placeable[0]!, { x: 4, y: 1 })).toBe(true);
  });

  it("documents custom-path pick, Esc / Clear fallback, and open versus closed spacing", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    const gap = readSrc("docs/DIALUX_GAP.md");
    expect(guide).toMatch(/click on the \*\*Top\*\* plan to add path vertices/i);
    expect(guide).toMatch(/可在 \*\*Top\*\* 平面圖上逐點點選自訂路徑/);
    expect(guide).toMatch(/later click starts a new path/);
    expect(guide).toMatch(/再點一下會開始一條新路徑/);
    expect(guide).toMatch(/\*\*Enter\*\* or a double-click on empty background finishes an open path/);
    expect(guide).toMatch(/按 \*\*Enter\*\* 或在空白處雙擊，可完成一條開放路徑/);
    expect(guide).toMatch(/4 CSS pixels/);
    expect(guide).toMatch(/4 CSS 像素/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels an unfinished path/);
    expect(guide).toMatch(/未完成路徑時按 \*\*Esc\*\*/);
    expect(guide).toMatch(/does not exit the browser’s fullscreen/);
    expect(guide).toMatch(/不會因此退出全畫面/);
    expect(guide).toMatch(/\*\*Clear path\*\*/);
    expect(guide).toMatch(/Clear path/);
    expect(guide).toMatch(/room-outline fallback/);
    expect(guide).toMatch(/房間輪廓後備/);
    expect(guide).toMatch(/If you do not pick a custom path/);
    expect(guide).toMatch(/若未點選自訂路徑/);
    expect(guide).toMatch(/including the endpoints/);
    expect(guide).toMatch(/包含兩端/);
    expect(guide).toMatch(/sits at the start/);
    expect(guide).toMatch(/放在起點/);
    expect(guide).toMatch(/Custom-path vertices may lie inside the room/);
    expect(guide).toMatch(/自訂路徑的頂點可以在房間內/);
    expect(tips).toContain('helpKey: "tool.polygonArray"');
    expect(tips).toContain("POLYGON_ARRAY_HINT");
    expect(POLYGON_ARRAY_PICK_HINT).toMatch(/Click near the first vertex/);
    expect(POLYGON_ARRAY_HINT).toBe(POLYGON_ARRAY_PICK_HINT);
    expect(POLYGON_ARRAY_UNUSED_FIELDS_REASON).toMatch(/custom path/);
    expect(POLYGON_ARRAY_ROTATION_REASON).toMatch(/not aimed along the tangent or inward/);
    expect(gap).toMatch(/optional custom path/);
  });
});
