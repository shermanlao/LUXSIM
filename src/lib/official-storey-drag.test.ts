import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("official storey drag wiring", () => {
  it("wires officialTranslateStorey through BuildingEditor undo-coalesced moveStorey", () => {
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("officialTranslateStorey");
    expect(editor).toContain("function moveStorey(");
    expect(editor).toContain('beginCoalesce("drag")');
    expect(editor).toContain("officialTranslateStorey(s, storeyId, dx, dy)");
    expect(editor).toContain("onMoveStorey={(storeyId, dx, dy) => moveStorey(storeyId, dx, dy)}");
    expect(editor).toMatch(/If the storey is selected in Building, dragging a room fill moves every room on that storey/);
  });

  it("starts a storey drag only when the storey is selected, and defers room select until a click", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    expect(top).toContain('from "@/lib/storey-drag"');
    expect(top).toContain("shouldBeginStoreyDrag");
    expect(top).toContain("applyStoreyDrag");
    expect(top).toContain("isStoreyDragClick");
    expect(top).toContain("beginStoreyDrag");
    expect(top).toContain("activeRoomId: scene.ui.activeRoomId");
    expect(top).toContain("activeStoreyId: scene.ui.activeStoreyId");
    expect(top).toContain("hitRoomStoreyId: room.storeyId");
    expect(top).toContain("if (wasClick) onSelectRoom?.(hitRoomId)");
    // Storey drag is attempted before selecting the room; a click still selects.
    const roomDown = top.slice(top.indexOf("onMouseDown={(e) => {"), top.indexOf("{instances.map((inst) => {"));
    const storeyIdx = roomDown.indexOf("shouldBeginStoreyDrag");
    const selectIdx = roomDown.lastIndexOf("onSelectRoom?.(room.id)");
    expect(storeyIdx).toBeGreaterThan(0);
    expect(selectIdx).toBeGreaterThan(storeyIdx);
    expect(top).toContain("addEventListener(\"mousemove\", move)");
    expect(top).toContain("addEventListener(\"mouseup\", up)");
    expect(top).toContain("if (drawing || scene.ui.tool === \"calibrate\") return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).not.toContain("click-drag pan");
    expect(top).not.toContain("startVertex");
  });

  it("lets a fixture hit move the fixture, not the storey", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    const fixtureDown = top.slice(top.indexOf("{instances.map((inst) => {"));
    expect(fixtureDown).toContain("e.stopPropagation()");
    expect(fixtureDown).toContain("beginMove(inst.instanceId");
    expect(fixtureDown).not.toContain("shouldBeginStoreyDrag");
    expect(fixtureDown).not.toContain("beginStoreyDrag");
    expect(fixtureDown).not.toContain("shouldBeginRoomDrag");
    expect(fixtureDown).not.toContain("beginRoomDrag");
  });

  it("documents how to drag a whole storey without claiming only a single room can move", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const roomDraw = readSrc("docs/ROOM_DRAW.md");
    const workflow = readSrc("docs/EDITOR_WORKFLOW.md");
    const autosave = readSrc("docs/AUTOSAVE.md");
    const gap = readSrc("docs/DIALUX_GAP.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    for (const text of [guide, roomDraw, workflow, autosave, gap, tips]) {
      expect(text).not.toMatch(/cannot be dragged/i);
      expect(text).not.toMatch(/can be selected but not dragged/i);
      expect(text).not.toMatch(/不能拖移/);
      expect(text).not.toMatch(/Rooms are selectable, not draggable/);
    }
    expect(guide).toMatch(/select the storey in \*\*Building\*\*|tree selection is a storey/i);
    expect(guide).toMatch(/every room on that storey/i);
    expect(guide).toMatch(/該層所有房間/);
    expect(guide).toMatch(/A click without movement on a room still selects that room/i);
    expect(guide).toMatch(/點一下房間而未拖移，仍會改為選取該房間/);
    expect(guide).toMatch(/Rooms on other storeys do not move/i);
    expect(guide).toMatch(/其他樓層不會移動/);
    expect(roomDraw).toMatch(/storey is selected in Building|every room on that storey/i);
    expect(tips).toMatch(/storey is selected in Building/);
    expect(gap).toMatch(/every room on a storey when the storey is selected/i);
  });
});
