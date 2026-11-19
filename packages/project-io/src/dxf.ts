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
  closedHint: boolean,
  extraParams?: number[]
): DxfEntity | null {
  const nSeg = dxfSplineSegmentCount(knotSpanCount(knots, degree, control.length));
  if (nSeg < 2) return null;
  const u0 = knots[degree]!;
  const u1 = knots[control.length]!;
  const domain = u1 - u0;
  if (!(domain > 0) || !Number.isFinite(domain)) return null;
  const us: number[] = [];
  for (let i = 0; i <= nSeg; i++) {
    us.push(i === 0 ? u0 : i === nSeg ? u1 : u0 + (domain * i) / nSeg);
  }
  if (extraParams) {
    for (const u of extraParams) {
      if (Number.isFinite(u) && u > u0 && u < u1) us.push(u);
    }
    us.sort((a, b) => a - b);
  }
  const raw: Vec2[] = [];
  for (const u of us) {
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

function controlPointSplineEntity(
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
 * Distinct fit points for interpolation. Consecutive copies (and a closed
 * first==last pair) are collapsed with officialDxfPointsCoincide. Any
 * non-finite coordinate makes the fit-point path unusable.
 */
function uniqueFitPoints(points: Vec2[], closed: boolean): Vec2[] | null {
  const out: Vec2[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
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

/**
 * Centripetal parameterization (α = 1/2), Lee 1989 / The NURBS Book.
 * Parameters are normalized to [0, 1]. For a closed curve the wrap-around
 * chord is included in the total length; the returned values are the
 * parameters of the distinct points (the last is < 1) and the period ends at 1.
 */
function centripetalParams(points: Vec2[], closed: boolean): number[] | null {
  const n = points.length;
  if (n < 2) return null;
  const segs = closed ? n : n - 1;
  const d: number[] = [];
  let total = 0;
  for (let i = 0; i < segs; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const li = Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y));
    if (!Number.isFinite(li)) return null;
    d.push(li);
    total += li;
  }
  if (!(total > 0) || !Number.isFinite(total)) return null;
  const u: number[] = [0];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += d[i]!;
    const ti = acc / total;
    if (!Number.isFinite(ti) || ti < u[u.length - 1]!) return null;
    u.push(ti);
  }
  if (!closed) u[n - 1] = 1;
  return u;
}

/** Clamped knot vector by parameter averaging (The NURBS Book 9.2.1). */
function clampedAveragingKnots(params: number[], degree: number): number[] | null {
  const m = params.length;
  const p = degree;
  if (m < p + 1) return null;
  const knots: number[] = [];
  const t0 = params[0]!;
  const t1 = params[m - 1]!;
  for (let i = 0; i <= p; i++) knots.push(t0);
  for (let j = 1; j <= m - p - 1; j++) {
    let s = 0;
    for (let i = j; i <= j + p - 1; i++) s += params[i]!;
    const knot = s / p;
    if (!Number.isFinite(knot)) return null;
    knots.push(knot);
  }
  for (let i = 0; i <= p; i++) knots.push(t1);
  if (knots.length !== m + p + 1) return null;
  if (!knotsAreNonDecreasing(knots)) return null;
  return knots;
}

/**
 * Knot vector for an open cubic interpolant with two end conditions
 * (natural and/or fit tangents): m+2 control points, clamped, with simple
 * interior knots at the interior centripetal parameters.
 */
function cubicEndConditionKnots(params: number[]): number[] | null {
  const m = params.length;
  if (m < 2) return null;
  const t0 = params[0]!;
  const t1 = params[m - 1]!;
  const knots: number[] = [t0, t0, t0, t0];
  for (let i = 1; i <= m - 2; i++) knots.push(params[i]!);
  knots.push(t1, t1, t1, t1);
  if (knots.length !== m + 6) return null;
  if (!knotsAreNonDecreasing(knots)) return null;
  return knots;
}

function compactPeriodicKnots(params: number[]): number[] | null {
  const knots = params.slice();
  knots.push(1);
  if (knots.length !== params.length + 1) return null;
  if (!knotsAreNonDecreasing(knots)) return null;
  if (!(knots[knots.length - 1]! > knots[0]!)) return null;
  return knots;
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (A.length !== n) return null;
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = A[i];
    if (!row || row.length !== n || !Number.isFinite(b[i]!)) return null;
    const copy = row.slice();
    copy.push(b[i]!);
    if (copy.some((v) => !Number.isFinite(v))) return null;
    let scale = 0;
    for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(copy[j]!));
    if (!(scale > 0)) {
      if (Math.abs(copy[n]!) > 1e-14) return null;
      return null;
    }
    for (let j = 0; j <= n; j++) copy[j] = copy[j]! / scale;
    M.push(copy);
  }
  for (let k = 0; k < n; k++) {
    let pivot = k;
    let best = Math.abs(M[k]![k]!);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i]![k]!);
      if (v > best) {
        best = v;
        pivot = i;
      }
    }
    if (!(best > 1e-12)) return null;
    if (pivot !== k) {
      const tmp = M[k]!;
      M[k] = M[pivot]!;
      M[pivot] = tmp;
    }
    const pk = M[k]![k]!;
    for (let i = k + 1; i < n; i++) {
      const f = M[i]![k]! / pk;
      if (!Number.isFinite(f)) return null;
      for (let j = k; j <= n; j++) {
        M[i]![j] = M[i]![j]! - f * M[k]![j]!;
      }
    }
  }
  const x: number[] = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i]![n]!;
    for (let j = i + 1; j < n; j++) s -= M[i]![j]! * x[j]!;
    const d = M[i]![i]!;
    if (!(Math.abs(d) > 1e-12) || !Number.isFinite(s)) return null;
    x[i] = s / d;
    if (!Number.isFinite(x[i]!)) return null;
  }
  return x;
}

