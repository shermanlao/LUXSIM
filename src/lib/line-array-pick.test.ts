import { describe, expect, it } from "vitest";
import {
  applyLineEndpointPick,
  cancelLinePick,
  EMPTY_LINE_PICK,
  isLinePickComplete,
  isLinePickInProgress,
  lineArrayDerivedSpacingM,
  linePickEscapeAction,
} from "./line-array-pick";

describe("applyLineEndpointPick", () => {
  it("sets start on the first click and completes on the second", () => {
    const afterStart = applyLineEndpointPick(EMPTY_LINE_PICK, { x: 1, y: 2 });
    expect(afterStart).toEqual({ start: { x: 1, y: 2 }, end: null });
    expect(isLinePickInProgress(afterStart)).toBe(true);
    expect(isLinePickComplete(afterStart)).toBe(false);

    const complete = applyLineEndpointPick(afterStart, { x: 4, y: 6 });
    expect(complete).toEqual({ start: { x: 1, y: 2 }, end: { x: 4, y: 6 } });
    expect(isLinePickComplete(complete)).toBe(true);
    expect(isLinePickInProgress(complete)).toBe(false);
  });

  it("restarts with a new start when the user clicks after a complete segment", () => {
    const complete = applyLineEndpointPick(
      applyLineEndpointPick(EMPTY_LINE_PICK, { x: 0, y: 0 }),
      { x: 3, y: 0 }
    );
    const restarted = applyLineEndpointPick(complete, { x: 5, y: 1 });
    expect(restarted).toEqual({ start: { x: 5, y: 1 }, end: null });
    expect(isLinePickInProgress(restarted)).toBe(true);
  });
});

describe("linePickEscapeAction", () => {
  it("cancels only an in-progress start and passes through when idle or complete", () => {
    expect(linePickEscapeAction(EMPTY_LINE_PICK)).toBe("pass");
    expect(linePickEscapeAction({ start: { x: 1, y: 1 }, end: null })).toBe("cancel-in-progress");
    expect(linePickEscapeAction({ start: { x: 1, y: 1 }, end: { x: 2, y: 2 } })).toBe("pass");
    expect(cancelLinePick()).toEqual(EMPTY_LINE_PICK);
  });
});

describe("lineArrayDerivedSpacingM", () => {
  it("is the segment length divided by count-1, and null for a single fixture", () => {
    expect(lineArrayDerivedSpacingM({ x: 1, y: 1 }, { x: 4, y: 1 }, 3)).toBeCloseTo(1.5, 6);
    expect(lineArrayDerivedSpacingM({ x: 1, y: 1 }, { x: 4, y: 1 }, 1)).toBeNull();
    expect(lineArrayDerivedSpacingM({ x: 2, y: 2 }, { x: 2, y: 2 }, 4)).toBeNull();
  });
});
