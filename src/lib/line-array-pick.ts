import type { Vec2 } from "@luxsim/project-io";

/** Official Line-array click-to-pick state on the Top plan. */
export type LinePickState = {
  start: Vec2 | null;
  end: Vec2 | null;
};

export const EMPTY_LINE_PICK: LinePickState = { start: null, end: null };

/**
 * Spacing Y stays disabled in Line mode: the official line algorithm is
 * strictly one-dimensional (along the picked segment, or a centred axis when
 * no endpoints have been picked). A second, perpendicular row would be a
 * different layout model, not this Line array.
 */
export const LINE_ARRAY_SPACING_Y_REASON =
  "Spacing Y is used by Rectangular arrays. Line mode places fixtures along one line only, so Spacing Y stays disabled.";

export const LINE_ARRAY_PICK_HINT =
  "Click two points on the Top plan to set the line start and end. The first click is the start; the second click completes the segment. A later click starts a new line. Esc cancels an unfinished start without leaving fullscreen. If you do not pick endpoints, Count, Spacing X and Rotation still place a line through the room centre.";

/** True once both endpoints have been picked. */
export function isLinePickComplete(
  state: LinePickState
): state is { start: Vec2; end: Vec2 } {
  return state.start != null && state.end != null;
}

/** True after the start click, while waiting for the end click. */
export function isLinePickInProgress(state: LinePickState): boolean {
  return state.start != null && state.end == null;
}

/**
 * CAD rule: first click sets start; second click sets end and completes the
 * segment. A later click after a complete segment restarts with a new start.
 */
export function applyLineEndpointPick(state: LinePickState, click: Vec2): LinePickState {
  if (!state.start || state.end) {
    return { start: { x: click.x, y: click.y }, end: null };
  }
  return { start: state.start, end: { x: click.x, y: click.y } };
}

export function cancelLinePick(): LinePickState {
  return EMPTY_LINE_PICK;
}

/**
 * Esc while Line pick is available: cancel an in-progress start (no end yet).
 * When idle or already complete, let a fullscreen handler see the key.
 */
export function linePickEscapeAction(state: LinePickState): "cancel-in-progress" | "pass" {
  return isLinePickInProgress(state) ? "cancel-in-progress" : "pass";
}

/**
 * Equal spacing along a completed segment. Null when count is 1 (the fixture
 * sits at the midpoint) or the segment is degenerate.
 */
export function lineArrayDerivedSpacingM(start: Vec2, end: Vec2, count: number): number | null {
  const n = Math.max(1, Math.floor(count));
  if (n <= 1) return null;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 1e-9) return null;
  return length / (n - 1);
}
