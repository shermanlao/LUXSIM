import type { DxfEntity, Vec2 } from "./types";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";

/**
 * Tessellation rule for CIRCLE, ARC, ELLIPSE, and POLYLINE / LWPOLYLINE bulge arcs:
 * 48 segments per full turn (2π). An open arc or bulge uses
 * max(2, round(48 × |sweep| / 2π)), capped at 48.
 * The count is angle-based (not radius-based) so the same angular
 * accuracy holds whether the DXF is in metres or millimetres.
 * Sagitta is about 0.21% of radius (≈ 21 mm on a 10 m radius),
 * dense enough for lighting rooms without flooding Top/3D.
 *
 * A DXF SPLINE reuses the same 48-segment base (DXF_CURVE_SEGMENTS_PER_TURN)
 * over its valid knot domain [knot[degree], knot[n]]. A closed (or otherwise
 * full-domain) spline uses at least 48 segments. An open spline’s valid domain
 * is already that full span (spanFraction = 1), so the base is
 * max(2, round(48 × 1)) = 48, and both endpoints are included. In either case
 * also use at least 4 samples per non-empty knot span so local wiggles are
 * not lost, and cap at 384. Samples are uniform in parameter space.
 */
export const DXF_CURVE_SEGMENTS_PER_TURN = 48;

const TAU = Math.PI * 2;

export function dxfCurveSegmentCount(sweepRad: number): number {
  const sweep = Math.abs(sweepRad);
  if (!(sweep > 0) || !Number.isFinite(sweep)) return 0;
  const n = Math.round((DXF_CURVE_SEGMENTS_PER_TURN * sweep) / TAU);
  return Math.max(2, Math.min(DXF_CURVE_SEGMENTS_PER_TURN, n));
}

/** DXF ARC / CIRCLE convention: angles in degrees, drawn CCW. Equal angles mean a full circle. */
export function dxfCcwSweepRad(startDeg: number, endDeg: number): {
  startRad: number;
  sweepRad: number;
} {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  if (!Number.isFinite(startRad) || !Number.isFinite(endRad)) {
    return { startRad: 0, sweepRad: 0 };
  }
  let sweepRad = endRad - startRad;
  while (sweepRad <= 0) sweepRad += TAU;
  if (sweepRad > TAU) sweepRad = TAU;
  return { startRad, sweepRad };
}

function pointOnCircle(cx: number, cy: number, r: number, angleRad: number): Vec2 {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function tessellateCircle(cx: number, cy: number, r: number, startRad = 0): Vec2[] {
  const n = DXF_CURVE_SEGMENTS_PER_TURN;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    pts.push(pointOnCircle(cx, cy, r, startRad + (TAU * i) / n));
  }
  return pts;
}

/**
 * Open circular arc, including the start and end points.
 * Segment count follows dxfCurveSegmentCount (48 per full turn).
 * `sweepRad` may be signed (positive = CCW).
 */
export function tessellateCircularArc(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  sweepRad: number
): Vec2[] {
  const n = dxfCurveSegmentCount(sweepRad);
  if (
    n < 2 ||
    !(r > 0) ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(startRad) ||
    !Number.isFinite(sweepRad)
  ) {
    return [];
  }
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(pointOnCircle(cx, cy, r, startRad + (sweepRad * i) / n));
  }
  return pts;
}

/** Interior vertices of an open circular arc (endpoints omitted). */
export function tessellateCircularArcIntermediates(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  sweepRad: number
): Vec2[] {
  const pts = tessellateCircularArc(cx, cy, r, startRad, sweepRad);
  if (pts.length <= 2) return [];
  return pts.slice(1, -1);
}

function tessellateOpenArc(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  sweepRad: number
): Vec2[] {
  return tessellateCircularArc(cx, cy, r, startRad, sweepRad);
}

/**
 * DXF ELLIPSE start/end parameters are already in radians, measured from the
 * major axis. A full ellipse is a 2π sweep (the documented full-ellipse values
 * are start=0, end=2π). Sweeps within 1e-6 rad of 2π are treated as a full
 * turn so common decimal writings of 2π still close. Equal start and end wrap
 * to a full turn (same idea as the ARC equal-angle convention).
 */
