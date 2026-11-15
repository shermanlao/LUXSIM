import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rectPolygon, type RoomV2 } from "@luxsim/project-io";
import { planFixtureArray } from "./arrange-array";
import { prepareFixtureArrayApply } from "./array-occupied";
import {
  POLYGON_ARRAY_HINT,
  POLYGON_ARRAY_ROTATION_REASON,
  POLYGON_ARRAY_UNUSED_FIELDS_REASON,
} from "./polygon-array";

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

describe("official Polygon array wiring", () => {
  it("uses the official polygon helpers in the array panel and the editor", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const panel = readSrc("src/components/editor/FixtureArrayPanel.tsx");
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    const arrange = readSrc("src/lib/arrange-array.ts");

    expect(arrange).toContain('export type ArrayMode = "rect" | "line" | "circle" | "polygon"');
    expect(arrange).toContain("planPolygonArray");
    expect(arrange).toMatch(/Spacing X, Spacing Y, and wall offset are intentionally unused/);
    expect(arrange).toMatch(/not aimed along the tangent or inward/);
    expect(arrange).toMatch(/pointOnClosedPolygonOutline/);
    expect(arrange).toMatch(/official outline points stay valid/);

    expect(panel).toContain('from "@/lib/polygon-array"');
    expect(panel).toContain('["polygon", "Polygon", "多邊形"]');
    expect(panel).toContain("planFixtureArray");
    expect(panel).toContain('helpKey="tool.polygonArray"');
    expect(panel).toContain("POLYGON_ARRAY_UNUSED_FIELDS_REASON");
    expect(panel).toContain("POLYGON_ARRAY_ROTATION_REASON");
    expect(panel).toContain("POLYGON_ARRAY_HINT");
    expect(panel).toContain(
      'disabled={mode === "line" || mode === "circle" || mode === "polygon"}'
    );
    expect(panel).not.toMatch(/targetEm.*polygon/);
    expect(panel).not.toMatch(/previewTargetEmArrange.*polygon/);

    expect(editor).toContain("planFixtureArray(activeRoom, params)");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive || polygonPickActive) return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).toContain("zoomPlanToward");
  });

  it("keeps Spacing X/Y and wall offset disabled in Polygon mode, without an inset, second ring, or target-Ēm polygon path", () => {
    expect(POLYGON_ARRAY_UNUSED_FIELDS_REASON).toMatch(/room outline/i);
    expect(POLYGON_ARRAY_UNUSED_FIELDS_REASON).toMatch(/disabled/i);
    expect(POLYGON_ARRAY_ROTATION_REASON).toMatch(/fixture orientation/i);
    expect(POLYGON_ARRAY_ROTATION_REASON).toMatch(/not aimed along the tangent or inward/i);
    expect(POLYGON_ARRAY_HINT).toMatch(/first corner/);
    const arrangeByEm = readSrc("src/lib/arrange-by-em.ts");
    expect(arrangeByEm).toContain('mode: "rect"');
    expect(arrangeByEm).not.toContain('mode: "polygon"');
    const plan = planFixtureArray(testRoom(), {
      mode: "polygon",
      rows: 2,
      cols: 2,
      count: 4,
      spacingX: 3,
      spacingY: 3,
      wallOffset: 2,
      rotationDeg: 0,
    });
    expect(plan.inside).toHaveLength(4);
    expect(plan.inside.every((p) => p.rotationDeg === 0)).toBe(true);
  });

  it("still skips a same-room occupied point on the outline and does not drop the other points", () => {
    const room = testRoom();
    const plan = planFixtureArray(room, {
      mode: "polygon",
      rows: 1,
      cols: 1,
      count: 4,
      spacingX: 1.5,
      spacingY: 1.5,
      wallOffset: 0,
      rotationDeg: 0,
    });
    const decision = prepareFixtureArrayApply(
      plan,
      [{ roomId: room.id, position: { x: 0, y: 0, z: 2.7 } }],
      room.id
    );
    expect(decision.skippedOccupied).toHaveLength(1);
    expect(decision.placeable).toHaveLength(3);
    expect(decision.placeable.some((p) => Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9)).toBe(
      false
    );
  });

  it("documents room-outline placement, rotation, and disabled spacing fields in the guide and tip", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/多邊形排列 \/ Polygon array/);
    expect(guide).toMatch(/choose \*\*Polygon\*\* in \*\*Arrange\*/);
    expect(guide).toMatch(/再開右側 \*\*Arrange\*\* 的 \*\*Polygon\*\*（多邊形）/);
    expect(guide).toMatch(/official closed outline/);
    expect(guide).toMatch(/官方封閉輪廓/);
    expect(guide).toMatch(/first corner \(Origin\)/);
    expect(guide).toMatch(/第一個角點（Origin）/);
    expect(guide).toMatch(/do not coincide on the closing vertex/);
    expect(guide).toMatch(/不會重疊在閉合頂點上/);
    expect(guide).toMatch(/fixture orientation/);
    expect(guide).toMatch(/燈具朝向/);
    expect(guide).toMatch(/not aimed along the tangent or inward/);
    expect(guide).toMatch(/不會自動沿切線或指向室內/);
    expect(guide).toMatch(/Spacing X, Spacing Y and wall offset stay disabled/);
    expect(guide).toMatch(/Spacing X、Spacing Y 與離牆在多邊形模式維持停用/);
    expect(guide).toMatch(/If you do not pick a custom path/);
    expect(guide).toMatch(/若未點選自訂路徑/);
    expect(tips).toContain('helpKey: "tool.polygonArray"');
    expect(tips).toContain("POLYGON_ARRAY_HINT");
    expect(tips).toContain("POLYGON_ARRAY_UNUSED_FIELDS_REASON");
    expect(tips).toContain("POLYGON_ARRAY_ROTATION_REASON");
    expect(POLYGON_ARRAY_HINT).toMatch(/closed outline/);
    expect(POLYGON_ARRAY_UNUSED_FIELDS_REASON).toMatch(/stay disabled/);
  });
});
