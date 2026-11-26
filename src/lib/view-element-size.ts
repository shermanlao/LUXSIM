/**
 * Measured CSS size of an official 2D/3D view host.
 * Non-positive or non-finite measurements fall back to the official 640×480
 * plan view so the first paint and tests still have a usable fit.
 */
export function viewElementSize(
  width: number,
  height: number,
  fallbackW: number,
  fallbackH: number
): { viewW: number; viewH: number } {
  const viewW = Number.isFinite(width) && width > 0 ? width : fallbackW;
  const viewH = Number.isFinite(height) && height > 0 ? height : fallbackH;
  return { viewW, viewH };
}
