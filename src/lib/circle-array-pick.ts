import type { Vec2 } from "@luxsim/project-io";

/** Official Circle-array click-to-pick state on the Top plan. */
export type CirclePickState = {
  centre: Vec2 | null;
};

export const EMPTY_CIRCLE_PICK: CirclePickState = { centre: null };

/**
 * Spacing X, Spacing Y, and wall offset stay disabled in Circle mode: the
 * official circle places fixtures equally on one ring. A second ring or a
 * radial pitch would be a different layout model, not this Circle array.
 */
export const CIRCLE_ARRAY_UNUSED_FIELDS_REASON =
  "Spacing X, Spacing Y and wall offset are used by Rectangular arrays. Circle mode places fixtures equally on one circle, so those fields stay disabled.";

export const CIRCLE_ARRAY_ROTATION_REASON =
  "Rotation is the fixture orientation, as in Line mode, and is also the start angle of the first point (0° is +X). Fixtures are not aimed at the centre or along the tangent.";

export const CIRCLE_ARRAY_PICK_HINT =
  "Click once on the Top plan to set the circle centre. A later click replaces the centre. Esc cancels an unwanted centre pick without leaving fullscreen and returns to the room-centre fallback. If you do not pick a centre, Count, Radius and Rotation still place the circle on the room centre. Radius is the value shown in the Radius field.";

/** True once a centre has been picked. */
export function isCircleCentrePicked(
  state: CirclePickState
): state is { centre: Vec2 } {
  return state.centre != null;
}

/**
 * CAD rule: one click sets the centre. A later click replaces it.
 * There is no two-click radius pick.
 */
export function applyCircleCentrePick(_state: CirclePickState, click: Vec2): CirclePickState {
  return { centre: { x: click.x, y: click.y } };
}

export function cancelCirclePick(): CirclePickState {
  return EMPTY_CIRCLE_PICK;
}

/**
 * Esc while Circle pick is available: clear a picked (unwanted) centre and
 * return to the room-centre fallback. When no centre is picked, let a
 * fullscreen handler see the key.
 */
export function circlePickEscapeAction(state: CirclePickState): "cancel-pick" | "pass" {
  return isCircleCentrePicked(state) ? "cancel-pick" : "pass";
}
