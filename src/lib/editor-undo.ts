export type UndoStack<T> = {
  push(currentBeforeChange: T): void;
  undo(current: T): T | null;
  redo(current: T): T | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
};

export function createUndoStack<T>(limit = 50): UndoStack<T> {
  const cap = Math.max(1, limit);
  const past: T[] = [];
  const future: T[] = [];
  return {
    push(currentBeforeChange) {
      past.push(currentBeforeChange);
      if (past.length > cap) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (!past.length) return null;
      const prev = past.pop()!;
      future.push(current);
      return prev;
    },
    redo(current) {
      if (!future.length) return null;
      const next = future.pop()!;
      past.push(current);
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past.length = 0;
      future.length = 0;
    },
  };
}

export function isTypingField(el: EventTarget | null): boolean {
  if (!el || typeof el !== "object") return false;
  const node = el as { tagName?: string; isContentEditable?: boolean };
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!node.isContentEditable;
}

export type EditorKeyAction = "undo" | "redo" | null;

/** Ctrl/Cmd+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Ctrl+X undo when not in a text field. */
export function editorUndoKeyAction(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  typing: boolean
): EditorKeyAction {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "z" && e.shiftKey) return typing ? null : "redo";
  if (key === "z" || key === "x") return typing ? null : "undo";
  if (key === "y") return typing ? null : "redo";
  return null;
}