function derivativeCurve(
  degree: number,
  control: Vec2[],
  knots: number[]
): { degree: number; control: Vec2[]; knots: number[] } | null {
  const n = control.length;
  const p = degree;
  if (p < 1 || n < 2) return null;
  const newControl: Vec2[] = [];
  for (let i = 0; i < n - 1; i++) {
    const denom = knots[i + p + 1]! - knots[i + 1]!;
    if (!Number.isFinite(denom)) return null;
    const s = denom === 0 ? 0 : p / denom;
    if (!Number.isFinite(s)) return null;
    const a = control[i]!;
    const b = control[i + 1]!;
    newControl.push({ x: s * (b.x - a.x), y: s * (b.y - a.y) });
  }
  const newKnots = knots.slice(1, knots.length - 1);
  if (newKnots.length !== newControl.length + (p - 1) + 1) return null;
  return { degree: p - 1, control: newControl, knots: newKnots };
}

function evaluateSplineDerivative(
  degree: number,
  control: Vec2[],
  knots: number[],
  u: number,
  order: number
): Vec2 | null {
  if (order < 0 || !Number.isInteger(order)) return null;
  if (order === 0) return evaluateDxfSpline(degree, control, knots, u);
  let cur: { degree: number; control: Vec2[]; knots: number[] } = {
    degree,
    control,
    knots,
  };
  for (let k = 0; k < order; k++) {
    const next = derivativeCurve(cur.degree, cur.control, cur.knots);
    if (!next) return null;
    cur = next;
  }
  return evaluateDxfSpline(cur.degree, cur.control, cur.knots, u);
}

function basisRow(
  degree: number,
  controlCount: number,
  knots: number[],
  u: number,
  order: number
): number[] | null {
  const row: number[] = [];
  for (let i = 0; i < controlCount; i++) {
    const unit: Vec2[] = [];
    for (let j = 0; j < controlCount; j++) unit.push({ x: j === i ? 1 : 0, y: 0 });
    const v = evaluateSplineDerivative(degree, unit, knots, u, order);
    if (!v || !Number.isFinite(v.x)) return null;
    row.push(v.x);
  }
  return row;
}

