import { pointInPolygon, roomBounds, type RoomV2, type Vec2 } from "@luxsim/project-io";

export type ArrayMode = "rect" | "line" | "circle" | "polygon";

export type ArrayParams = {
  mode: ArrayMode;
  rows: number;
  cols: number;
  count: number;
  spacingX: number;
  spacingY: number;
  wallOffset: number;
  rotationDeg: number;
  /** Set when the plan came from Automatic Placement / the target-Ēm estimator. */
  estimateByTargetEm?: boolean;
  /** Official Automatic Placement (polygon-aware, lumen method + S/Hm). */
  automaticPlacement?: boolean;
  targetEmMaintainedLx?: number;
  luminousFluxLm?: number;
  utilance?: number;
  maintenanceFactor?: number;
  maxSpacingToHm?: number;
  utilanceIsDefault?: boolean;
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
  /**
   * Optional world-metre path from official Polygon click-to-pick.
   * When missing or empty, the selected room's official outline is used.
   * `polygonPathClosed` selects closed spacing (perimeter / Count) versus
   * open spacing (start to end, including the endpoints when Count ≥ 2).
   */
  polygonPath?: Vec2[] | null;
  polygonPathClosed?: boolean;
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

/** Distance tolerance for “on the official outline” and path walking (1 µm). */
const OUTLINE_EPS_M = 1e-6;

function verticesAlmostEqual(a: Vec2, b: Vec2, epsM = OUTLINE_EPS_M): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= epsM;
}

/**
 * Closed ring of the official room polygon. If the last vertex already
 * coincides with the first, it is not repeated.
 */
export function closedPolygonRing(polygon: Vec2[]): Vec2[] {
  if (polygon.length === 0) return [];
  const first = polygon[0]!;
  const last = polygon[polygon.length - 1]!;
  if (verticesAlmostEqual(first, last)) return polygon.slice();
  return [...polygon, first];
}

export function closedPolygonPerimeterM(polygon: Vec2[]): number {
  const ring = closedPolygonRing(polygon);
  if (ring.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

export function pointOnSegment(point: Vec2, a: Vec2, b: Vec2, epsM = OUTLINE_EPS_M): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 <= epsM * epsM) {
    return Math.hypot(apx, apy) <= epsM;
  }
  const t = (apx * abx + apy * aby) / len2;
  const tClamped = Math.max(0, Math.min(1, t));
  const dx = point.x - (a.x + tClamped * abx);
  const dy = point.y - (a.y + tClamped * aby);
  return Math.hypot(dx, dy) <= epsM;
}

/** True when the point sits on an edge of the closed official polygon. */
export function pointOnClosedPolygonOutline(
  point: Vec2,
  polygon: Vec2[],
  epsM = OUTLINE_EPS_M
): boolean {
  const ring = closedPolygonRing(polygon);
  if (ring.length < 2) return false;
  for (let i = 0; i < ring.length - 1; i += 1) {
    if (pointOnSegment(point, ring[i]!, ring[i + 1]!, epsM)) return true;
  }
  return false;
}

/**
 * Walk a distance along the closed official outline, starting at the first
 * corner. Distances are taken modulo the perimeter and stay in [0, P).
 */
export function pointAlongClosedPolygon(polygon: Vec2[], distanceM: number): Vec2 | null {
  if (polygon.length === 0) return null;
  const first = polygon[0]!;
  const perimeter = closedPolygonPerimeterM(polygon);
  if (perimeter < DEGENERATE_SEGMENT_M) return { x: first.x, y: first.y };
  let remaining = distanceM % perimeter;
  if (remaining < 0) remaining += perimeter;
  if (remaining <= OUTLINE_EPS_M || perimeter - remaining <= OUTLINE_EPS_M) {
    return { x: first.x, y: first.y };
  }
  const ring = closedPolygonRing(polygon);
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length + OUTLINE_EPS_M) {
      const t = length < OUTLINE_EPS_M ? 0 : Math.min(1, remaining / length);
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    remaining -= length;
  }
  return { x: first.x, y: first.y };
}

/**
 * Length of an open polyline (not closed). A single vertex has length 0.
 */
