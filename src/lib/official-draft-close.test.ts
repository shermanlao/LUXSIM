import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  DRAFT_CLOSE_SNAP_CSS_PX,
  draftCloseSnapM,
  pointerPrefersDraftClose,
} from "@luxsim/project-io";

function topSrc() {
  return readFileSync(path.join(process.cwd(), "src/components/editor/TopView2D.tsx"), "utf8");
}

describe("official draft close-to-start snap", () => {
  it("uses 12 CSS pixels, not a fixed 0.2 m world tolerance", () => {
    expect(DRAFT_CLOSE_SNAP_CSS_PX).toBe(12);
    expect(draftCloseSnapM(0.01)).toBeCloseTo(0.12, 9);
  });

  it("closes when the pointer is within the start snap, even if a snap or lock would miss", () => {
    const start = { x: 0, y: 0 };
    const snapM = 0.12;
    const pointerNear = { x: 0.05, y: 0.02 };
    const dxfOffStart = { x: 0.4, y: 0 };
    const locked = { x: 0.4, y: 0 };
    expect(pointerPrefersDraftClose(pointerNear, start, 3, snapM)).toBe(true);
    expect(pointerPrefersDraftClose(dxfOffStart, start, 3, snapM)).toBe(false);
    expect(pointerPrefersDraftClose(locked, start, 3, snapM)).toBe(false);
    expect(pointerPrefersDraftClose(pointerNear, start, 2, snapM)).toBe(false);
  });

  it("wires Top view to prefer the start point over DXF snap and ortho/length lock", () => {
    const src = topSrc();
    expect(src).toContain("pointerPrefersDraftClose");
    expect(src).toContain("draftCloseSnapM");
    expect(src).toContain("finishDraft(draft)");
    expect(src).toContain("if (willClose && draft.length >= 3)");
    expect(src).toContain("setCursor(draft[0]!)");
    expect(src).not.toContain("isCloseToStart(preview, draft[0])");
    expect(src).not.toContain("isCloseToStart(raw, start)");
  });
});
