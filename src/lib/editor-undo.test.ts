import { describe, expect, it } from "vitest";
import {
  createUndoStack,
  editorUndoKeyAction,
  isTypingField,
} from "./editor-undo";

describe("createUndoStack", () => {
  it("undoes and redoes, clearing redo on a new push", () => {
    const stack = createUndoStack<number>(50);
    stack.push(1);
    stack.push(2);
    expect(stack.undo(3)).toBe(2);
    expect(stack.undo(2)).toBe(1);
    expect(stack.undo(1)).toBeNull();
    expect(stack.redo(1)).toBe(2);
    expect(stack.redo(2)).toBe(3);
    expect(stack.redo(3)).toBeNull();
    stack.undo(3);
    stack.push(2); // record the state before the new edit (2 → 20)
    expect(stack.redo(20)).toBeNull();
    expect(stack.undo(20)).toBe(2);
  });

  it("caps the stack at the limit", () => {
    const stack = createUndoStack<number>(50);
    for (let i = 0; i < 60; i++) stack.push(i);
    const seen: number[] = [];
    let current = 60;
    for (let i = 0; i < 60; i++) {
      const prev = stack.undo(current);
      if (prev == null) break;
      seen.push(prev);
      current = prev;
    }
    expect(seen).toHaveLength(50);
    expect(seen[0]).toBe(59);
    expect(seen[49]).toBe(10);
  });
});

describe("editorUndoKeyAction", () => {
  const ctrl = { ctrlKey: true, metaKey: false, shiftKey: false };
  it("maps Ctrl+Z and Ctrl+X to undo when not typing", () => {
    expect(editorUndoKeyAction({ ...ctrl, key: "z" }, false)).toBe("undo");
    expect(editorUndoKeyAction({ ...ctrl, key: "x" }, false)).toBe("undo");
    expect(editorUndoKeyAction({ ...ctrl, key: "Z" }, false)).toBe("undo");
  });
  it("maps Ctrl+Y and Ctrl+Shift+Z to redo", () => {
    expect(editorUndoKeyAction({ ...ctrl, key: "y" }, false)).toBe("redo");
    expect(editorUndoKeyAction({ ...ctrl, shiftKey: true, key: "z" }, false)).toBe("redo");
  });
  it("does not steal Cut or native undo in text fields", () => {
    expect(editorUndoKeyAction({ ...ctrl, key: "x" }, true)).toBeNull();
    expect(editorUndoKeyAction({ ...ctrl, key: "z" }, true)).toBeNull();
    expect(editorUndoKeyAction({ ...ctrl, key: "y" }, true)).toBeNull();
    expect(editorUndoKeyAction({ ...ctrl, shiftKey: true, key: "z" }, true)).toBeNull();
  });
  it("ignores keys without a modifier", () => {
    expect(editorUndoKeyAction({ key: "z", ctrlKey: false, metaKey: false, shiftKey: false }, false)).toBeNull();
  });
});

describe("isTypingField", () => {
  it("detects input-like targets", () => {
    expect(isTypingField({ tagName: "INPUT" })).toBe(true);
    expect(isTypingField({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingField({ tagName: "SELECT" })).toBe(true);
    expect(isTypingField({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingField({ tagName: "DIV" })).toBe(false);
    expect(isTypingField(null)).toBe(false);
  });
});