function solveControls(A: number[][], xs: number[], ys: number[]): Vec2[] | null {
  const cx = solveLinearSystem(A, xs);
  const cy = solveLinearSystem(A, ys);
  if (!cx || !cy || cx.length !== cy.length) return null;
  const pts: Vec2[] = [];
  for (let i = 0; i < cx.length; i++) {
    const x = cx[i]!;
    const y = cy[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    pts.push({ x, y });
  }
  return pts;
}

/** Tight metre check that a built interpolant actually hits every fit point. */
const FIT_INTERP_EPS_M = 1e-6;

function interpolantHitsFitPoints(
  degree: number,
  control: Vec2[],
  knots: number[],
  params: number[],
  points: Vec2[],
  closed: boolean
): boolean {
  if (params.length !== points.length) return false;
  for (let k = 0; k < points.length; k++) {
    const pt = evaluateDxfSpline(degree, control, knots, params[k]!);
    if (!pt || !officialDxfPointsCoincide(pt, points[k]!, FIT_INTERP_EPS_M)) return false;
  }
  if (closed) {
    const u0 = knots[degree];
    const u1 = knots[control.length];
    if (u0 == null || u1 == null) return false;
    const start = evaluateDxfSpline(degree, control, knots, u0);
    const end = evaluateDxfSpline(degree, control, knots, u1);
    if (!start || !end || !officialDxfPointsCoincide(start, end, FIT_INTERP_EPS_M)) {
      return false;
    }
  }
  return true;
}

function interpolateOpenFitSpline(
  points: Vec2[],
  degree: number,
  startTangent: Vec2 | undefined,
  endTangent: Vec2 | undefined
): DxfFitSplineInterpolant | null {
  const m = points.length;
  const p = degree;
  const params = centripetalParams(points, false);
  if (!params) return null;

  if (p === 1) {
    const knots = clampedAveragingKnots(params, 1);
    if (!knots) return null;
    if (!interpolantHitsFitPoints(1, points, knots, params, points, false)) return null;
    return { degree: 1, control: points.slice(), knots, params, closed: false };
  }

  // Open cubics use natural (C'' = 0) ends when a fit tangent is absent; a
  // present start (12/22) and/or end (13/23) tangent is used as dC/dt on the
  // normalized [0, 1] parameter and replaces that end's natural condition.
  // Other degrees use global interpolation with averaging knots (NURBS Book
  // 9.2.1) and do not consume fit tangents.
  if (p !== 3) {
    if (m < p + 1) return null;
    const knots = clampedAveragingKnots(params, p);
    if (!knots) return null;
    const A: number[][] = [];
    for (let k = 0; k < m; k++) {
      const row = basisRow(p, m, knots, params[k]!, 0);
      if (!row) return null;
      A.push(row);
    }
    const control = solveControls(
      A,
      points.map((q) => q.x),
      points.map((q) => q.y)
    );
    if (!control) return null;
    if (!interpolantHitsFitPoints(p, control, knots, params, points, false)) return null;
    return { degree: p, control, knots, params, closed: false };
  }

  const knots = cubicEndConditionKnots(params);
  if (!knots) return null;
  const nc = m + 2;
  const A: number[][] = [];
  const bx: number[] = [];
  const by: number[] = [];

  const startOrder = startTangent ? 1 : 2;
  const startRow = basisRow(p, nc, knots, params[0]!, startOrder);
  if (!startRow) return null;
  A.push(startRow);
  bx.push(startTangent ? startTangent.x : 0);
  by.push(startTangent ? startTangent.y : 0);

  for (let k = 0; k < m; k++) {
    const row = basisRow(p, nc, knots, params[k]!, 0);
    if (!row) return null;
    A.push(row);
    bx.push(points[k]!.x);
    by.push(points[k]!.y);
  }

  const endOrder = endTangent ? 1 : 2;
  const endRow = basisRow(p, nc, knots, params[m - 1]!, endOrder);
  if (!endRow) return null;
  A.push(endRow);
  bx.push(endTangent ? endTangent.x : 0);
  by.push(endTangent ? endTangent.y : 0);

  const control = solveControls(A, bx, by);
  if (!control) return null;
  if (!interpolantHitsFitPoints(p, control, knots, params, points, false)) return null;
  return { degree: p, control, knots, params, closed: false };
}

function interpolateClosedFitSpline(
  points: Vec2[],
  degree: number
): DxfFitSplineInterpolant | null {
  const m = points.length;
  const p = degree;
  // Periodic wrap in expandPeriodicSpline needs m >= p+1; a closed loop also
  // needs at least three distinct points.
  if (m < 3 || m < p + 1) return null;
  const params = centripetalParams(points, true);
  if (!params) return null;
  const compact = compactPeriodicKnots(params);
  if (!compact) return null;
  const expanded = expandPeriodicSpline(p, points, compact, undefined);
  if (!expanded) return null;
  const { knots } = expanded;
  const nExp = m + p;
  const A: number[][] = [];
  for (let k = 0; k < m; k++) {
    const full = basisRow(p, nExp, knots, params[k]!, 0);
    if (!full) return null;
    const row = new Array(m).fill(0);
    for (let j = 0; j < nExp; j++) {
      const i = j < m ? j : j - m;
      if (i < 0 || i >= m) return null;
      row[i] = row[i]! + full[j]!;
    }
    A.push(row);
  }
  const unique = solveControls(
    A,
    points.map((q) => q.x),
    points.map((q) => q.y)
  );
  if (!unique) return null;
  const prepared = expandPeriodicSpline(p, unique, compact, undefined);
  if (!prepared) return null;
  if (!interpolantHitsFitPoints(p, prepared.control, prepared.knots, params, points, true)) {
    return null;
  }
  return {
    degree: p,
    control: prepared.control,
    knots: prepared.knots,
    params,
    closed: true,
  };
}

export type DxfFitSplineInterpolant = {
  degree: number;
  control: Vec2[];
  knots: number[];
  /** Centripetal parameter of each distinct fit point, in [0, 1]. */
  params: number[];
  closed: boolean;
};

/**
 * Build a global interpolating B-spline through usable fit points (11/21).
 * Degree defaults to 3 when the value is not an integer ≥ 1. Closed or
 * periodic flags produce a periodic interpolant (fit tangents unused, so the
 * join stays C^{p-1}). Open cubics use natural or tangent end conditions as
 * documented on interpolateOpenFitSpline. The result is intended for
 * evaluateDxfSpline / tessellateSpline; this is not a second display path.
 */
export function interpolateDxfFitSpline(
  fitPoints: Vec2[],
  degree: number,
  opts?: {
    closed?: boolean;
    startTangent?: Vec2;
    endTangent?: Vec2;
  }
): DxfFitSplineInterpolant | null {
  const p = Number.isInteger(degree) && degree >= 1 ? degree : 3;
  const closed = !!opts?.closed;
  const unique = uniqueFitPoints(fitPoints, closed);
  if (!unique) return null;
  if (closed) return interpolateClosedFitSpline(unique, p);
  const st = opts?.startTangent;
  const et = opts?.endTangent;
  const startT =
    st && Number.isFinite(st.x) && Number.isFinite(st.y) ? st : undefined;
  const endT =
    et && Number.isFinite(et.x) && Number.isFinite(et.y) ? et : undefined;
  return interpolateOpenFitSpline(unique, p, startT, endT);
}

function fitPointSplineEntity(
  flags: number,
  degreeIn: number,
  fitPoints: Vec2[],
  fitInvalid: boolean,
  startTangent: Vec2 | null,
  endTangent: Vec2 | null
): DxfEntity | null {
  if (fitInvalid) return null;
  const periodic = (flags & 2) === 2;
  const closedFlag = (flags & 1) === 1 || periodic;
  const interp = interpolateDxfFitSpline(fitPoints, degreeIn, {
    closed: closedFlag,
    startTangent: startTangent ?? undefined,
    endTangent: endTangent ?? undefined,
  });
  if (!interp) return null;
  return tessellateSpline(
    interp.degree,
    interp.control,
    interp.knots,
    undefined,
    interp.closed,
    interp.params
  );
}

function splineEntityFromParsed(
  flags: number,
  degree: number,
  control: Vec2[],
  knots: number[],
  weightsIn: number[],
  fitPoints: Vec2[],
  fitInvalid: boolean,
  startTangent: Vec2 | null,
  endTangent: Vec2 | null
): DxfEntity | null {
  const fromControls = controlPointSplineEntity(flags, degree, control, knots, weightsIn);
  if (fromControls) return fromControls;
  return fitPointSplineEntity(
    flags,
    degree,
    fitPoints,
    fitInvalid,
    startTangent,
    endTangent
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

const MESH_FACE_AREA_EPS = 1e-12;

type PolylineVertexRecord = {
  x: number;
  y: number;
  flags: number;
  /** Raw POLYLINE face indices from groups 71–74, omitting 0 / non-finite. */
  faceIndices: number[];
};

function isPolyfaceFaceRecord(rec: PolylineVertexRecord): boolean {
  return rec.faceIndices.length > 0;
}

/** Closed plan face from mesh corners; skips degenerate or zero-area rings. */
function meshFaceEntity(corners: Vec2[]): DxfEntity | null {
  const ring: Vec2[] = [];
  for (const p of corners) {
    const prev = ring[ring.length - 1];
    if (prev && officialDxfPointsCoincide(prev, p)) continue;
    ring.push({ x: p.x, y: p.y });
  }
  if (ring.length >= 2 && officialDxfPointsCoincide(ring[0]!, ring[ring.length - 1]!)) {
    ring.pop();
  }
  if (ring.length < 3) return null;
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    twiceArea += p.x * q.y - q.x * p.y;
  }
  if (!(Math.abs(twiceArea) > MESH_FACE_AREA_EPS)) return null;
  return closedPolylineEntity(ring);
}

function entitiesFromPolygonMesh(
  recs: PolylineVertexRecord[],
  meshM: number,
  meshN: number,
  flags: number
): DxfEntity[] {
  const m = Number.isInteger(meshM) ? meshM : NaN;
  const n = Number.isInteger(meshN) ? meshN : NaN;
  if (!(m >= 2 && n >= 2)) return [];
  const verts = recs.filter((r) => !isPolyfaceFaceRecord(r));
  const closedM = (flags & 1) === 1;
  const closedN = (flags & 32) === 32;
  const at = (mi: number, ni: number): Vec2 | null => {
    const v = verts[mi * n + ni];
    return v ? { x: v.x, y: v.y } : null;
  };
  const out: DxfEntity[] = [];
  const mFaces = closedM ? m : m - 1;
  const nFaces = closedN ? n : n - 1;
  for (let mi = 0; mi < mFaces; mi++) {
    for (let ni = 0; ni < nFaces; ni++) {
      const m1 = closedM ? (mi + 1) % m : mi + 1;
      const n1 = closedN ? (ni + 1) % n : ni + 1;
      const corners = [at(mi, ni), at(m1, ni), at(m1, n1), at(mi, n1)];
      if (corners.some((c) => !c)) continue;
      const entity = meshFaceEntity(corners as Vec2[]);
      if (entity) out.push(entity);
    }
  }
  return out;
}

function entitiesFromPolyface(recs: PolylineVertexRecord[]): DxfEntity[] {
  const verts: PolylineVertexRecord[] = [];
  const faces: PolylineVertexRecord[] = [];
  for (const rec of recs) {
    if (isPolyfaceFaceRecord(rec)) faces.push(rec);
    else verts.push(rec);
  }
  const out: DxfEntity[] = [];
  for (const face of faces) {
    const corners: Vec2[] = [];
    let valid = true;
    for (const raw of face.faceIndices) {
      const idx = Math.abs(raw);
      if (!Number.isInteger(idx) || idx < 1 || idx > verts.length) {
        valid = false;
        break;
      }
      const v = verts[idx - 1]!;
      corners.push({ x: v.x, y: v.y });
    }
    if (!valid) continue;
    const entity = meshFaceEntity(corners);
    if (entity) out.push(entity);
  }
  return out;
}


type Vec3 = { x: number; y: number; z: number };

const DXF_DEFAULT_EXTRUSION: Vec3 = { x: 0, y: 0, z: 1 };
/** Autodesk Arbitrary Axis Algorithm: use world Y × N when N is almost ±world Z. */
const DXF_AAA_NEAR_Z = 1 / 64;

function isFiniteVec3(value: Vec3): boolean {
  return isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z);
}

function vec3Length(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function normalizeVec3(value: Vec3): Vec3 | null {
  const len = vec3Length(value);
  if (!(len > 0) || !Number.isFinite(len)) return null;
  return { x: value.x / len, y: value.y / len, z: value.z / len };
}

function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Resolve DXF groups 210/220/230. Omitted or a zero/non-finite vector means
 * the default world +Z extrusion (0, 0, 1).
 */
export function dxfExtrusionOrDefault(x: number, y: number, z: number, present: boolean): Vec3 {
  if (!present) return { ...DXF_DEFAULT_EXTRUSION };
  const raw = { x, y, z };
  if (!isFiniteVec3(raw) || !(vec3Length(raw) > 0)) return { ...DXF_DEFAULT_EXTRUSION };
  return normalizeVec3(raw) ?? { ...DXF_DEFAULT_EXTRUSION };
}

/** True when the normal is the default world +Z, so OCS already matches plan XY. */
export function dxfExtrusionIsDefaultWorldZ(n: Vec3): boolean {
  const u = normalizeVec3(n);
  if (!u) return false;
  return Math.abs(u.x) < 1e-12 && Math.abs(u.y) < 1e-12 && u.z > 0;
}

/**
 * Autodesk Arbitrary Axis Algorithm: OCS axes from the extrusion normal N.
 * When |Nx| and |Ny| are both < 1/64, Ax = world Y × N; otherwise Ax = world Z × N.
 * Ay = N × Ax.
 */
export function dxfArbitraryAxes(n: Vec3): { ax: Vec3; ay: Vec3; n: Vec3 } | null {
  const N = normalizeVec3(n);
  if (!N) return null;
  const wy: Vec3 = { x: 0, y: 1, z: 0 };
  const wz: Vec3 = { x: 0, y: 0, z: 1 };
  const axRaw =
    Math.abs(N.x) < DXF_AAA_NEAR_Z && Math.abs(N.y) < DXF_AAA_NEAR_Z
      ? crossVec3(wy, N)
      : crossVec3(wz, N);
  const ax = normalizeVec3(axRaw);
  if (!ax) return null;
  const ay = normalizeVec3(crossVec3(N, ax));
  if (!ay) return null;
  return { ax, ay, n: N };
}

/** Map an OCS point to WCS, then keep only the plan XY (WCS Z is ignored). */
export function dxfOcsToPlan(x: number, y: number, z: number, extrusion: Vec3): Vec2 | null {
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null;
  if (dxfExtrusionIsDefaultWorldZ(extrusion) && z === 0) return { x, y };
  const axes = dxfArbitraryAxes(extrusion);
  if (!axes) return null;
  const { ax, ay, n } = axes;
  const wx = x * ax.x + y * ay.x + z * n.x;
  const wy = x * ax.y + y * ay.y + z * n.y;
  if (!isFiniteNumber(wx) || !isFiniteNumber(wy)) return null;
  return { x: wx, y: wy };
}

function mapOcsEntityToPlan(
  entity: DxfEntity | null,
  extrusion: Vec3,
  elevation = 0
): DxfEntity | null {
  if (!entity) return null;
  if (dxfExtrusionIsDefaultWorldZ(extrusion) && elevation === 0) return entity;
  const points: Vec2[] = [];
  for (const p of entity.points) {
    const q = dxfOcsToPlan(p.x, p.y, elevation, extrusion);
    if (!q) return null;
    points.push(q);
  }
  return { ...entity, points };
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
 * evaluated directly. When usable control points are present, fit points
 * (11/21) and fit tangents (12/22, 13/23) are unused. If there are no usable
 * control points but there are usable fit points, a global interpolating
 * B-spline is built through the distinct fit points (centripetal
 * parameterization, α = 1/2, parameters on [0, 1]) and tessellated with the
 * same evaluateDxfSpline / dxfSplineSegmentCount pipeline. Degree comes from
 * group 71 when it is an integer ≥ 1, otherwise cubic (3). Open cubics use
 * natural (C'' = 0) ends, or a present start and/or end fit tangent as dC/dt
 * on [0, 1]. Closed (bit 1) or periodic (bit 2) flags produce a periodic
 * interpolant with no gap at the join; fit tangents are then ignored.
 * Tolerances (42/43/44) are unused. The interpolant is skipped when it cannot
 * be built correctly (too few distinct fit points for the degree, non-finite
 * coordinates, a singular system, or a result that misses the fit points).
 * A knot vector that is missing or the
 * wrong length for a clamped, unclamped, or periodic B-spline of that degree
 * is skipped. A non-mesh 3D POLYLINE (group 70 flag bit 8) is traced in
 * plan from VERTEX 10/20; Z (30) is ignored. An entity with group 67 = 1
 * is paperspace and is skipped — it is not displayed, snapped, bounded, or
 * used to create rooms. Group 67 omitted or 0 is model space and is kept.
 * 3D extrusion (210/220/230) is applied for CIRCLE, ARC, ELLIPSE,
 * LWPOLYLINE, and 2D POLYLINE (including bulge tessellation, which is done
 * in OCS before the transform). LINE, SPLINE, 3D POLYLINE, and mesh vertices
 * stay in WCS; Z is still ignored after any transform. Polygon-mesh (group 70 bit 16)
 * and polyface-mesh (group 70 bit 64) POLYLINE entities are traced in plan:
 * each mesh face is emitted as a closed polyline from VERTEX 10/20, and Z
 * (30) is ignored. Polygon-mesh M and N counts are groups 71 and 72; closed
 * in M is flag bit 1, closed in N is flag bit 32. Polyface faces use VERTEX
 * groups 71–74 as 1-based vertex indices (a negative index still contributes
 * the edge). A mesh with no usable face, and a paperspace mesh, are skipped.
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
  const readEntityGroups = (
    onGroup: (code: number, value: string) => void
  ): { paperspace: boolean; extrusion: Vec3 } => {
    let paperspace = false;
    let ex = 0,
      ey = 0,
      ez = 1;
    let hasExtrusion = false;
    readGroups((code, value) => {
      if (code === 67 && Number(value) === 1) paperspace = true;
      if (code === 210) {
        ex = Number(value);
        hasExtrusion = true;
      }
      if (code === 220) {
        ey = Number(value);
        hasExtrusion = true;
      }
      if (code === 230) {
        ez = Number(value);
        hasExtrusion = true;
      }
      onGroup(code, value);
    });
    return {
      paperspace,
      extrusion: dxfExtrusionOrDefault(ex, ey, ez, hasExtrusion),
    };
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
      const { paperspace } = readEntityGroups((code, value) => {
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
      let elevation = 0;
      const { paperspace, extrusion } = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 38) elevation = Number(value);
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
      const elev = isFiniteNumber(elevation) ? elevation : 0;
      const entity = mapOcsEntityToPlan(
        polylineFromVertices(verts, closedByFlag),
        extrusion,
        elev
      );
      if (entity) entities.push(entity);
    } else if (type === "CIRCLE") {
      let cx = 0,
        cy = 0,
        cz = 0,
        r = 0;
      const { paperspace, extrusion } = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 30) cz = Number(value);
        if (code === 40) r = Number(value);
      });
      if (paperspace) continue;
      if (isFiniteNumber(cx) && isFiniteNumber(cy) && isFiniteNumber(r) && r > 0) {
        const elev = isFiniteNumber(cz) ? cz : 0;
        const entity = mapOcsEntityToPlan(
          closedPolylineEntity(tessellateCircle(cx, cy, r)),
          extrusion,
          elev
        );
        if (entity) entities.push(entity);
      }
    } else if (type === "ARC") {
      let cx = 0,
        cy = 0,
        cz = 0,
        r = 0,
        startDeg = 0,
        endDeg = 0;
      const { paperspace, extrusion } = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 30) cz = Number(value);
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
          const elev = isFiniteNumber(cz) ? cz : 0;
          const entity = mapOcsEntityToPlan(
            full
              ? closedPolylineEntity(tessellateCircle(cx, cy, r, startRad))
              : openPolylineEntity(tessellateOpenArc(cx, cy, r, startRad, sweepRad)),
            extrusion,
            elev
          );
          if (entity) entities.push(entity);
        }
      }

    } else if (type === "ELLIPSE") {
      let cx = 0,
        cy = 0,
        cz = 0,
        mx = 0,
        my = 0,
        mz = 0;
      let ratio: number | undefined;
      // Omitted 41/42 follow the DXF full-ellipse values 0 and 2π.
      let startParam = 0;
      let endParam = TAU;
      let hasRatio = false;
      const { paperspace, extrusion } = readEntityGroups((code, value) => {
        if (code === 10) cx = Number(value);
        if (code === 20) cy = Number(value);
        if (code === 30) cz = Number(value);
        if (code === 11) mx = Number(value);
        if (code === 21) my = Number(value);
        if (code === 31) mz = Number(value);
        if (code === 40) {
          ratio = Number(value);
          hasRatio = true;
        }
        if (code === 41) startParam = Number(value);
        if (code === 42) endParam = Number(value);
      });
      if (paperspace) continue;
      const czIn = isFiniteNumber(cz) ? cz : 0;
      const mzIn = isFiniteNumber(mz) ? mz : 0;
      const usePlanEllipse =
        dxfExtrusionIsDefaultWorldZ(extrusion) && czIn === 0 && mzIn === 0;
      const majorLen = usePlanEllipse
        ? Math.hypot(mx, my)
        : Math.hypot(mx, my, mzIn);
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
        const { startRad, sweepRad } = dxfEllipseSweepRad(startParam, endParam);
        if (sweepRad > 0) {
          if (usePlanEllipse) {
            const major = { x: mx, y: my };
            const minor = ellipseMinorAxis(major, ratio);
            const full = sweepRad === TAU;
            const entity = full
              ? closedPolylineEntity(tessellateEllipse(cx, cy, major, minor, startRad))
              : openPolylineEntity(
                  tessellateEllipticalArc(cx, cy, major, minor, startRad, sweepRad)
                );
            if (entity) entities.push(entity);
          } else {
            const axes = dxfArbitraryAxes(extrusion);
            if (axes) {
              const major3: Vec3 = { x: mx, y: my, z: mzIn };
              const minorRaw = crossVec3(axes.n, major3);
              const minorLen = vec3Length(minorRaw);
              if (minorLen > 0) {
                const scale = (majorLen * ratio) / minorLen;
                const minor3: Vec3 = {
                  x: minorRaw.x * scale,
                  y: minorRaw.y * scale,
                  z: minorRaw.z * scale,
                };
                const count = dxfCurveSegmentCount(sweepRad);
                const pts: Vec2[] = [];
                const last = sweepRad === TAU ? count : count + 1;
                for (let s = 0; s < last; s++) {
                  const t = startRad + (sweepRad * s) / count;
                  const c = Math.cos(t);
                  const si = Math.sin(t);
                  pts.push({
                    x: cx + major3.x * c + minor3.x * si,
                    y: cy + major3.y * c + minor3.y * si,
                  });
                }
                const entity =
                  sweepRad === TAU
                    ? closedPolylineEntity(pts)
                    : openPolylineEntity(pts);
                if (entity) entities.push(entity);
              }
            }
          }
        }
      }
    } else if (type === "SPLINE") {
      let flags = 0;
      let degree = 0;
      const knots: number[] = [];
      const weights: number[] = [];
      const control: Vec2[] = [];
      const fitPoints: Vec2[] = [];
      let fitInvalid = false;
      let pending: { x?: number; y?: number } | null = null;
      let pendingFit: { x?: number; y?: number } | null = null;
      let startTx: number | undefined;
      let startTy: number | undefined;
      let endTx: number | undefined;
      let endTy: number | undefined;
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
      const flushFit = () => {
        if (pendingFit && pendingFit.x != null && pendingFit.y != null) {
          if (isFiniteNumber(pendingFit.x) && isFiniteNumber(pendingFit.y)) {
            fitPoints.push({ x: pendingFit.x, y: pendingFit.y });
          } else {
            fitInvalid = true;
          }
        }
        pendingFit = null;
      };
      const { paperspace } = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 71) degree = Number(value);
        if (code === 40) knots.push(Number(value));
        if (code === 41) weights.push(Number(value));
        if (code === 10) {
          flushControl();
          pending = { x: Number(value), y: 0 };
        }
        if (code === 20 && pending) pending.y = Number(value);
        if (code === 11) {
          flushFit();
          pendingFit = { x: Number(value), y: 0 };
        }
        if (code === 21 && pendingFit) pendingFit.y = Number(value);
        if (code === 12) startTx = Number(value);
        if (code === 22) startTy = Number(value);
        if (code === 13) endTx = Number(value);
        if (code === 23) endTy = Number(value);
      });
      flushControl();
      flushFit();
      if (paperspace) continue;
      const flagsIn = Number.isFinite(flags) ? flags : 0;
      const startTangent =
        startTx != null &&
        startTy != null &&
        isFiniteNumber(startTx) &&
        isFiniteNumber(startTy)
          ? { x: startTx, y: startTy }
          : null;
      const endTangent =
        endTx != null && endTy != null && isFiniteNumber(endTx) && isFiniteNumber(endTy)
          ? { x: endTx, y: endTy }
          : null;
      const entity = splineEntityFromParsed(
        flagsIn,
        degree,
        control,
        knots,
        weights,
        fitPoints,
        fitInvalid,
        startTangent,
        endTangent
      );
      if (entity) entities.push(entity);
    } else if (type === "POLYLINE") {
      let flags = 0;
      let meshM = NaN;
      let meshN = NaN;
      let elevation = 0;
      const { paperspace, extrusion } = readEntityGroups((code, value) => {
        if (code === 70) flags = Number(value);
        if (code === 71) meshM = Number(value);
        if (code === 72) meshN = Number(value);
        if (code === 38) elevation = Number(value);
      });
      const closedByFlag = Number.isFinite(flags) && (flags & 1) === 1;
      const isPolyface = Number.isFinite(flags) && (flags & 64) === 64;
      const isPolygonMesh = !isPolyface && Number.isFinite(flags) && (flags & 16) === 16;
      if (paperspace) {
        skipUntilSeqend();
        continue;
      }
      if (isPolyface || isPolygonMesh) {
        const recs: PolylineVertexRecord[] = [];
        while (i < lines.length) {
          const p = readPair();
          if (!p) break;
          if (p.code !== 0) continue;
          const t = p.value.toUpperCase();
          if (t === "VERTEX") {
            let x = 0,
              y = 0,
              vertFlags = 0;
            const faceIndices: number[] = [];
            readGroups((code, value) => {
              if (code === 10) x = Number(value);
              if (code === 20) y = Number(value);
              if (code === 70) vertFlags = Number(value);
              if (code === 71 || code === 72 || code === 73 || code === 74) {
                const idx = Number(value);
                if (Number.isFinite(idx) && idx !== 0) faceIndices.push(idx);
              }
            });
            if (faceIndices.length > 0 || (isFiniteNumber(x) && isFiniteNumber(y))) {
              recs.push({
                x: isFiniteNumber(x) ? x : 0,
                y: isFiniteNumber(y) ? y : 0,
                flags: Number.isFinite(vertFlags) ? vertFlags : 0,
                faceIndices,
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
        const meshEntities = isPolyface
          ? entitiesFromPolyface(recs)
          : entitiesFromPolygonMesh(recs, meshM, meshN, flags);
        entities.push(...meshEntities);
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
      const is3dPoly = Number.isFinite(flags) && (flags & 8) === 8;
      const elev = isFiniteNumber(elevation) ? elevation : 0;
      const entity = is3dPoly
        ? polylineFromVertices(verts, closedByFlag)
        : mapOcsEntityToPlan(polylineFromVertices(verts, closedByFlag), extrusion, elev);
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
