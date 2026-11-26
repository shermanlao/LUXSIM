import type { DxfEntity, RoomV2, Vec2 } from "@luxsim/project-io";
import { officialDxfEntityToWorld, roomBounds } from "@luxsim/project-io";

/** Empty-plan default span, before the 1 m pad, matching today's Top auto-fit. */
export const OFFICIAL_PLAN_EMPTY_MIN_X = 0;
export const OFFICIAL_PLAN_EMPTY_MIN_Y = 0;
export const OFFICIAL_PLAN_EMPTY_MAX_X = 12;
export const OFFICIAL_PLAN_EMPTY_MAX_Y = 10;
export const OFFICIAL_PLAN_PAD_M = 1;
export const OFFICIAL_PLAN_MIN_SPAN_M = 4;
export const OFFICIAL_PLAN_VIEW_W = 640;
export const OFFICIAL_PLAN_VIEW_H = 480;
export const OFFICIAL_PLAN_FIT_MARGIN = 0.92;

export type OfficialPlanWorldBounds = {
  minX: number;
  minY: number;
  width: number;
  depth: number;
};

export type OfficialPlanFitTransform = {
  scale: number;
  ox: number;
  oy: number;
};

export type OfficialPlanBoundsInput = {
  rooms?: Array<Pick<RoomV2, "polygon">>;
  dxfEntities?: Array<Pick<DxfEntity, "points">>;
  underlay?: { offsetX: number; offsetY: number; metersPerUnit?: number } | null;
  underlaySize?: { widthM: number; heightM: number } | null;
  /**
   * Official storey floor-plate outlines already in world metres.
   * Included in the first-view fit like rooms, and not scaled by metersPerUnit.
   */
  storeyOutlines?: Vec2[][];
  /**
   * Accepted but ignored. A live draw-room draft (and its preview points)
   * must not expand or recentre the official auto-fit used for hit-testing.
   */
  draft?: Vec2[];
};

/**
 * Axis-aligned bounds of a point set. Null when empty.
 */
