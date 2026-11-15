import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray } from "./arrange-array";
import { prepareFixtureArrayApply } from "./array-occupied";
import {
  CIRCLE_ARRAY_PICK_HINT,
  CIRCLE_ARRAY_ROTATION_REASON,
  CIRCLE_ARRAY_UNUSED_FIELDS_REASON,
} from "./circle-array-pick";

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

describe("official Circle array wiring", () => {
  it("uses the official circle helpers in TopView2D, the array panel, and the editor", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const panel = readSrc("src/components/editor/FixtureArrayPanel.tsx");
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    const arrange = readSrc("src/lib/arrange-array.ts");

    expect(arrange).toContain('export type ArrayMode = "rect" | "line" | "circle" | "polygon"');
    expect(arrange).toContain("planCircleArray");
    expect(arrange).toMatch(/Spacing X, Spacing Y, and wall offset are intentionally unused/);
    expect(arrange).toMatch(/not aimed at the centre or along the tangent/);

    expect(top).toContain('from "@/lib/circle-array-pick"');
    expect(top).toContain("applyCircleCentrePick");
    expect(top).toContain("circlePickEscapeAction");
    expect(top).toContain('circlePickEscapeAction(circlePick) === "pass"');
    expect(top).toContain("onCirclePickChange");
    expect(top).toContain("circlePickActive");
    expect(top).toContain("toWorld");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).toContain("zoomPlanToward");

    expect(panel).toContain('from "@/lib/circle-array-pick"');
    expect(panel).toContain('["circle", "Circle", "圓形"]');
    expect(panel).toContain("circleCentre");
    expect(panel).toContain("planFixtureArray");
    expect(panel).toContain('helpKey="tool.circleArray"');
    expect(panel).toContain("CIRCLE_ARRAY_UNUSED_FIELDS_REASON");
    expect(panel).toContain("CIRCLE_ARRAY_ROTATION_REASON");
    expect(panel).toContain("CIRCLE_ARRAY_PICK_HINT");
    expect(panel).toContain('disabled={mode === "line" || mode === "circle" || mode === "polygon"}');
    expect(panel).toMatch(/Radius \(m\)/);
    expect(panel).not.toMatch(/targetEm.*circle/);
    expect(panel).not.toMatch(/previewTargetEmArrange.*circle/);

    expect(editor).toContain("EMPTY_CIRCLE_PICK");
    expect(editor).toContain("circlePick={circlePick}");
    expect(editor).toContain("onCirclePickChange");
    expect(editor).toContain("circlePickActive");
    expect(editor).toContain("planFixtureArray(activeRoom, params)");
  });

  it("keeps Spacing X/Y and wall offset disabled in Circle mode, without a second ring or target-Ēm circle path", () => {
    expect(CIRCLE_ARRAY_UNUSED_FIELDS_REASON).toMatch(/one circle/i);
    expect(CIRCLE_ARRAY_UNUSED_FIELDS_REASON).toMatch(/disabled/i);
    expect(CIRCLE_ARRAY_ROTATION_REASON).toMatch(/fixture orientation/i);
    expect(CIRCLE_ARRAY_ROTATION_REASON).toMatch(/not aimed at the centre/i);
    const arrangeByEm = readSrc("src/lib/arrange-by-em.ts");
    expect(arrangeByEm).toContain('mode: "rect"');
    expect(arrangeByEm).not.toContain('mode: "circle"');
    const plan = planFixtureArray(testRoom(), {
      mode: "circle",
      rows: 2,
      cols: 2,
      count: 4,
      spacingX: 3,
      spacingY: 3,
      wallOffset: 2,
      rotationDeg: 0,
      radius: 1,
    });
    expect(plan.inside).toHaveLength(4);
    expect(plan.inside.every((p) => p.rotationDeg === 0)).toBe(true);
  });

  it("still skips a same-room occupied point on a circle and does not drop the other points", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "circle",
      rows: 1,
      cols: 1,
      count: 4,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
      radius: 1,
    });
    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: 3.5, y: 2, z: 2.7 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(3);
    expect(decision.placeable.some((p) => Math.abs(p.x - 3.5) < 1e-9 && Math.abs(p.y - 2) < 1e-9)).toBe(
      false
    );
  });

  it("documents centre pick, Esc, radius, rotation, and disabled spacing fields in the guide and tip", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/圓形排列 \/ Circular array/);
    expect(guide).toMatch(/Click once on the \*\*Top\*\* or \*\*Bottom\*\* plan to set the circle centre/);
    expect(guide).toMatch(/在 \*\*Top\*\* 或 \*\*Bottom\*\* 平面圖上點一下，設定圓心/);
    expect(guide).toMatch(/later click replaces the centre/);
    expect(guide).toMatch(/再點一下會改設圓心/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels an unwanted centre pick/);
    expect(guide).toMatch(/按 \*\*Esc\*\* 會取消已選圓心/);
    expect(guide).toMatch(/does not exit the browser’s fullscreen/);
    expect(guide).toMatch(/不會因此退出全畫面/);
    expect(guide).toMatch(/If you do not pick a centre/);
    expect(guide).toMatch(/若未點選圓心/);
    expect(guide).toMatch(/room centre/);
    expect(guide).toMatch(/房間中心/);
    expect(guide).toMatch(/Radius/);
    expect(guide).toMatch(/半徑/);
    expect(guide).toMatch(/fixture orientation/);
    expect(guide).toMatch(/燈具朝向/);
    expect(guide).toMatch(/not aimed at the centre/);
    expect(guide).toMatch(/不會自動指向圓心/);
    expect(guide).toMatch(/Spacing X, Spacing Y and wall offset stay disabled/);
    expect(guide).toMatch(/Spacing X、Spacing Y 與離牆在圓形模式維持停用/);
    expect(tips).toContain('helpKey: "tool.circleArray"');
    expect(tips).toContain("CIRCLE_ARRAY_PICK_HINT");
    expect(tips).toContain("CIRCLE_ARRAY_UNUSED_FIELDS_REASON");
    expect(tips).toContain("CIRCLE_ARRAY_ROTATION_REASON");
    expect(CIRCLE_ARRAY_PICK_HINT).toMatch(/Click once on the Top plan/);
    expect(CIRCLE_ARRAY_UNUSED_FIELDS_REASON).toMatch(/stay disabled/);
  });
});
