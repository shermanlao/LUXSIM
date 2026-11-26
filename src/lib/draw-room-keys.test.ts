import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { applyDrawRoomBackspace, drawRoomEscapeAction } from "./draw-room-keys";

function topViewSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
    "utf8"
  );
}

function tipsSrc() {
  return readFileSync(path.join(process.cwd(), "src/lib/ui-tips.ts"), "utf8");
}

describe("applyDrawRoomBackspace", () => {
  it("clears a typed length such as 4000 in one press and leaves the draft corners unchanged", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];
    const cleared = applyDrawRoomBackspace("4000", pts);
    expect(cleared.lengthBuf).toBe("");
    expect(cleared.lengthBuf).not.toBe("400");
    expect(cleared.draft).toBe(pts);
    expect(cleared.draft).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it("does not drop a draft corner when a typed length is cleared", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
    ];
    const cleared = applyDrawRoomBackspace("2500.5", pts);
    expect(cleared).toEqual({ lengthBuf: "", draft: pts });
    expect(cleared.draft).toBe(pts);
    expect(cleared.draft).toHaveLength(3);
  });

  it("drops the last corner on a later Backspace once the buffer is empty", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];
    const cleared = applyDrawRoomBackspace("4000", pts);
    const popped = applyDrawRoomBackspace("", cleared.draft);
    expect(popped.lengthBuf).toBe("");
    expect(popped.draft).toEqual([{ x: 0, y: 0 }]);
    expect(popped.draft).not.toBe(pts);
    const emptied = applyDrawRoomBackspace("", popped.draft);
    expect(emptied.draft).toEqual([]);
    const stillEmpty = applyDrawRoomBackspace("", []);
    expect(stillEmpty).toEqual({ lengthBuf: "", draft: [] });
  });
});

describe("drawRoomEscapeAction", () => {
  it("cancels when there is a typed length or at least one draft point", () => {
    expect(drawRoomEscapeAction("4000", 0)).toBe("cancel-draft");
    expect(drawRoomEscapeAction("4000", 1)).toBe("cancel-draft");
    expect(drawRoomEscapeAction("", 1)).toBe("cancel-draft");
    expect(drawRoomEscapeAction("", 2)).toBe("cancel-draft");
  });

  it("passes through when there is no draft and no typed length", () => {
    expect(drawRoomEscapeAction("", 0)).toBe("pass");
  });
});

describe("TopView2D draw-room key wiring", () => {
  const src = topViewSrc();

  it("uses the official helpers, keeps typing and Enter, and lets Esc pass through when idle", () => {
    expect(src).toContain('from "@/lib/draw-room-keys"');
    expect(src).toContain("applyDrawRoomBackspace");
    expect(src).toContain("drawRoomEscapeAction");
    expect(src).toContain("applyDrawRoomBackspace(lengthBuf, draft)");
    expect(src).toContain("drawRoomEscapeAction(lengthBuf, draft.length)");
    expect(src).toContain('=== "pass"');
    expect(src).toContain("e.stopImmediatePropagation()");
    expect(src).toContain('addEventListener("keydown", onKey, { capture: true })');
    expect(src).toContain('removeEventListener("keydown", onKey, { capture: true })');
    expect(src).not.toContain("setLengthBuf((s) => s.slice(0, -1))");
    expect(src).toContain("isTypingField");
    expect(src).toContain('if (e.key === "Enter")');
    expect(src).toContain('if (e.key === "Shift")');
    expect(src).toContain('e.key === "." || e.key === ","');
    expect(src).toContain("/^[0-9]$/.test(e.key)");
    expect(src).toContain("setOrtho(true)");
  });

  it("updates the in-app tip so Backspace clears the locked length first", () => {
    const tips = tipsSrc();
    expect(tips).toMatch(/Backspace clears the typed length/);
    expect(tips).not.toMatch(/Backspace undoes the last corner\./);
  });
});
