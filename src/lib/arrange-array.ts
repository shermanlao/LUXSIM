import { pointInPolygon, roomBounds, type RoomV2, type Vec2 } from "@luxsim/project-io";

export type ArrayMode = "rect" | "line" | "circle";

export type ArrayParams = {
  mode: ArrayMode;
  rows: number;
  cols: number;
  count: number;
  spacingX: number;
  spacingY: number;
  wallOffset: number;
  rotationDeg: number;
  /** Set when grid came from target-Ēm estimator (F1.2). */
  estimateByTargetEm?: boolean;
  /**
   * Optional world-metre endpoints from official Line click-to-pick.
   * When both are set, fixtures are placed along this segment and Spacing X
   * is derived from Count and the segment length. When either is missing,
   * the existing centred, rotation-axis line is used (Spacing X applies).
   */
  lineStart?: Vec2 | null;
  lineEnd?: Vec2 | null;
  /**
   * Circle radius in metres. Used only in circle mode. The value shown in
   * the official Arrange panel is the value used.
   */
  radius?: number;
  /**
   * Optional world-metre centre from official Circle click-to-pick.
   * When missing, the room AABB centre is used (same centre as the Line
   * numeric fallback).
   */
  circleCentre?: Vec2 | null;
};

export type ArrayPoint = { x: number; y: number; rotationDeg: number };

export type ArrayPlanResult = {
  /** All grid / line points before room clip */
  proposed: ArrayPoint[];
  /** Points inside room.polygon */
  inside: ArrayPoint[];
  skippedOutside: number;
};

/** Treat a picked segment shorter than 1 mm as a single point (same idea as occupied skip). */
const DEGENERATE_SEGMENT_M = 0.001;

export function planRectArray(room: RoomV2, params: Omit<ArrayParams, "mode" | "count">): ArrayPoint[] {
  const rows = Math.max(1, Math.floor(params.rows));
  const cols = Math.max(1, Math.floor(params.cols));
  const spacingX = Math.max(0.01, params.spacingX);
  const spacingY = Math.max(0.01, params.spacingY);
  const wallOffset = Math.max(0, params.wallOffset);
  const rotationDeg = params.rotationDeg;
  const b = roomBounds(room);
  const points: ArrayPoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = b.minX + wallOffset + col * spacingX;
      const y = b.minY + wallOffset + row * spacingY;
      points.push({ x, y, rotationDeg });
    }
  }
  return points;
}

/**
 * Place `count` fixtures along a picked world-metre segment.
 * Count ≥ 2: equally spaced from start to end inclusive.
 * Count = 1: the midpoint.
 * A degenerate (sub-millimetre) segment yields a single point at the start.
 * Spacing Y is intentionally unused — the official line is one-dimensional.
 */
export function planLineArrayAlongSegment(
  start: Vec2,
  end: Vec2,
  count: number,
  rotationDeg: number
): ArrayPoint[] {
  const n = Math.max(1, Math.floor(count));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < DEGENERATE_SEGMENT_M) {
    return [{ x: start.x, y: start.y, rotationDeg }];
  }
  if (n === 1) {
    return [{ x: start.x + dx / 2, y: start.y + dy / 2, rotationDeg }];
  }
  const points: ArrayPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    points.push({
      x: start.x + t * dx,
      y: start.y + t * dy,
      rotationDeg,
    });
  }
  return points;
}

export function planLineArray(
  room: RoomV2,
  params: Pick<ArrayParams, "count" | "spacingX" | "rotationDeg" | "lineStart" | "lineEnd">
): ArrayPoint[] {
  const rotationDeg = params.rotationDeg;
  if (params.lineStart && params.lineEnd) {
    return planLineArrayAlongSegment(params.lineStart, params.lineEnd, params.count, rotationDeg);
  }

  const count = Math.max(1, Math.floor(params.count));
  const spacing = Math.max(0.01, params.spacingX);
  const b = roomBounds(room);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const half = (count - 1) / 2;
  const points: ArrayPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = i - half;
    points.push({
      x: cx + t * spacing * dx,
      y: cy + t * spacing * dy,
      rotationDeg,
    });
  }
  return points;
}


/** Default Circle radius: a quarter of the room AABB shorter side, at least 1 cm. */
export function defaultCircleRadiusM(room: RoomV2): number {
  const b = roomBounds(room);
  const shorter = Math.min(Math.max(0, b.maxX - b.minX), Math.max(0, b.maxY - b.minY));
  return Math.max(0.01, shorter / 4);
}

export function roomAabbCentre(room: RoomV2): Vec2 {
  const b = roomBounds(room);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/**
 * Place `count` fixtures equally spaced on a circle.
 * Angle 0° is +X; `rotationDeg` is both the start angle of the first point
 * (`cos`/`sin` of that angle) and the fixture orientation — fixtures are
 * not aimed at the centre or along the tangent.
 * Count = 1 places the single point at that start angle on the radius, not
 * at the centre.
 * Spacing X, Spacing Y, and wall offset are intentionally unused.
 */
export function planCircleArray(
  room: RoomV2,
  params: Pick<ArrayParams, "count" | "rotationDeg" | "circleCentre"> & { radius: number }
): ArrayPoint[] {
  const count = Math.max(1, Math.floor(params.count));
  const radius = Math.max(0, params.radius);
  const rotationDeg = params.rotationDeg;
  const centre = params.circleCentre ?? roomAabbCentre(room);
  const startRad = (rotationDeg * Math.PI) / 180;
  const points: ArrayPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = startRad + (i * 2 * Math.PI) / count;
    points.push({
      x: centre.x + radius * Math.cos(angle),
      y: centre.y + radius * Math.sin(angle),
      rotationDeg,
    });
  }
  return points;
}

export function clipArrayPointsToRoom(room: RoomV2, proposed: ArrayPoint[]): ArrayPlanResult {
  const inside: ArrayPoint[] = [];
  for (const p of proposed) {
    if (pointInPolygon({ x: p.x, y: p.y }, room.polygon)) {
      inside.push(p);
    }
  }
  return {
    proposed,
    inside,
    skippedOutside: proposed.length - inside.length,
  };
}

export function planFixtureArray(room: RoomV2, params: ArrayParams): ArrayPlanResult {
  const proposed =
    params.mode === "line"
      ? planLineArray(room, params)
      : params.mode === "circle"
        ? planCircleArray(room, { ...params, radius: params.radius ?? 0 })
        : planRectArray(room, params);
  return clipArrayPointsToRoom(room, proposed);
}

/** Round-trip helper for tests (1 mm tolerance). */
export function pointsRoughlyEqual(a: Vec2, b: Vec2, tolM = 0.001): boolean {
  return Math.abs(a.x - b.x) <= tolM && Math.abs(a.y - b.y) <= tolM;
}
