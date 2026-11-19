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
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(tips).toMatch(/Rooms and storeys are not translated by dragging the fill/);
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
    expect(top).toContain("usePlanPointerNav");
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

  it("documents that a storey is not dragged on the plan", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const roomDraw = readSrc("docs/ROOM_DRAW.md");
    const workflow = readSrc("docs/EDITOR_WORKFLOW.md");
    const gap = readSrc("docs/DIALUX_GAP.md");
    const tips = readSrc("src/lib/ui-tips.ts");
    expect(guide).toMatch(/storey cannot be dragged on the plan/);
    expect(guide).toMatch(/整層也不能用拖曳來平移/);
    expect(guide).toMatch(/點一下房間仍會選取該房間/);
    expect(guide).toMatch(/A click on a room still selects that room|click on a room still selects/i);
    expect(roomDraw).toMatch(/A click on a room still selects that room/);
    expect(workflow).toMatch(/not translated by dragging the room fill/);
    expect(tips).toMatch(/not translated by dragging the fill/);
    expect(gap).toMatch(/not translated by dragging the fill/);
  });
});
