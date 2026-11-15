/**
 * Official Polygon-array copy. This mode places fixtures equally along the
 * selected room's closed outline, or along an optional custom path picked on
 * the plan.
 */

/**
 * Spacing X, Spacing Y, and wall offset stay disabled in Polygon mode: the
 * official polygon places fixtures equally on the room outline or a custom
 * path. An inset, wall offset, or a second ring would be a different layout
 * model, not this Polygon array.
 */
export const POLYGON_ARRAY_UNUSED_FIELDS_REASON =
  "Spacing X, Spacing Y and wall offset are used by Rectangular arrays. Polygon mode places fixtures equally on the room outline or a custom path, so those fields stay disabled.";

export const POLYGON_ARRAY_ROTATION_REASON =
  "Rotation is the fixture orientation, as in Line and Circle modes. Fixtures are not aimed along the tangent or inward.";

export { POLYGON_ARRAY_PICK_HINT as POLYGON_ARRAY_HINT } from "./polygon-array-pick";
