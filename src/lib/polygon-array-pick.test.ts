import { describe, expect, it } from "vitest";
import {
  applyPolygonPathVertexPick,
  cancelPolygonPathPick,
  EMPTY_POLYGON_PATH_PICK,
  finishOpenPolygonPath,
  isCloseToPolygonPathStart,
  isPolygonPathComplete,
  isPolygonPathInProgress,
  POLYGON_PATH_CLOSE_SNAP_CSS_PX,
  polygonPathCloseSnapM,
  polygonPathEnterAction,
  polygonPathEscapeAction,
  worldMetresPerCssPixel,
} from "./polygon-array-pick";

const SNAP = { closeSnapM: 0.1 };

describe("applyPolygonPathVertexPick", () => {
  it("appends vertices, closes near the first vertex, and restarts after a finished path", () => {
    const a = applyPolygonPathVertexPick(EMPTY_POLYGON_PATH_PICK, { x: 1, y: 1 }, SNAP);
    expect(a).toEqual({ vertices: [{ x: 1, y: 1 }], finished: false, closed: false });
    expect(isPolygonPathInProgress(a)).toBe(true);
    expect(isPolygonPathComplete(a)).toBe(false);

    const b = applyPolygonPathVertexPick(a, { x: 3, y: 1 }, SNAP);
    const c = applyPolygonPathVertexPick(b, { x: 3, y: 3 }, SNAP);
    expect(c.vertices).toHaveLength(3);
    expect(c.finished).toBe(false);

    const closed = applyPolygonPathVertexPick(c, { x: 1.05, y: 1 }, SNAP);
    expect(closed.finished).toBe(true);
    expect(closed.closed).toBe(true);
    expect(closed.vertices).toHaveLength(3);
    expect(closed.vertices[0]).toEqual({ x: 1, y: 1 });
    expect(isPolygonPathComplete(closed)).toBe(true);
    expect(isPolygonPathInProgress(closed)).toBe(false);

    const restarted = applyPolygonPathVertexPick(closed, { x: 5, y: 2 }, SNAP);
    expect(restarted).toEqual({ vertices: [{ x: 5, y: 2 }], finished: false, closed: false });
  });

  it("does not close with fewer than three vertices, even when the click is on the start", () => {
    const start = applyPolygonPathVertexPick(EMPTY_POLYGON_PATH_PICK, { x: 0, y: 0 }, SNAP);
    const two = applyPolygonPathVertexPick(start, { x: 2, y: 0 }, SNAP);
    const nearStart = applyPolygonPathVertexPick(two, { x: 0, y: 0 }, SNAP);
    expect(nearStart.finished).toBe(false);
    expect(nearStart.closed).toBe(false);
    expect(nearStart.vertices).toHaveLength(3);
  });
});

describe("finishOpenPolygonPath and Esc / Clear", () => {
  it("finishes an unfinished path as open and leaves idle or finished paths alone", () => {
    const mid = applyPolygonPathVertexPick(
      applyPolygonPathVertexPick(EMPTY_POLYGON_PATH_PICK, { x: 0, y: 0 }, SNAP),
      { x: 2, y: 0 },
      SNAP
    );
    expect(polygonPathEnterAction(mid)).toBe("finish-open");
    const finished = finishOpenPolygonPath(mid);
    expect(finished).toEqual({
      vertices: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      finished: true,
      closed: false,
    });
    expect(polygonPathEnterAction(finished)).toBe("pass");
    expect(finishOpenPolygonPath(EMPTY_POLYGON_PATH_PICK)).toEqual(EMPTY_POLYGON_PATH_PICK);
    expect(finishOpenPolygonPath(finished)).toEqual(finished);
  });

  it("cancels only an in-progress path and passes through when idle or complete", () => {
    expect(polygonPathEscapeAction(EMPTY_POLYGON_PATH_PICK)).toBe("pass");
    const mid = applyPolygonPathVertexPick(EMPTY_POLYGON_PATH_PICK, { x: 1, y: 1 }, SNAP);
    expect(polygonPathEscapeAction(mid)).toBe("cancel-in-progress");
    const open = finishOpenPolygonPath(mid);
    expect(polygonPathEscapeAction(open)).toBe("pass");
    expect(cancelPolygonPathPick()).toEqual(EMPTY_POLYGON_PATH_PICK);
  });
});

describe("polygon path close snap", () => {
  it("uses 4 CSS pixels at the current zoom, with a 1 mm fallback", () => {
    expect(POLYGON_PATH_CLOSE_SNAP_CSS_PX).toBe(4);
    expect(polygonPathCloseSnapM(0.05)).toBeCloseTo(0.2, 9);
    expect(polygonPathCloseSnapM(0)).toBeCloseTo(0.001, 9);
    expect(isCloseToPolygonPathStart({ x: 1.1, y: 1 }, { x: 1, y: 1 }, 0.2)).toBe(true);
    expect(isCloseToPolygonPathStart({ x: 1.3, y: 1 }, { x: 1, y: 1 }, 0.2)).toBe(false);
    const toWorld = (clientX: number, clientY: number) => ({ x: clientX * 0.02, y: clientY * 0.02 });
    expect(worldMetresPerCssPixel(toWorld, 10, 20)).toBeCloseTo(0.02, 9);
    expect(polygonPathCloseSnapM(worldMetresPerCssPixel(toWorld, 10, 20))).toBeCloseTo(0.08, 9);
  });
});