const DXF_ELLIPSE_FULL_SWEEP_EPS = 1e-6;

export function dxfEllipseSweepRad(startParam: number, endParam: number): {
  startRad: number;
  sweepRad: number;
} {
  if (!Number.isFinite(startParam) || !Number.isFinite(endParam)) {
    return { startRad: 0, sweepRad: 0 };
  }
  let sweepRad = endParam - startParam;
  while (sweepRad <= 0) sweepRad += TAU;
  if (sweepRad > TAU - DXF_ELLIPSE_FULL_SWEEP_EPS) sweepRad = TAU;
  return { startRad: startParam, sweepRad };
}

/** Minor-axis vector: major rotated 90° CCW in the XY plane and scaled by the ratio. */
function ellipseMinorAxis(major: Vec2, ratio: number): Vec2 {
  return { x: -major.y * ratio, y: major.x * ratio };
}

function pointOnEllipse(cx: number, cy: number, major: Vec2, minor: Vec2, t: number): Vec2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: cx + major.x * c + minor.x * s, y: cy + major.y * c + minor.y * s };
}

function tessellateEllipse(
  cx: number,
  cy: number,
  major: Vec2,
  minor: Vec2,
  startRad = 0
): Vec2[] {
  const n = DXF_CURVE_SEGMENTS_PER_TURN;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    pts.push(pointOnEllipse(cx, cy, major, minor, startRad + (TAU * i) / n));
  }
  return pts;
}

function tessellateEllipticalArc(
  cx: number,
  cy: number,
  major: Vec2,
  minor: Vec2,
  startRad: number,
  sweepRad: number
): Vec2[] {
  const n = dxfCurveSegmentCount(sweepRad);
  if (
    n < 2 ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    !Number.isFinite(major.x) ||
    !Number.isFinite(major.y) ||
    !Number.isFinite(minor.x) ||
    !Number.isFinite(minor.y) ||
    !Number.isFinite(startRad) ||
    !Number.isFinite(sweepRad)
  ) {
    return [];
  }
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(pointOnEllipse(cx, cy, major, minor, startRad + (sweepRad * i) / n));
  }
  return pts;
}

/** Minimum segments per non-empty knot span when tessellating a DXF SPLINE. */
export const DXF_SPLINE_MIN_SEGMENTS_PER_SPAN = 4;

/** Cap on SPLINE tessellation segments (base budget is still 48). */
export const DXF_SPLINE_MAX_SEGMENTS = 384;

/**
 * Segment count for a DXF SPLINE over its valid knot domain.
 * Base budget is DXF_CURVE_SEGMENTS_PER_TURN (48) — a closed or full-domain
 * spline uses at least 48 segments; an open spline’s valid domain is already
 * that full span (spanFraction = 1), so the base is also
 * max(2, round(48 × 1)) = 48. Also at least
 * DXF_SPLINE_MIN_SEGMENTS_PER_SPAN (4) per non-empty knot span, capped at
 * DXF_SPLINE_MAX_SEGMENTS (384).
 */
export function dxfSplineSegmentCount(spanCount: number): number {
  if (!Number.isFinite(spanCount) || spanCount <= 0) return 0;
  const bySpans = Math.round(spanCount * DXF_SPLINE_MIN_SEGMENTS_PER_SPAN);
  const base = DXF_CURVE_SEGMENTS_PER_TURN;
  return Math.max(2, Math.min(DXF_SPLINE_MAX_SEGMENTS, Math.max(base, bySpans)));
}

function knotSpanCount(knots: number[], degree: number, controlCount: number): number {
  let spans = 0;
  for (let i = degree; i < controlCount; i++) {
    const a = knots[i];
    const b = knots[i + 1];
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && b > a) {
      spans += 1;
    }
  }
  return spans;
}

function knotsAreNonDecreasing(knots: number[]): boolean {
  if (knots.length === 0 || !Number.isFinite(knots[0]!)) return false;
  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1]!;
    const cur = knots[i]!;
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || cur < prev) return false;
  }
  return true;
}

