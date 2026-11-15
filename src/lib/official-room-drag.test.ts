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
    expect(editor).not.toMatch(/Rooms cannot be dragged/);
    expect(editor).toMatch(/drag the room with Select/i);
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
    expect(top).toContain("wheelZoomFactor");
    expect(top).not.toContain("click-drag pan");
    expect(top).not.toContain("startVertex");
  });

  it("documents how to drag a room and no longer says rooms cannot be moved", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const roomDraw = readSrc("docs/ROOM_DRAW.md");
    const workflow = readSrc("docs/EDITOR_WORKFLOW.md");
    const autosave = readSrc("docs/AUTOSAVE.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    for (const text of [guide, roomDraw, workflow, autosave, tips]) {
      expect(text).not.toMatch(/cannot be dragged/i);
      expect(text).not.toMatch(/can be selected but not dragged/i);
      expect(text).not.toMatch(/不能拖移/);
    }
    expect(guide).toMatch(/Select/);
    expect(guide).toMatch(/拖移已有房間|拖移房間/);
    expect(guide).toMatch(/Fixtures that belong to that room move with it/i);
    expect(guide).toMatch(/該房內的燈具會一併移動/);
    expect(guide).toMatch(/without changing its shape/i);
    expect(guide).toMatch(/形狀不變/);
    expect(roomDraw).toMatch(/Select/);
    expect(tips).toContain('helpKey: "tool.drawRect"');
    expect(tips).toMatch(/Select \/ move/);
  });
});
