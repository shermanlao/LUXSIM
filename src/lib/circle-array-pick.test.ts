import { describe, expect, it } from "vitest";
import {
  applyCircleCentrePick,
  cancelCirclePick,
  circlePickEscapeAction,
  EMPTY_CIRCLE_PICK,
  isCircleCentrePicked,
} from "./circle-array-pick";

describe("applyCircleCentrePick", () => {
  it("sets the centre on the first click and replaces it on a later click", () => {
    const first = applyCircleCentrePick(EMPTY_CIRCLE_PICK, { x: 1, y: 2 });
    expect(first).toEqual({ centre: { x: 1, y: 2 } });
    expect(isCircleCentrePicked(first)).toBe(true);

    const replaced = applyCircleCentrePick(first, { x: 4, y: 6 });
    expect(replaced).toEqual({ centre: { x: 4, y: 6 } });
    expect(isCircleCentrePicked(replaced)).toBe(true);
  });
});

describe("circlePickEscapeAction", () => {
  it("cancels a picked centre and passes through when none is picked", () => {
    expect(circlePickEscapeAction(EMPTY_CIRCLE_PICK)).toBe("pass");
    expect(circlePickEscapeAction({ centre: { x: 1, y: 1 } })).toBe("cancel-pick");
    expect(cancelCirclePick()).toEqual(EMPTY_CIRCLE_PICK);
  });
});