function findSplineSpan(controlCount: number, degree: number, u: number, knots: number[]): number {
  const last = knots[controlCount]!;
  if (u >= last) return controlCount - 1;
  const first = knots[degree]!;
  if (u <= first) return degree;
  let low = degree;
  let high = controlCount;
  let mid = Math.floor((low + high) / 2);
  while (u < knots[mid]! || u >= knots[mid + 1]!) {
    if (u < knots[mid]!) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

/**
 * Evaluate a standard (knots.length === n + degree + 1) B-spline / NURBS at
 * parameter u in the valid span [knot[degree], knot[n]]. Uses De Boor, or
 * rational (projective / homogeneous) De Boor when weights are present.
 */
export function evaluateDxfSpline(
  degree: number,
  control: Vec2[],
  knots: number[],
  u: number,
  weights?: number[]
): Vec2 | null {
  const n = control.length;
  const p = degree;
  if (
    !Number.isInteger(p) ||
    p < 1 ||
    n < p + 1 ||
    knots.length !== n + p + 1 ||
    !Number.isFinite(u) ||
    !knotsAreNonDecreasing(knots)
  ) {
    return null;
  }
  if (weights && (weights.length !== n || weights.some((w) => !Number.isFinite(w)))) {
    return null;
  }
  const u0 = knots[p]!;
  const u1 = knots[n]!;
  if (!(u1 > u0)) return null;
  const uu = u <= u0 ? u0 : u >= u1 ? u1 : u;
  const span = findSplineSpan(n, p, uu, knots);
  const d: { x: number; y: number; w: number }[] = [];
  for (let j = 0; j <= p; j++) {
    const idx = span - p + j;
    if (idx < 0 || idx >= n) return null;
    const pt = control[idx]!;
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null;
    const w = weights ? weights[idx]! : 1;
    d.push({ x: pt.x * w, y: pt.y * w, w });
  }
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = span - p + j;
      const denom = knots[i + p - r + 1]! - knots[i]!;
      const alpha = denom === 0 ? 0 : (uu - knots[i]!) / denom;
      if (!Number.isFinite(alpha)) return null;
      const a = d[j - 1]!;
      const b = d[j]!;
      d[j] = {
        x: (1 - alpha) * a.x + alpha * b.x,
        y: (1 - alpha) * a.y + alpha * b.y,
        w: (1 - alpha) * a.w + alpha * b.w,
      };
    }
  }
  const out = d[p]!;
  if (
    !Number.isFinite(out.x) ||
    !Number.isFinite(out.y) ||
    !Number.isFinite(out.w) ||
    !(Math.abs(out.w) > 0)
  ) {
    return null;
  }
  return { x: out.x / out.w, y: out.y / out.w };
}

/**
 * Expand an AutoCAD periodic spline (knots.length === n + 1) to a standard
 * B-spline with wrapped control points and a periodically padded knot vector.
 */
function expandPeriodicSpline(
  degree: number,
  control: Vec2[],
  knots: number[],
  weights: number[] | undefined
): { control: Vec2[]; knots: number[]; weights?: number[] } | null {
  const n = control.length;
  const p = degree;
  if (knots.length !== n + 1 || n < p + 1) return null;
  if (!knotsAreNonDecreasing(knots)) return null;
  const period = knots[n]! - knots[0]!;
  if (!(period > 0) || !Number.isFinite(period)) return null;
  const expandedKnots: number[] = [];
  for (let k = p; k >= 1; k--) {
    const val = knots[n - k]! - period;
    if (!Number.isFinite(val)) return null;
    expandedKnots.push(val);
  }
  expandedKnots.push(...knots);
  for (let k = 1; k <= p; k++) {
    const val = knots[k]! + period;
    if (!Number.isFinite(val)) return null;
    expandedKnots.push(val);
  }
  if (expandedKnots.length !== n + 2 * p + 1) return null;
  if (!knotsAreNonDecreasing(expandedKnots)) return null;
  return {
    control: control.concat(control.slice(0, p)),
    knots: expandedKnots,
    weights: weights ? weights.concat(weights.slice(0, p)) : undefined,
  };
}

