/**
 * Shared workplane grid-spacing clamp honoured by the solver.
 * Property-panel writes and wall-zone / first-point derivation must use this
 * same range so a stored value cannot silently diverge from calculation.
 */
export const GRID_SPACING_MIN_M = 0.25;
export const GRID_SPACING_MAX_M = 2;
export const DEFAULT_GRID_SPACING_M = 0.5;

/** Keep the workplane this far below clear height (solver already applies this cap). */
export const WORKPLANE_CLEARANCE_M = 0.05;

/**
 * Clamp a workplane grid spacing to the solver range [0.25, 2] m.
 * Missing, non-finite, or zero values fall back to the default 0.5 m
 * (same as the previous inline `grid.spacing || 0.5` in `calculate`).
 */
export function clampGridSpacingM(spacing: number | null | undefined): number {
  const raw =
    typeof spacing === "number" && Number.isFinite(spacing) && spacing !== 0
      ? spacing
      : DEFAULT_GRID_SPACING_M;
  return Math.max(GRID_SPACING_MIN_M, Math.min(GRID_SPACING_MAX_M, raw));
}

/**
 * Wall-zone / first grid point inset: half of the clamped workplane spacing.
 * Historical stored values such as 0.2 m therefore use 0.125 m, matching the
 * solver start point, not the unclamped 0.1 m.
 */
export function wallZoneFromSpacingM(spacing: number | null | undefined): number {
  return clampGridSpacingM(spacing) / 2;
}

/**
 * Upper bound matches the solver's workplane z clamp (`clear height − 0.05 m`).
 * The lower bound of 0 matches the property panel minimum so a write cannot
 * store a height the calculation will not honour in the usual case.
 */
export function clampWorkplaneHeightM(
  heightM: number | null | undefined,
  clearHeightM: number
): number {
  const cap = (Number.isFinite(clearHeightM) ? clearHeightM : 0) - WORKPLANE_CLEARANCE_M;
  const raw = typeof heightM === "number" && Number.isFinite(heightM) ? heightM : 0;
  return Math.max(0, Math.min(raw, cap));
}

/** Interreflection already clamps ρ to 0–1; writes must do the same. */
export function clampReflectance(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
