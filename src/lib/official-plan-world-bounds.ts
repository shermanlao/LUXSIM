import type { DxfEntity, RoomV2, Vec2 } from "@luxsim/project-io";
import { roomBounds } from "@luxsim/project-io";

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
  underlay?: { offsetX: number; offsetY: number } | null;
  underlaySize?: { widthM: number; heightM: number } | null;
  /**
   * Accepted but ignored. A live draw-room draft (and its preview points)
   * must not expand or recentre the official auto-fit used for hit-testing.
   */
  draft?: Vec2[];
};

/**
 * Official Top-plan auto-fit bounds from rooms, DXF entities, and underlay
 * size. Same path as today's non-draft fit: 1 m pad and a 4 m minimum span.
 * Draft points are deliberately excluded so adding a corner cannot move the
 * camera; when the draft is cleared, callers simply use this helper again
 * (now including any newly closed room).
 */
export function officialPlanWorldBounds(
  input: OfficialPlanBoundsInput = {}
): OfficialPlanWorldBounds {
  let minX = OFFICIAL_PLAN_EMPTY_MIN_X;
  let minY = OFFICIAL_PLAN_EMPTY_MIN_Y;
  let maxX = OFFICIAL_PLAN_EMPTY_MAX_X;
  let maxY = OFFICIAL_PLAN_EMPTY_MAX_Y;
  let hasContent = false;

  for (const r of input.rooms ?? []) {
    const b = roomBounds(r as RoomV2);
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
  }
  for (const e of input.dxfEntities ?? []) {
    for (const p of e.points) {
      if (!hasContent) {
        minX = maxX = p.x;
        minY = maxY = p.y;
        hasContent = true;
      } else {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
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