function uniqueSplinePoints(points: Vec2[], closed: boolean): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && officialDxfPointsCoincide(prev, p)) continue;
    out.push(p);
  }
  if (
    closed &&
    out.length >= 2 &&
    officialDxfPointsCoincide(out[0]!, out[out.length - 1]!)
  ) {
    out.pop();
  }
  return out;
}

function tessellateSpline(
  degree: number,
  control: Vec2[],
  knots: number[],
  weights: number[] | undefined,
  closedHint: boolean
): DxfEntity | null {
  const nSeg = dxfSplineSegmentCount(knotSpanCount(knots, degree, control.length));
  if (nSeg < 2) return null;
  const u0 = knots[degree]!;
  const u1 = knots[control.length]!;
  const domain = u1 - u0;
  if (!(domain > 0) || !Number.isFinite(domain)) return null;
  const raw: Vec2[] = [];
  for (let i = 0; i <= nSeg; i++) {
    const u = i === 0 ? u0 : i === nSeg ? u1 : u0 + (domain * i) / nSeg;
    const pt = evaluateDxfSpline(degree, control, knots, u, weights);
    if (!pt) return null;
    raw.push(pt);
  }
  if (raw.length < 2) return null;
  const closed =
    closedHint || officialDxfPointsCoincide(raw[0]!, raw[raw.length - 1]!);
  const points = uniqueSplinePoints(raw, closed);
  if (points.length < 2) return null;
  return closed ? closedPolylineEntity(points) : openPolylineEntity(points);
}

function normalizeSplineWeights(count: number, weights: number[]): number[] | null {
  if (weights.some((w) => !Number.isFinite(w))) return null;
  const w = weights.slice(0, count);
  while (w.length < count) w.push(1);
  if (w.every((v) => v === 0)) return null;
  return w;
}

