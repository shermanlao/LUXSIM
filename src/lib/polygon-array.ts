/**
 * Official Polygon-array copy. This mode uses the selected room's closed
 * outline. It does not add a second path-drawing tool.
 */

/**
 * Spacing X, Spacing Y, and wall offset stay disabled in Polygon mode: the
 * official polygon places fixtures equally on the room outline. An inset,
 * wall offset, or a second ring would be a different layout model, not this
 * Polygon array.
 */
export const POLYGON_ARRAY_UNUSED_FIELDS_REASON =
  "Spacing X, Spacing Y and wall offset are used by Rectangular arrays. Polygon mode places fixtures equally on the room outline, so those fields stay disabled.";

export const POLYGON_ARRAY_ROTATION_REASON =
  "Rotation is the fixture orientation, as in Line and Circle modes. Fixtures are not aimed along the tangent or inward.";

export const POLYGON_ARRAY_HINT =
  "With a room selected, Count fixtures are placed equally along the selected room’s closed outline, starting at the first corner (Origin). Spacing along the path is the perimeter divided by Count, so the first and last points do not coincide on the closing vertex. When Count is 1, the single fixture sits at the first corner. The path is the official room polygon; this mode does not add a separate path-drawing tool.";
