import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("official room drag wiring", () => {
  it("wires officialTranslateRoom through BuildingEditor undo-coalesced moveRoom", () => {
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("officialTranslateRoom");
    expect(editor).toContain("function moveRoom(");
    expect(editor).toContain('beginCoalesce("drag")');
    expect(editor).toContain("officialTranslateRoom(s, roomId, dx, dy)");
    expect(editor).toContain("onMoveRoom={(roomId, dx, dy) => moveRoom(roomId, dx, dy)}");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(tips).toMatch(/Rooms and storeys are not translated by dragging the fill/);
    expect(tips).toMatch(/mid-edge handle/);
  });

  it("starts a room drag only in Select mode, and fixture hits still move the fixture", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    expect(top).toContain('from "@/lib/room-drag"');
    expect(top).toContain("shouldBeginRoomDrag");
    expect(top).toContain("applyRoomDrag");
    expect(top).toContain("tool: scene.ui.tool");
    expect(top).toContain("linePickActive");
    expect(top).toContain("circlePickActive");
    expect(top).toContain("calibrating:");
    expect(top).toContain("beginRoomDrag");
    expect(top).toContain("addEventListener(\"mousemove\", move)");
    expect(top).toContain("addEventListener(\"mouseup\", up)");
    expect(top).toContain("onMoveRoom");
    expect(top).toContain("if (drawing || scene.ui.tool === \"calibrate\") return;");
    expect(top).toContain("if (linePickActive && onLinePickChange)");
    // Fixture path still stops bubbling and starts instance move, not room drag.
    const fixtureDown = top.slice(top.indexOf("{instances.map((inst) => {"));
    expect(fixtureDown).toContain("e.stopPropagation()");
    expect(fixtureDown).toContain("beginMove(inst.instanceId");
    expect(fixtureDown).not.toContain("shouldBeginRoomDrag");
    expect(fixtureDown).not.toContain("beginRoomDrag");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    expect(top).toContain("usePlanPointerNav");
    expect(top).not.toContain("click-drag pan");
    expect(top).not.toContain("startVertex");
  });

  it("documents that rooms are not dragged as a whole, while corner handles still work", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const roomDraw = readSrc("docs/ROOM_DRAW.md");
    const workflow = readSrc("docs/EDITOR_WORKFLOW.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/Rooms cannot be dragged as a whole/);
    expect(guide).toMatch(/不能整間拖移/);
    expect(guide).toMatch(/corner handle/);
    expect(guide).toMatch(/角點控制點/);
    expect(guide).toMatch(/middle mouse button/);
    expect(guide).toMatch(/滑鼠中鍵/);
    expect(roomDraw).toMatch(/not translated by dragging the fill/);
    expect(workflow).toMatch(/not translated by dragging the room fill/);
    expect(tips).toContain('helpKey: "tool.drawRect"');
    expect(tips).toMatch(/Select \/ move/);
    expect(tips).toMatch(/not translated by dragging the fill/);
  });
});
