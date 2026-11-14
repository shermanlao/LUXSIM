export type PlanZoom = {
  zoom: number;
  panX: number;
  panY: number;
};

/** Default view: zoom 1 and pan 0 is exactly the centred auto-fit. */
export const DEFAULT_PLAN_ZOOM: PlanZoom = { zoom: 1, panX: 0, panY: 0 };

export const PLAN_ZOOM_MIN = 0.25;
export const PLAN_ZOOM_MAX = 16;

export function clampPlanZoom(zoom: number, min = PLAN_ZOOM_MIN, max = PLAN_ZOOM_MAX): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(max, Math.max(min, zoom));
}

/**
 * Convert a wheel deltaY into a multiplicative zoom factor.
 * Zero or non-finite delta leaves the view unchanged (factor 1).
 * Scroll up (negative deltaY) zooms in; scroll down zooms out.
 */
export function wheelZoomFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  return Math.exp(-deltaY * 0.0015);
}

/** Centred auto-fit origin used by the official plan at zoom 1. */
export function centeredFitOrigin(
  viewW: number,
  viewH: number,
  worldW: number,
  worldD: number,
  fitScale: number
): { ox: number; oy: number } {
  return {
    ox: (viewW - worldW * fitScale) / 2,
    oy: (viewH - worldD * fitScale) / 2,
  };
}

/**
 * Map a user zoom/pan onto a fitted view.
 * At zoom=1 and pan=0 this is exactly the provided fit origin and scale.
 */
export function planViewTransform(
  fitOx: number,
  fitOy: number,
  fitScale: number,
  viewW: number,
  viewH: number,
  view: PlanZoom
): { scale: number; ox: number; oy: number } {
  const zoom = clampPlanZoom(view.zoom);
  return {
    scale: fitScale * zoom,
    ox: viewW / 2 - (viewW / 2 - fitOx) * zoom + view.panX,
    oy: viewH / 2 - (viewH / 2 - fitOy) * zoom + view.panY,
  };
}

/**
 * Zoom so the SVG/viewBox point under the cursor stays put.
 * The official fitted bounds are not changed; only the user zoom/pan layer is.
 */
export function zoomPlanToward(
  view: PlanZoom,
  opts: {
    factor: number;
    cursorX: number;
    cursorY: number;
    viewW: number;
    viewH: number;
    fitOx: number;
    fitOy: number;
    fitScale: number;
  }
): PlanZoom {
  if (!Number.isFinite(opts.factor) || opts.factor === 1) return view;
  const nextZoom = clampPlanZoom(view.zoom * opts.factor);
  if (nextZoom === view.zoom) return view;
  const before = planViewTransform(opts.fitOx, opts.fitOy, opts.fitScale, opts.viewW, opts.viewH, view);
  const worldOffsetX = (opts.cursorX - before.ox) / before.scale;
  const worldOffsetY = (opts.cursorY - before.oy) / before.scale;
  const afterBase = planViewTransform(opts.fitOx, opts.fitOy, opts.fitScale, opts.viewW, opts.viewH, {
    zoom: nextZoom,
    panX: 0,
    panY: 0,
  });
  return {
    zoom: nextZoom,
    panX: opts.cursorX - (afterBase.ox + afterBase.scale * worldOffsetX),
    panY: opts.cursorY - (afterBase.oy + afterBase.scale * worldOffsetY),
  };
}
