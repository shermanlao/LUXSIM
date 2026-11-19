/** Format official room area and origin readouts for the Properties panel. */

const ORIGIN_EQ_BOUND_EPS = 1e-6;

export type RoomCorner = { x: number; y: number };

export type RoomBoundsMin = { minX: number; minY: number };

/** Integer areas as `20 m²`; otherwise two decimals, e.g. `12.50 m²`. */
export function formatAreaM2(area: number): string {
  if (!Number.isFinite(area) || area < 0) return "—";
  const rounded = Math.round(area * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return `${Math.round(rounded)} m²`;
  }
  return `${rounded.toFixed(2)} m²`;
}

/** Coordinates as `0.00, 0.00 m`. */
export function formatMetresXy(x: number, y: number): string {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "—";
  return `${x.toFixed(2)}, ${y.toFixed(2)} m`;
}

/** First-corner origin, or `—` when the corner is missing or non-finite. */
export function formatOriginMetres(firstCorner: RoomCorner | undefined | null): string {
  if (!firstCorner) return "—";
  return formatMetresXy(firstCorner.x, firstCorner.y);
}

/**
 * Show Bounding min only when the first corner is not the AABB min,
 * as with an L-shape or a non-ortho room. Hide it for a 5×4 m rectangle
 * whose origin is already (minX, minY).
 */
export function shouldShowBoundingMin(
  firstCorner: RoomCorner | undefined | null,
  bounds: RoomBoundsMin
): boolean {
  if (!firstCorner) return false;
  if (
    !Number.isFinite(firstCorner.x) ||
    !Number.isFinite(firstCorner.y) ||
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY)
  ) {
    return false;
  }
  return (
    Math.abs(firstCorner.x - bounds.minX) > ORIGIN_EQ_BOUND_EPS ||
    Math.abs(firstCorner.y - bounds.minY) > ORIGIN_EQ_BOUND_EPS
  );
}