function splineEntityFromParsed(
  flags: number,
  degree: number,
  control: Vec2[],
  knots: number[],
  weightsIn: number[]
): DxfEntity | null {
  if (!Number.isInteger(degree) || degree < 1) return null;
  const n = control.length;
  if (n < degree + 1) return null;
  if (control.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (knots.some((k) => !Number.isFinite(k))) return null;

  const periodic = (flags & 2) === 2;
  const closedFlag = (flags & 1) === 1 || periodic;
  const hasWeights = (flags & 4) === 4 || weightsIn.length > 0;
  let weights: number[] | undefined;
  if (hasWeights) {
    const norm = normalizeSplineWeights(n, weightsIn);
    if (!norm) return null;
    weights = norm;
  }

  const standardLen = n + degree + 1;
  const periodicLen = n + 1;
  let prepared: { control: Vec2[]; knots: number[]; weights?: number[] };
  if (knots.length === standardLen) {
    if (!knotsAreNonDecreasing(knots)) return null;
    prepared = { control, knots, weights };
  } else if (periodic && knots.length === periodicLen) {
    const expanded = expandPeriodicSpline(degree, control, knots, weights);
    if (!expanded) return null;
    prepared = expanded;
  } else {
    return null;
  }

  return tessellateSpline(
    degree,
    prepared.control,
    prepared.knots,
    prepared.weights,
    closedFlag
  );
}


/**
 * Intermediate vertices along a POLYLINE or LWPOLYLINE bulge (group 42).
 * Bulge = tan(included angle / 4); positive is CCW, negative is CW.
 * Endpoints are omitted — the caller already has the VERTEX points.
 */
export function tessellateDxfBulgeIntermediates(a: Vec2, b: Vec2, bulge: number): Vec2[] {
  if (!Number.isFinite(bulge) || bulge === 0) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (!(chord > 0)) return [];
  const theta = 4 * Math.atan(bulge);
  const n = dxfCurveSegmentCount(theta);
  if (n < 2) return [];
  const cotbce = (1 / bulge - bulge) / 2;
  const cx = (a.x + b.x - dy * cotbce) / 2;
  const cy = (a.y + b.y + dx * cotbce) / 2;
  const startRad = Math.atan2(a.y - cy, a.x - cx);
  const r = Math.hypot(a.x - cx, a.y - cy);
  if (!(r > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return [];
  const mid: Vec2[] = [];
  for (let i = 1; i < n; i++) {
    mid.push(pointOnCircle(cx, cy, r, startRad + (theta * i) / n));
  }
  return mid;
}

type PolyVertex = { x: number; y: number; bulge: number };

function polylineFromVertices(verts: PolyVertex[], closedByFlag: boolean): DxfEntity | null {
  if (verts.length < 2) return null;
  const closedByCoincide = officialDxfPointsCoincide(verts[0]!, verts[verts.length - 1]!);
  const closed = closedByFlag || closedByCoincide;
  const ring = closedByCoincide ? verts.slice(0, -1) : verts;
  if (ring.length < 2) return null;
  const points: Vec2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]!;
    points.push({ x: cur.x, y: cur.y });
    const isLast = i === ring.length - 1;
    if (isLast && !closed) break;
    const next = ring[(i + 1) % ring.length]!;
    points.push(...tessellateDxfBulgeIntermediates(cur, next, cur.bulge));
  }
  if (points.length < 2) return null;
  const entity: DxfEntity = { type: "polyline", points };
  if (closed) entity.closed = true;
  return entity;
}

function closedPolylineEntity(points: Vec2[]): DxfEntity | null {
  if (points.length < 2) return null;
  return { type: "polyline", points, closed: true };
}

function openPolylineEntity(points: Vec2[]): DxfEntity | null {
  if (points.length < 2) return null;
  return { type: "polyline", points };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Minimal ASCII DXF extractor for LINE, LWPOLYLINE (including group-42 bulges),
 * CIRCLE, ARC, ELLIPSE, SPLINE, and old-style POLYLINE (VERTEX + SEQEND, including
 * the closed flag and bulges). Curves are tessellated into official planar polyline
 * segments. ELLIPSE uses groups 10/20 (center), 11/21 (major-axis vector relative
 * to the center), 40 (radius ratio; the DXF spec gives no default, so a missing,
 * zero, or non-finite ratio is skipped rather than inventing 1.0), and 41/42
 * (start/end parameters in radians from the major axis; omitted values follow
 * the documented full-ellipse values 0 and 2π). A sweep within 1e-6 rad of 2π
 * is treated as a full closed ellipse so common decimal writings of 2π still
 * close. SPLINE uses groups 70 (flags: bit 1 closed, bit 2 periodic, bit 4
 * rational), 71 (degree), 72/73 (knot and control-point counts, informational),
 * 40 (knots), 41 (weights when rational or present), and 10/20 control points
 * (Z ignored). Evaluation is De Boor on the valid knot span, or rational /
 * projective De Boor when weights are present. A periodic spline stored with
 * knots = control points + 1 is expanded to a standard periodic B-spline;
 * AutoCAD’s already-clamped form (knots = control points + degree + 1) is
 * evaluated directly. Fit points (11/21), fit tangents, and tolerances are
 * not used; a SPLINE with no usable control points is skipped rather than
 * inventing a fit-point interpolant. A knot vector that is missing or the
 * wrong length for a clamped, unclamped, or periodic B-spline of that degree
 * is skipped. Extrusion (210/220/230) and Z are ignored (2D plan only, same as
 * CIRCLE / ARC). A non-mesh 3D POLYLINE (group 70 flag bit 8) is traced in
 * plan from VERTEX 10/20; Z (30) is ignored. An entity with group 67 = 1
 * is paperspace and is skipped — it is not displayed, snapped, bounded, or
 * used to create rooms. Group 67 omitted or 0 is model space and is kept.
 * 3D extrusion (210/220/230) is not applied. Polygon-mesh and polyface-mesh
 * POLYLINE entities are skipped.
 */
export function parseDxfEntities(text: string): DxfEntity[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entities: DxfEntity[] = [];
  let i = 0;

  const readPair = (): { code: number; value: string } | null => {
    if (i + 1 >= lines.length) return null;
    const code = Number(lines[i++]!.trim());
    const value = lines[i++] ?? "";
    if (!Number.isFinite(code)) return null;
    return { code, value: value.trim() };
  };

  const unreadPair = () => {
    i -= 2;
  };

  /** Read groups until the next entity (code 0), leaving that pair unread. */
  const readGroups = (onGroup: (code: number, value: string) => void) => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code === 0) {
        unreadPair();
        break;
      }
      onGroup(p.code, p.value);
    }
  };

  /**
   * Like readGroups, and return true when group 67 = 1 (DXF paperspace).
   * 67 omitted or 0 is model space.
   */
  const readEntityGroups = (onGroup: (code: number, value: string) => void): boolean => {
    let paperspace = false;
    readGroups((code, value) => {
      if (code === 67 && Number(value) === 1) paperspace = true;
      onGroup(code, value);
    });
    return paperspace;
  };

  const skipUntilSeqend = () => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code !== 0) continue;
      const t = p.value.toUpperCase();
      if (t === "SEQEND") {
        readGroups(() => {});
        break;
      }
    }
  };

  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code !== 0) continue;
    const type = pair.value.toUpperCase();

    if (type === "LINE") {
      let x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0;
      const paperspace = readEntityGroups((code, value) => {
        if (code === 10) x1 = Number(value);
        if (code === 20) y1 = Number(value);
        if (code === 11) x2 = Number(value);
        if (code === 21) y2 = Number(value);
      });
      if (paperspace) continue;
      entities.push({
        type: "line",
        points: [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ],
      });
    } else if (type === "LWPOLYLINE") {
      const verts: PolyVertex[] = [];
      let pending: { x?: number; y?: number; bulge: number } | null = null;
      let flags = 0;
      const flushPending = () => {
        if (
          pending &&
          pending.x != null &&
          pending.y != null &&
          isFiniteNumber(pending.x) &&
          isFiniteNumber(pending.y)
        ) {
          verts.push({
            x: pending.x,
            y: pending.y,
            bulge: isFiniteNumber(pending.bulge) ? pending.bulge : 0,
          });
        }
        pending = null;
      };
      const paperspace = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 10) {
          flushPending();
          pending = { x: Number(value), bulge: 0 };
        }
        if (code === 20 && pending) pending.y = Number(value);
        if (code === 42) {
          const bulge = Number(value);
          if (pending) pending.bulge = isFiniteNumber(bulge) ? bulge : 0;
        }
      });
      flushPending();
      if (paperspace) continue;
      const closedByFlag = Number.isFinite(flags) && (flags & 1) === 1;
      const entity = polylineFromVertices(verts, closedByFlag);
      if (entity) entities.push(entity);
    } else if (type === "CIRCLE") {
      let cx = 0,
        cy = 0,
        r = 0;
      const paperspace = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 40) r = Number(value);
      });
      if (paperspace) continue;
      if (isFiniteNumber(cx) && isFiniteNumber(cy) && isFiniteNumber(r) && r > 0) {
        const entity = closedPolylineEntity(tessellateCircle(cx, cy, r));
        if (entity) entities.push(entity);
      }
    } else if (type === "ARC") {
      let cx = 0,
        cy = 0,
        r = 0,
        startDeg = 0,
        endDeg = 0;
      const paperspace = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 40) r = Number(value);
        if (code === 50) startDeg = Number(value);
        if (code === 51) endDeg = Number(value);
      });
      if (paperspace) continue;
      if (
        isFiniteNumber(cx) &&
        isFiniteNumber(cy) &&
        isFiniteNumber(r) &&
        r > 0 &&
        isFiniteNumber(startDeg) &&
        isFiniteNumber(endDeg)
      ) {
        const { startRad, sweepRad } = dxfCcwSweepRad(startDeg, endDeg);
        if (sweepRad > 0) {
          const full = Math.abs(sweepRad - TAU) < 1e-12;
          const entity = full
            ? closedPolylineEntity(tessellateCircle(cx, cy, r, startRad))
            : openPolylineEntity(tessellateOpenArc(cx, cy, r, startRad, sweepRad));
          if (entity) entities.push(entity);
        }
      }

    } else if (type === "ELLIPSE") {
      let cx = 0,
        cy = 0,
        mx = 0,
        my = 0;
      let ratio: number | undefined;
      // Omitted 41/42 follow the DXF full-ellipse values 0 and 2π.
      let startParam = 0;
      let endParam = TAU;
      let hasRatio = false;
      const paperspace = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 11) mx = Number(value);
        if (code === 21) my = Number(value);
        if (code === 40) {
          ratio = Number(value);
          hasRatio = true;
        }
        if (code === 41) startParam = Number(value);
        if (code === 42) endParam = Number(value);
      });
      if (paperspace) continue;
      const majorLen = Math.hypot(mx, my);
      if (
        hasRatio &&
        ratio != null &&
        isFiniteNumber(cx) &&
        isFiniteNumber(cy) &&
        isFiniteNumber(mx) &&
        isFiniteNumber(my) &&
        isFiniteNumber(ratio) &&
        ratio > 0 &&
        majorLen > 0 &&
        isFiniteNumber(startParam) &&
        isFiniteNumber(endParam)
      ) {
        const major = { x: mx, y: my };
        const minor = ellipseMinorAxis(major, ratio);
        const { startRad, sweepRad } = dxfEllipseSweepRad(startParam, endParam);
        if (sweepRad > 0) {
          const full = sweepRad === TAU;
          const entity = full
            ? closedPolylineEntity(tessellateEllipse(cx, cy, major, minor, startRad))
            : openPolylineEntity(
                tessellateEllipticalArc(cx, cy, major, minor, startRad, sweepRad)
              );
          if (entity) entities.push(entity);
        }
      }
    } else if (type === "SPLINE") {
      let flags = 0;
      let degree = 0;
      const knots: number[] = [];
      const weights: number[] = [];
      const control: Vec2[] = [];
      let pending: { x?: number; y?: number } | null = null;
      const flushControl = () => {
        if (
          pending &&
          pending.x != null &&
          pending.y != null &&
          isFiniteNumber(pending.x) &&
          isFiniteNumber(pending.y)
        ) {
          control.push({ x: pending.x, y: pending.y });
        }
        pending = null;
      };
      const paperspace = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 71) degree = Number(value);
        if (code === 40) knots.push(Number(value));
        if (code === 41) weights.push(Number(value));
        if (code === 10) {
          flushControl();
          pending = { x: Number(value), y: 0 };
        }
        if (code === 20 && pending) pending.y = Number(value);
      });
      flushControl();
      if (paperspace) continue;
      if (Number.isFinite(flags) && Number.isFinite(degree)) {
        const entity = splineEntityFromParsed(flags, degree, control, knots, weights);
        if (entity) entities.push(entity);
      }
    } else if (type === "POLYLINE") {
      let flags = 0;
      const paperspace = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
      });
      const isMesh = Number.isFinite(flags) && ((flags & 16) === 16 || (flags & 64) === 64);
      const closedByFlag = Number.isFinite(flags) && (flags & 1) === 1;
      if (isMesh || paperspace) {
        skipUntilSeqend();
        continue;
      }
      const verts: PolyVertex[] = [];
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code !== 0) continue;
        const t = p.value.toUpperCase();
        if (t === "VERTEX") {
          let x = 0,
            y = 0,
            bulge = 0;
          readGroups((code, value) => {
            if (code === 10) x = Number(value);
            if (code === 20) y = Number(value);
            if (code === 42) bulge = Number(value);
          });
          if (isFiniteNumber(x) && isFiniteNumber(y)) {
            verts.push({
              x,
              y,
              bulge: isFiniteNumber(bulge) ? bulge : 0,
            });
          }
        } else if (t === "SEQEND") {
          readGroups(() => {});
          break;
        } else {
          unreadPair();
          break;
        }
      }
      const entity = polylineFromVertices(verts, closedByFlag);
      if (entity) entities.push(entity);
    }
  }

  return entities;
}

export function dxfBounds(entities: DxfEntity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const pts = entities.flatMap((e) => e.points);
  if (!pts.length) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