export function openPolylineLengthM(path: Vec2[]): number {
  if (path.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/**
 * Walk a distance along an open polyline, starting at the first vertex.
 * Distances are clamped to [0, length].
 */
export function pointAlongOpenPolyline(path: Vec2[], distanceM: number): Vec2 | null {
  if (path.length === 0) return null;
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const length = openPolylineLengthM(path);
  if (length < DEGENERATE_SEGMENT_M) return { x: first.x, y: first.y };
  if (distanceM <= OUTLINE_EPS_M) return { x: first.x, y: first.y };
  if (distanceM >= length - OUTLINE_EPS_M) return { x: last.x, y: last.y };
  let remaining = distanceM;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLen + OUTLINE_EPS_M) {
      const t = segLen < OUTLINE_EPS_M ? 0 : Math.min(1, remaining / segLen);
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    remaining -= segLen;
  }
  return { x: last.x, y: last.y };
}

/**
 * Place `count` fixtures equally spaced along an open path.
 * Count ≥ 2: equally spaced from start to end, including the endpoints.
 * Count = 1 sits at the first vertex.
 * A degenerate (sub-millimetre) path yields a single point at the start.
 */
export function planOpenPathArray(path: Vec2[], count: number, rotationDeg: number): ArrayPoint[] {
  if (path.length === 0) return [];
  const n = Math.max(1, Math.floor(count));
  const first = path[0]!;
  if (n === 1) {
    return [{ x: first.x, y: first.y, rotationDeg }];
  }
  const length = openPolylineLengthM(path);
  if (length < DEGENERATE_SEGMENT_M) {
    return [{ x: first.x, y: first.y, rotationDeg }];
  }
  const points: ArrayPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const at = pointAlongOpenPolyline(path, (i / (n - 1)) * length) ?? first;
    points.push({ x: at.x, y: at.y, rotationDeg });
  }
  return points;
}

/**
 * Place `count` fixtures equally spaced along a closed path.
 * Starts at the first vertex. Spacing is perimeter / Count, so the first
 * and last points do not coincide on the closing vertex.
 * Count = 1 sits at the first vertex.
 */
export function planClosedPathArray(path: Vec2[], count: number, rotationDeg: number): ArrayPoint[] {
  const n = Math.max(1, Math.floor(count));
  if (path.length === 0) return [];
  const first = path[0]!;
  if (n === 1) {
    return [{ x: first.x, y: first.y, rotationDeg }];
  }
  const perimeter = closedPolygonPerimeterM(path);
  if (perimeter < DEGENERATE_SEGMENT_M) {
    return [{ x: first.x, y: first.y, rotationDeg }];
  }
  const spacing = perimeter / n;
  const points: ArrayPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const at = pointAlongClosedPolygon(path, i * spacing) ?? first;
    points.push({ x: at.x, y: at.y, rotationDeg });
  }
  return points;
}

/**
 * Place `count` fixtures equally spaced along the official room outline,
 * or along an optional custom path from official Polygon click-to-pick.
 * Room-outline and closed custom paths start at the first vertex (Origin
 * on the room). Spacing is perimeter / Count, so the first and last points
 * do not coincide on the closing vertex. Count = 1 sits at the first vertex.
 * An open custom path uses start-to-end spacing, including the endpoints
 * when Count ≥ 2; Count = 1 sits at the first picked vertex.
 * `rotationDeg` is fixture orientation only — fixtures are not aimed along the tangent or inward.
 * Spacing X, Spacing Y, and wall offset are intentionally unused.
 */
export function planPolygonArray(
  room: RoomV2,
  params: Pick<ArrayParams, "count" | "rotationDeg" | "polygonPath" | "polygonPathClosed">
): ArrayPoint[] {
  const path = params.polygonPath;
  if (path && path.length > 0) {
    return params.polygonPathClosed
      ? planClosedPathArray(path, params.count, params.rotationDeg)
      : planOpenPathArray(path, params.count, params.rotationDeg);
  }
  return planClosedPathArray(room.polygon, params.count, params.rotationDeg);
}

export function clipArrayPointsToRoom(room: RoomV2, proposed: ArrayPoint[]): ArrayPlanResult {
  const inside: ArrayPoint[] = [];
  for (const p of proposed) {
    const at = { x: p.x, y: p.y };
    // Ray-casting treats some edges as outside; official outline points stay valid.
    if (pointInPolygon(at, room.polygon) || pointOnClosedPolygonOutline(at, room.polygon)) {
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
        : params.mode === "polygon"
          ? planPolygonArray(room, params)
          : planRectArray(room, params);
  return clipArrayPointsToRoom(room, proposed);
}

/** Round-trip helper for tests (1 mm tolerance). */
export function pointsRoughlyEqual(a: Vec2, b: Vec2, tolM = 0.001): boolean {
  return Math.abs(a.x - b.x) <= tolM && Math.abs(a.y - b.y) <= tolM;
}
