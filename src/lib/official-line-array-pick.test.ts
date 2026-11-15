import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray } from "./arrange-array";
import { prepareFixtureArrayApply } from "./array-occupied";
import { LINE_ARRAY_PICK_HINT, LINE_ARRAY_SPACING_Y_REASON } from "./line-array-pick";

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

describe("official Line click-to-pick wiring", () => {
  it("uses the official pick helpers in TopView2D, the array panel, and the editor", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const panel = readSrc("src/components/editor/FixtureArrayPanel.tsx");
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");

    expect(top).toContain('from "@/lib/line-array-pick"');
    expect(top).toContain("applyLineEndpointPick");
    expect(top).toContain("linePickEscapeAction");
    expect(top).toContain("isLinePickInProgress");
    expect(top).toContain('linePickEscapeAction(linePick) === "pass"');
    expect(top).toContain("e.stopImmediatePropagation()");
    expect(top).toContain('addEventListener("keydown", onKey, { capture: true })');
    expect(top).toContain("onLinePickChange");
    expect(top).toContain("linePickActive");
    expect(top).toContain("toWorld");
    expect(top).toContain("e.detail === 1");
    expect(top).toContain("if (drawing || linePickActive) return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).toContain("zoomPlanToward");

    expect(panel).toContain('from "@/lib/line-array-pick"');
    expect(panel).toContain("lineStart");
    expect(panel).toContain("lineEnd");
    expect(panel).toContain("planFixtureArray");
    expect(panel).toContain("disabled={mode === \"line\"}");
    expect(panel).toContain("LINE_ARRAY_SPACING_Y_REASON");
    expect(panel).toContain('helpKey="tool.lineArray"');
    expect(panel).toContain("lineArrayDerivedSpacingM");
    expect(panel).not.toMatch(/spacingY.*mode === "line"/);

    expect(editor).toContain("EMPTY_LINE_PICK");
    expect(editor).toContain("linePick={linePick}");
    expect(editor).toContain("onLinePickChange");
    expect(editor).toContain("linePickActive");
    expect(editor).toContain("planFixtureArray(activeRoom, params)");
  });

  it("keeps Spacing Y disabled in Line mode and documents why, without inventing a second row", () => {
    expect(LINE_ARRAY_SPACING_Y_REASON).toMatch(/one line only/i);
    expect(LINE_ARRAY_SPACING_Y_REASON).toMatch(/disabled/i);
    const arrange = readSrc("src/lib/arrange-array.ts");
    expect(arrange).toContain("planLineArrayAlongSegment");
    expect(arrange).toMatch(/Spacing Y is intentionally unused/);
    const plan = planFixtureArray(testRoom(), {
      mode: "line",
      rows: 2,
      cols: 2,
      count: 3,
      spacingX: 1.5,
      spacingY: 3,
      wallOffset: 0,
      rotationDeg: 0,
      lineStart: { x: 1, y: 2 },
      lineEnd: { x: 4, y: 2 },
    });
    expect(plan.inside.every((p) => Math.abs(p.y - 2) < 1e-9)).toBe(true);
    expect(plan.inside).toHaveLength(3);
  });

  it("still skips a same-room occupied point on a picked line and does not drop the other points", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "line",
      rows: 1,
      cols: 1,
      count: 3,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
      lineStart: { x: 1, y: 1 },
      lineEnd: { x: 4, y: 1 },
    });
    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: 1, y: 1, z: 2.7 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(2);
    expect(decision.placeable[0]!.x).toBeCloseTo(2.5, 3);
    expect(decision.placeable[1]!.x).toBeCloseTo(4, 3);
  });

  it("documents click-to-pick, Esc, the numeric fallback, and disabled Spacing Y in the guide and tip", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/直線排列 \/ Line array/);
    expect(guide).toMatch(/Click two points/);
    expect(guide).toMatch(/點兩下/);
    expect(guide).toMatch(/second click completes/);
    expect(guide).toMatch(/第二次點擊完成線段/);
    expect(guide).toMatch(/later click starts a new line/);
    expect(guide).toMatch(/再點一下會開始一條新線/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels an unfinished start/);
    expect(guide).toMatch(/未完成起點時按 \*\*Esc\*\*/);
    expect(guide).toMatch(/does not exit the browser’s fullscreen/);
    expect(guide).toMatch(/不會因此退出全畫面/);
    expect(guide).toMatch(/If you do not pick endpoints/);
    expect(guide).toMatch(/若未點選端點/);
    expect(guide).toMatch(/Spacing X/);
    expect(guide).toMatch(/Spacing Y stays disabled/);
    expect(guide).toMatch(/Spacing Y 在直線模式維持停用/);
    expect(guide).toMatch(/one line only/);
    expect(guide).toMatch(/只沿一條線/);
    expect(tips).toContain('helpKey: "tool.lineArray"');
    expect(tips).toContain("LINE_ARRAY_PICK_HINT");
    expect(tips).toContain("LINE_ARRAY_SPACING_Y_REASON");
    expect(LINE_ARRAY_PICK_HINT).toMatch(/Click two points on the Top plan/);
    expect(LINE_ARRAY_SPACING_Y_REASON).toMatch(/Spacing Y stays disabled/);
  });
});
