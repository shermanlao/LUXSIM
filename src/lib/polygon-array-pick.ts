import type { Vec2 } from "@luxsim/project-io";

/** Official Polygon-array click-to-pick state on the Top / Bottom plan. */
export type PolygonPathPickState = {
  vertices: Vec2[];
  /** True once the path has been finished (Enter / double-click) or closed. */
  finished: boolean;
  /** True when a finished path was closed by snapping to the first vertex. */
  closed: boolean;
};

export const EMPTY_POLYGON_PATH_PICK: PolygonPathPickState = {
  vertices: [],
  finished: false,
  closed: false,
};

/**
 * Close-path snap, same order of magnitude as the official storey-drag click
 * slop (`STOREY_DRAG_CLICK_SLOP_PX`). A click within this many CSS pixels of
 * the first vertex, at the current zoom, closes the path.
 */
export const POLYGON_PATH_CLOSE_SNAP_CSS_PX = 4;

export const POLYGON_ARRAY_PICK_HINT =
  "With a room selected, click on the Top or Bottom plan to add path vertices in the current zoomed or fitted world coordinates. Enter or a double-click on empty background finishes an open path. Click near the first vertex (within 4 CSS pixels at the current zoom) to close the path. A later click after a finished path starts a new one. Esc cancels an unfinished path without leaving fullscreen. Clear path returns to the room-outline fallback and also does not exit fullscreen. If you do not pick a custom path, Count fixtures are placed equally along the selected room’s closed outline, starting at the first corner (Origin). A closed custom path uses the same spacing (perimeter / Count), so the first and last points do not coincide on the closing vertex; Count = 1 sits at the first picked vertex. An open custom path spaces Count fixtures equally from start to end, including the endpoints when Count ≥ 2; Count = 1 sits at the first picked vertex.";

/** True once the user has finished or closed a path with at least one vertex. */
export function isPolygonPathComplete(state: PolygonPathPickState): boolean {
  return state.finished && state.vertices.length > 0;
}

/** True after the first click, while waiting to finish or close the path. */
export function isPolygonPathInProgress(state: PolygonPathPickState): boolean {
  return !state.finished && state.vertices.length > 0;
}

/** World metres represented by 1 CSS pixel at the pointer, via a client-to-world map. */
export function worldMetresPerCssPixel(
  toWorld: (clientX: number, clientY: number) => Vec2,
  clientX: number,
  clientY: number
): number {
  const a = toWorld(clientX, clientY);
  const b = toWorld(clientX + 1, clientY);
  const m = Math.hypot(b.x - a.x, b.y - a.y);
  return Number.isFinite(m) && m > 0 ? m : 0;
}

/** World-metre snap radius for closing a custom path at the current zoom. */
export function polygonPathCloseSnapM(metresPerCssPx: number): number {
  const m = metresPerCssPx * POLYGON_PATH_CLOSE_SNAP_CSS_PX;
  return Number.isFinite(m) && m > 0 ? m : 0.001;
}

export function isCloseToPolygonPathStart(
  click: Vec2,
  start: Vec2,
  closeSnapM: number
): boolean {
  return Math.hypot(click.x - start.x, click.y - start.y) <= closeSnapM;
}

/**
 * CAD rule: clicks append vertices. A click near the first vertex (with at
 * least three vertices) closes and finishes the path without repeating the
 * start point. A later click after a finished path restarts with a new start.
 */
export function applyPolygonPathVertexPick(
  state: PolygonPathPickState,
  click: Vec2,
  opts: { closeSnapM: number }
): PolygonPathPickState {
  const point = { x: click.x, y: click.y };
  if (state.finished || state.vertices.length === 0) {
    return { vertices: [point], finished: false, closed: false };
  }
  const first = state.vertices[0]!;
  if (state.vertices.length >= 3 && isCloseToPolygonPathStart(point, first, opts.closeSnapM)) {
    return { vertices: state.vertices.slice(), finished: true, closed: true };
  }
  return {
    vertices: [...state.vertices, point],
    finished: false,
    closed: false,
  };
}

/** Finish an unfinished path as an open polyline. No-op when idle or already finished. */
export function finishOpenPolygonPath(state: PolygonPathPickState): PolygonPathPickState {
  if (!isPolygonPathInProgress(state)) return state;
  return { vertices: state.vertices.slice(), finished: true, closed: false };
}

export function cancelPolygonPathPick(): PolygonPathPickState {
  return EMPTY_POLYGON_PATH_PICK;
}

/**
 * Esc while Polygon pick is available: cancel an unfinished path. When idle
 * or already finished, let a fullscreen handler see the key.
 */
export function polygonPathEscapeAction(
  state: PolygonPathPickState
): "cancel-in-progress" | "pass" {
  return isPolygonPathInProgress(state) ? "cancel-in-progress" : "pass";
}

/**
 * Enter (or a mid-pick double-click on empty background) finishes an open path.
 */
export function polygonPathEnterAction(
  state: PolygonPathPickState
): "finish-open" | "pass" {
  return isPolygonPathInProgress(state) ? "finish-open" : "pass";
}