function minMaxBounds(points: Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (points.length === 0) return null;
  let minX = points[0]!.x,
    minY = points[0]!.y,
    maxX = points[0]!.x,
    maxY = points[0]!.y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/**
 * Bounds of the main point cluster, ignoring far outliers that would shrink
 * the official first view of a plan to a speck (stray points, a title block
 * far from the floor, or leaked block-definition geometry).
 * Uses a Tukey fence (1.5 × IQR) on X and Y; falls back to the full min/max
 * when fewer than 8 points remain, or when the kept set is under half the
 * points (so two similarly sized wings of a plan are not clipped).
 */
export function officialRobustPlanPointsBounds(points: Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const full = minMaxBounds(points);
  if (!full || points.length < 8) return full;
  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const ys = points.map((p) => p.y).sort((a, b) => a - b);
  const x1 = percentileSorted(xs, 0.25);
  const x3 = percentileSorted(xs, 0.75);
  const y1 = percentileSorted(ys, 0.25);
  const y3 = percentileSorted(ys, 0.75);
  const xi = Math.max(x3 - x1, 1e-9);
  const yi = Math.max(y3 - y1, 1e-9);
  const loX = x1 - 1.5 * xi;
  const hiX = x3 + 1.5 * xi;
  const loY = y1 - 1.5 * yi;
  const hiY = y3 + 1.5 * yi;
  const kept = points.filter(
    (p) => p.x >= loX && p.x <= hiX && p.y >= loY && p.y <= hiY
  );
  if (kept.length < Math.max(8, points.length * 0.5)) return full;
  return minMaxBounds(kept);
}

/**
 * Official Top-plan auto-fit bounds from rooms, DXF entities, and underlay
 * size. DXF points use the official entity→world mapping (entity ×
 * metersPerUnit + origin offset). Room polygons stay in metres and are not
 * scaled. Same path as today's non-draft fit: 1 m pad and a 4 m minimum span.
 * Draft points are deliberately excluded so adding a corner cannot move the
 * camera; when the draft is cleared, callers simply use this helper again
 * (now including any newly closed room). DXF / DWG linework uses the main
 * cluster bounds so a few far-away points do not zoom the first view out.
 */
export function officialPlanWorldBounds(
  input: OfficialPlanBoundsInput = {}
): OfficialPlanWorldBounds {
  let minX = OFFICIAL_PLAN_EMPTY_MIN_X;
  let minY = OFFICIAL_PLAN_EMPTY_MIN_Y;
  let maxX = OFFICIAL_PLAN_EMPTY_MAX_X;
  let maxY = OFFICIAL_PLAN_EMPTY_MAX_Y;
  let hasContent = false;

  const includePolygon = (polygon: Vec2[]) => {
    if (polygon.length < 2) return;
    const b = roomBounds({ polygon } as RoomV2);
    if (!hasContent) {
      minX = b.minX;
      minY = b.minY;
      maxX = b.maxX;
      maxY = b.maxY;
      hasContent = true;
    } else {
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
  };
  for (const r of input.rooms ?? []) includePolygon(r.polygon);
  for (const outline of input.storeyOutlines ?? []) includePolygon(outline);
  const dxfWorld: Vec2[] = [];
  for (const e of input.dxfEntities ?? []) {
    for (const p of e.points) {
      dxfWorld.push(officialDxfEntityToWorld(p, input.underlay));
    }
  }
  const dxfBox = officialRobustPlanPointsBounds(dxfWorld);
  if (dxfBox) {
    if (!hasContent) {
      minX = dxfBox.minX;
      minY = dxfBox.minY;
      maxX = dxfBox.maxX;
      maxY = dxfBox.maxY;
      hasContent = true;
    } else {
      minX = Math.min(minX, dxfBox.minX);
      minY = Math.min(minY, dxfBox.minY);
      maxX = Math.max(maxX, dxfBox.maxX);
      maxY = Math.max(maxY, dxfBox.maxY);
    }
  }
  if (input.underlay && input.underlaySize) {
    const x0 = input.underlay.offsetX;
    const y0 = input.underlay.offsetY;
    const x1 = x0 + input.underlaySize.widthM;
    const y1 = y0 + input.underlaySize.heightM;
    if (!hasContent) {
      minX = x0;
      minY = y0;
      maxX = x1;
      maxY = y1;
      hasContent = true;
    } else {
      minX = Math.min(minX, x0);
      minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    }
  }

  void input.draft;

  const pad = OFFICIAL_PLAN_PAD_M;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: Math.max(OFFICIAL_PLAN_MIN_SPAN_M, maxX - minX + 2 * pad),
    depth: Math.max(OFFICIAL_PLAN_MIN_SPAN_M, maxY - minY + 2 * pad),
  };
}

export function officialPlanFitTransform(
  world: OfficialPlanWorldBounds,
  viewW = OFFICIAL_PLAN_VIEW_W,
  viewH = OFFICIAL_PLAN_VIEW_H
): OfficialPlanFitTransform {
  const scale =
    Math.min(viewW / world.width, viewH / world.depth) * OFFICIAL_PLAN_FIT_MARGIN;
  return {
    scale,
    ox: (viewW - world.width * scale) / 2,
    oy: (viewH - world.depth * scale) / 2,
  };
}

export function officialPlanToScreen(
  world: OfficialPlanWorldBounds,
  x: number,
  y: number,
  viewW = OFFICIAL_PLAN_VIEW_W,
  viewH = OFFICIAL_PLAN_VIEW_H
): Vec2 {
  const { scale, ox, oy } = officialPlanFitTransform(world, viewW, viewH);
  return {
    x: ox + (x - world.minX) * scale,
    y: oy + (world.minY + world.depth - y) * scale,
  };
}

export function officialPlanSvgToWorld(
  world: OfficialPlanWorldBounds,
  svgX: number,
  svgY: number,
  viewW = OFFICIAL_PLAN_VIEW_W,
  viewH = OFFICIAL_PLAN_VIEW_H
): Vec2 {
  const { scale, ox, oy } = officialPlanFitTransform(world, viewW, viewH);
  return {
    x: world.minX + (svgX - ox) / scale,
    y: world.minY + world.depth - (svgY - oy) / scale,
  };
}
