import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

function editorSrc() {
  return readFileSync(path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"), "utf8");
}

describe("visible Undo and Redo buttons", () => {
  const src = editorSrc();

  it("wires Undo and Redo buttons that follow canUndo / canRedo", () => {
    expect(src).toContain("const canUndo = !readOnly && undoStackRef.current.canUndo()");
    expect(src).toContain("const canRedo = !readOnly && undoStackRef.current.canRedo()");
    expect(src).toContain("bumpUndoUi");
    expect(src).toContain("setUndoRevision");
    expect(src).toMatch(/disabled=\{!canUndo\}/);
    expect(src).toMatch(/disabled=\{!canRedo\}/);
    expect(src).toContain("onClick={undoEdit}");
    expect(src).toContain("onClick={redoEdit}");
    expect(src).toMatch(/>\s*Undo\s*</);
    expect(src).toMatch(/>\s*Redo\s*</);
  });

  it("keeps the keyboard shortcuts and mentions both buttons and shortcuts in the status hint", () => {
    expect(src).toContain("editorUndoKeyAction");
    expect(src).toContain('if (action === "undo") undoEdit()');
    expect(src).toContain("else redoEdit()");
    expect(src).toContain("Undo / Redo (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z)");
  });
});
