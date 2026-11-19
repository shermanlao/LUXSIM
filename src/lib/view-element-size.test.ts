import { describe, expect, it } from "vitest";
import { viewElementSize } from "./view-element-size";

describe("viewElementSize", () => {
  it("uses a positive measured size", () => {
    expect(viewElementSize(1280, 720, 640, 480)).toEqual({ viewW: 1280, viewH: 720 });
  });

  it("falls back when the measurement is empty or not finite", () => {
    expect(viewElementSize(0, 0, 640, 480)).toEqual({ viewW: 640, viewH: 480 });
    expect(viewElementSize(-10, 500, 640, 480)).toEqual({ viewW: 640, viewH: 500 });
    expect(viewElementSize(800, Number.NaN, 640, 480)).toEqual({ viewW: 800, viewH: 480 });
    expect(viewElementSize(Number.POSITIVE_INFINITY, 200, 640, 480)).toEqual({
      viewW: 640,
      viewH: 200,
    });
  });
});
