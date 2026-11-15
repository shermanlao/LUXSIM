import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("official vertex stretch wiring", () => {
  it("wires officialSetRoomPolygon through BuildingEditor undo-coalesced setRoomPolygon", () => {
    const editor = readSrc("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("officialSetRoomPolygon");
    expect(editor).toContain("function setRoomPolygon(");
    expect(editor).toContain('beginCoalesce("drag")');
    expect(editor).toContain("officialSetRoomPolygon(s, roomId, polygon)");
    expect(editor).toContain("onSetRoomPolygon={(roomId, polygon) => setRoomPolygon(roomId, polygon)}");
    expect(editor).toContain("onVertexStretchStatus={setStatus}");
  });

  it("starts a vertex stretch from a handle hit before whole-room drag, and uses DXF snap while dragging", () => {
    const top = readSrc("src/components/editor/TopView2D.tsx");
    expect(top).toContain('from "@/lib/room-vertex-stretch"');
    expect(top).toContain("shouldBeginVertexStretch");
    expect(top).toContain("shouldBeginEdgeInsert");
    expect(top).toContain("hitRoomVertexHandle");
    expect(top).toContain("hitRoomEdgeInsert");
    expect(top).toContain("vertexHandleRadiusM");
    expect(top).toContain("moveRoomVertex");
    expect(top).toContain("resolveOfficialEdgeInsert");
    expect(top).toContain("commitStretchedRoomPolygon");
    expect(top).toContain("beginVertexStretch");
    expect(top).toContain("beginEdgeInsert");
    expect(top).toContain("data-room-vertex-handle");
    expect(top).toContain("data-room-edge-insert");
    expect(top).toContain("worldMetresPerCssPixel");
    expect(top).toContain("snappedWorldAt");
    const roomDown = top.slice(
      top.indexOf("onMouseDown={(e) => {"),
      top.indexOf("{instances.map((inst) => {")
    );
    const vertexIdx = roomDown.indexOf("shouldBeginVertexStretch");
    const edgeIdx = roomDown.indexOf("shouldBeginEdgeInsert");
    const roomIdx = roomDown.indexOf("shouldBeginRoomDrag");
    expect(vertexIdx).toBeGreaterThan(0);
    expect(edgeIdx).toBeGreaterThan(vertexIdx);
    expect(roomIdx).toBeGreaterThan(edgeIdx);
    expect(top).toContain("beginVertexStretch(");
    expect(top).toContain("beginEdgeInsert(");
    expect(top).not.toContain("startVertex");
    expect(top).not.toMatch(/delete-vertex|deleteVertex|filletRoom|boolean union/i);
    const fixtureDown = top.slice(top.indexOf("{instances.map((inst) => {"));
    expect(fixtureDown).toContain("beginMove(inst.instanceId");
    expect(fixtureDown).not.toContain("shouldBeginVertexStretch");
    expect(fixtureDown).not.toContain("shouldBeginEdgeInsert");
    expect(fixtureDown).not.toContain("beginVertexStretch");
    expect(fixtureDown).not.toContain("beginEdgeInsert");
    expect(top).toContain("if (drawing || linePickActive || circlePickActive) return;");
    expect(top).toContain("wheelZoomFactor");
    expect(top).not.toContain("click-drag pan");
  });

  it("documents corner-handle stretch, mid-edge insert, DXF snap, interior whole-room drag, and invalid revert", () => {
    const guide = readSrc("docs/USER_GUIDE.md");
    const roomDraw = readSrc("docs/ROOM_DRAW.md");
    const workflow = readSrc("docs/EDITOR_WORKFLOW.md");
    const gap = readSrc("docs/DIALUX_GAP.md");
    expect(guide).toMatch(/drag a corner handle|corner handle to stretch/i);
    expect(guide).toMatch(/mid-edge handle to insert/i);
    expect(guide).toMatch(/拖移.*角點.*控制點|控制點.*拉伸|角點控制點/);
    expect(guide).toMatch(/邊上.*插入控制點|插入控制點.*加入新角點/);
    expect(guide).toMatch(/interior drag still moves the whole room|drag the room fill still moves the whole room/i);
    expect(guide).toMatch(/填色範圍.*仍會移動整個房間|拖移填色範圍仍會移動整個房間/);
    expect(guide).toMatch(/reverted|還原/);
    expect(guide).toMatch(/pre-insert|插入前/);
    expect(roomDraw).toMatch(/corner handle|vertex handle/i);
    expect(roomDraw).toMatch(/mid-edge handle to insert/i);
    expect(workflow).toMatch(/corner handle|vertex handle/i);
    expect(workflow).toMatch(/mid-edge handle to insert/i);
    expect(gap).toMatch(/vertex handle/i);
    expect(gap).not.toMatch(/No vertex handles/);
    expect(gap).toMatch(/mid-edge handles insert/i);
    expect(gap).toMatch(/Delete-vertex, fillet, and full DIALux-style vertex/i);
    expect(guide).not.toMatch(/full DIALux-style vertex modelling is done/i);
  });
});
