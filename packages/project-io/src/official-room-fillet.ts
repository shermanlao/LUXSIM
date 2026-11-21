import { DXF_CURVE_SEGMENTS_PER_TURN, tessellateCircularArcIntermediates } from "./dxf";
import { officialPointInPolygonInclusive } from "./official-room-union";
import { officialDxfPointsCoincide } from "./official-dxf-polyline";
import {
  officialRoomRingVertices,
  officialSetRoomPolygon,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
import type { FixtureInstance, ProjectSceneV2, Vec2 } from "./types";

/** Radians; a corner flatter or sharper than this is treated as already straight. */
export const FILLET_STRAIGHT_EPS_RAD = 1e-9;

export const FILLET_CORNER_PICK_ROOM_STATUS =
  "Select a room on this storey, then a corner handle to fillet. Esc cancels.";

export const FILLET_CORNER_PICK_CORNER_STATUS =
  "Select a corner handle to fillet. Esc cancels.";

export const FILLET_CORNER_CANCELLED_STATUS = "Fillet corner cancelled.";

export const FILLET_CORNER_REFUSE_RADIUS_STATUS =
  "Fillet corner refused: enter a radius greater than 0.";

export const FILLET_CORNER_REFUSE_MISSING_STATUS =
  "Fillet corner refused: a room is missing.";

export const FILLET_CORNER_REFUSE_STOREY_STATUS =
  "Fillet corner refused: the room must be on the current storey.";

export const FILLET_CORNER_REFUSE_CORNER_STATUS =
  "Fillet corner refused: select a corner handle.";

export const FILLET_CORNER_REFUSE_STRAIGHT_STATUS =
  "Fillet corner refused: that corner is already straight.";

export const FILLET_CORNER_REFUSE_TOO_LARGE_STATUS =
  "Fillet corner refused: the radius is too large for the adjacent edges or arcs.";

export const FILLET_CORNER_REFUSE_AREA_STATUS =
  "Fillet corner refused: the room area would be below 0.01 m².";

export const FILLET_CORNER_REFUSE_CROSS_STATUS =
  "Fillet corner refused: the room outline would cross itself.";

export const FILLET_CORNER_REFUSE_VERTICES_STATUS =
  "Fillet corner refused: the room would have fewer than 3 unique corners.";

export const FILLET_CORNER_REFUSE_INVALID_STATUS =
  "Fillet corner refused: the result would not be a single simple room.";

export function formatFilletCornerSuccessStatus(name: string): string {
  return `Filleted a corner of “${name}”.`;
}

export const FILLET_ALL_CORNERS_PICK_ROOM_STATUS =
  "Select a room on this storey to fillet all corners. Esc cancels.";

export const FILLET_ALL_CORNERS_CANCELLED_STATUS = "Fillet all corners cancelled.";

export const FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS =
  "Fillet all corners refused: enter a radius greater than 0.";

export const FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS =
  "Fillet all corners refused: a room is missing.";

export const FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS =
  "Fillet all corners refused: the room must be on the current storey.";

export const FILLET_ALL_CORNERS_REFUSE_STRAIGHT_STATUS =
  "Fillet all corners refused: every remaining corner is already straight (no sharp corner to fillet).";

export const FILLET_ALL_CORNERS_REFUSE_TOO_LARGE_STATUS =
  "Fillet all corners refused: the radius is too large for the adjacent edges or arcs.";

export const FILLET_ALL_CORNERS_REFUSE_AREA_STATUS =
  "Fillet all corners refused: the room area would be below 0.01 m².";

export const FILLET_ALL_CORNERS_REFUSE_CROSS_STATUS =
  "Fillet all corners refused: the room outline would cross itself.";

export const FILLET_ALL_CORNERS_REFUSE_VERTICES_STATUS =
  "Fillet all corners refused: the room would have fewer than 3 unique corners.";

export const FILLET_ALL_CORNERS_REFUSE_INVALID_STATUS =
  "Fillet all corners refused: the result would not be a single simple room.";

export function formatFilletAllCornersSuccessStatus(name: string): string {
  return `Filleted all corners of “${name}”.`;
}

/** Radians; official tessellation steps may differ slightly from 2π/48. */
const FILLET_TESSELLATION_STEP_EPS_RAD = 0.04;

export type OfficialFilletCornerReason =
  | "radius"
  | "missing"
  | "storey"
  | "corner"
  | "straight"
  | "too-large"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialPolygonFilletResult =
  | { ok: true; polygon: Vec2[] }
  | {
      ok: false;
      reason: Exclude<OfficialFilletCornerReason, "missing" | "storey">;
    };

export type OfficialFilletRoomCornerResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      roomId: string;
      vertexIndex: number;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialFilletCornerReason;
    };

export type OfficialFilletAllCornersReason = Exclude<OfficialFilletCornerReason, "corner">;

export type OfficialPolygonFilletAllResult =
  | { ok: true; polygon: Vec2[] }
  | {
      ok: false;
      reason: Exclude<OfficialFilletAllCornersReason, "missing" | "storey">;
    };

export type OfficialFilletRoomAllCornersResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      roomId: string;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialFilletAllCornersReason;
    };

function clonePt(p: Vec2): Vec2 {
  return { x: p.x, y: p.y };
}

function refuseStatus(reason: OfficialFilletCornerReason): string {
  switch (reason) {
    case "radius":
      return FILLET_CORNER_REFUSE_RADIUS_STATUS;
    case "missing":
      return FILLET_CORNER_REFUSE_MISSING_STATUS;
    case "storey":
      return FILLET_CORNER_REFUSE_STOREY_STATUS;
    case "corner":
      return FILLET_CORNER_REFUSE_CORNER_STATUS;
    case "straight":
      return FILLET_CORNER_REFUSE_STRAIGHT_STATUS;
    case "too-large":
      return FILLET_CORNER_REFUSE_TOO_LARGE_STATUS;
    case "self-crossing":
      return FILLET_CORNER_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return FILLET_CORNER_REFUSE_VERTICES_STATUS;
    case "area":
      return FILLET_CORNER_REFUSE_AREA_STATUS;
    default:
      return FILLET_CORNER_REFUSE_INVALID_STATUS;
  }
}

function refuseAllStatus(reason: OfficialFilletAllCornersReason): string {
  switch (reason) {
    case "radius":
      return FILLET_ALL_CORNERS_REFUSE_RADIUS_STATUS;
    case "missing":
      return FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS;
    case "storey":
      return FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS;
    case "straight":
      return FILLET_ALL_CORNERS_REFUSE_STRAIGHT_STATUS;
    case "too-large":
      return FILLET_ALL_CORNERS_REFUSE_TOO_LARGE_STATUS;
    case "self-crossing":
      return FILLET_ALL_CORNERS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return FILLET_ALL_CORNERS_REFUSE_VERTICES_STATUS;
    case "area":
      return FILLET_ALL_CORNERS_REFUSE_AREA_STATUS;
    default:
      return FILLET_ALL_CORNERS_REFUSE_INVALID_STATUS;
  }
}

/** Shorter signed sweep from startRad to endRad, in (-π, π]. */
export function officialShortSweepRad(startRad: number, endRad: number): number {
  let sweep = endRad - startRad;
  const tau = Math.PI * 2;
  while (sweep <= -Math.PI) sweep += tau;
  while (sweep > Math.PI) sweep -= tau;
  return sweep;
}

type OfficialCornerFilletBuild =
  | {
      ok: true;
      t1: Vec2;
      t2: Vec2;
      mid: Vec2[];
      /** Corner ring index this fillet replaces. */
      cornerIndex: number;
      /** Last ring vertex kept on the left entity (at or before t1). */
      leftKeepIndex: number;
      /** First ring vertex kept on the right entity (at or after t2). */
      rightKeepIndex: number;
      /** Trim distance from the corner along the left entity (metres). */
      trimLeft: number;
      /** Trim distance from the corner along the right entity (metres). */
      trimRight: number;
      /** Full left-entity length from the corner to the far end (metres). */
      leftLen: number;
      /** Full right-entity length from the corner to the far end (metres). */
      rightLen: number;
      leftKind: "line" | "arc";
      rightKind: "line" | "arc";
      /** Far ring index of the left entity. */
      leftFarIndex: number;
      /** Far ring index of the right entity. */
      rightFarIndex: number;
    }
  | {
      ok: false;
      reason: Exclude<OfficialFilletCornerReason, "missing" | "storey">;
    };

type CircularRun = {
  /** Inclusive start index in the ring (along increasing index). */
  start: number;
  /** Inclusive end index in the ring (along increasing index; may wrap). */
  end: number;
  center: Vec2;
  radius: number;
  /** Signed step between consecutive tessellation vertices. */
  stepRad: number;
};

type SideEntity =
  | {
      kind: "line";
      /** Far endpoint (away from the corner). */
      far: Vec2;
      farIndex: number;
      corner: Vec2;
      cornerIndex: number;
      len: number;
      /** Unit from corner toward far. */
      uAway: Vec2;
    }
  | {
      kind: "arc";
      center: Vec2;
      radius: number;
      corner: Vec2;
      cornerIndex: number;
      far: Vec2;
      farIndex: number;
      /** Inclusive indices from corner toward far along the ring walk used. */
      indices: number[];
      /** Signed sweep from corner to far along the arc. */
      sweepRad: number;
      len: number;
      /** Unit tangent at the corner pointing away along the arc. */
      uAway: Vec2;
      stepRad: number;
    };

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function cross2(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function normalize(a: Vec2): Vec2 | null {
  const len = Math.hypot(a.x, a.y);
  if (!(len > 0)) return null;
  return { x: a.x / len, y: a.y / len };
}

/**
 * True when a, b, c are two consecutive official / DXF circular tessellation
 * chords (same centre, same radius, same signed step near 2π/48). Short DXF
 * arcs that force n=2 may use a slightly larger step; still require equal
 * steps and reject regular-polygon steps well above the official budget.
 */
function isOfficialFilletTessellationChordPair(a: Vec2, b: Vec2, c: Vec2): boolean {
  const center = circumcenterOf(a, b, c);
  if (!center) return false;
  const r = Math.hypot(a.x - center.x, a.y - center.y);
  if (!(r > 0)) return false;
  if (Math.abs(Math.hypot(b.x - center.x, b.y - center.y) - r) > 1e-7) return false;
  if (Math.abs(Math.hypot(c.x - center.x, c.y - center.y) - r) > 1e-7) return false;
  const angA = Math.atan2(a.y - center.y, a.x - center.x);
  const angB = Math.atan2(b.y - center.y, b.x - center.x);
  const angC = Math.atan2(c.y - center.y, c.x - center.x);
  const s1 = officialShortSweepRad(angA, angB);
  const s2 = officialShortSweepRad(angB, angC);
  if (!(Math.abs(s1) > 0) || !(Math.abs(s2) > 0)) return false;
  if (Math.sign(s1) !== Math.sign(s2)) return false;
  if (Math.abs(s1 - s2) > FILLET_TESSELLATION_STEP_EPS_RAD) return false;
  const step = (Math.PI * 2) / DXF_CURVE_SEGMENTS_PER_TURN;
  // Official and normal DXF steps are ~2π/48. Allow up to ~1.5× for short
  // n=2 DXF arcs; reject larger steps (e.g. regular hexagon / octagon).
  const maxStep = step * 1.5 + FILLET_TESSELLATION_STEP_EPS_RAD;
  const abs = Math.abs(s1);
  return abs >= step * 0.25 && abs <= maxStep;
}

function circularRunFromChordPair(
  ring: Vec2[],
  i: number
): CircularRun | null {
  const n = ring.length;
  const a = ring[i]!;
  const b = ring[(i + 1) % n]!;
  const c = ring[(i + 2) % n]!;
  if (!isOfficialFilletTessellationChordPair(a, b, c)) return null;
  const center = circumcenterOf(a, b, c)!;
  const radius = Math.hypot(a.x - center.x, a.y - center.y);
  const angA = Math.atan2(a.y - center.y, a.x - center.x);
  const angB = Math.atan2(b.y - center.y, b.x - center.x);
  const stepRad = officialShortSweepRad(angA, angB);

  let start = i;
  let end = (i + 2) % n;

  // Extend backward
  for (;;) {
    const prev = (start - 1 + n) % n;
    const p0 = ring[prev]!;
    const p1 = ring[start]!;
    if (Math.abs(Math.hypot(p0.x - center.x, p0.y - center.y) - radius) > 1e-7) break;
    const ang0 = Math.atan2(p0.y - center.y, p0.x - center.x);
    const ang1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const s = officialShortSweepRad(ang0, ang1);
    if (Math.abs(s - stepRad) > FILLET_TESSELLATION_STEP_EPS_RAD) break;
    start = prev;
    if (start === end) break;
  }
  // Extend forward
  for (;;) {
    const next = (end + 1) % n;
    const p0 = ring[end]!;
    const p1 = ring[next]!;
    if (Math.abs(Math.hypot(p1.x - center.x, p1.y - center.y) - radius) > 1e-7) break;
    const ang0 = Math.atan2(p0.y - center.y, p0.x - center.x);
    const ang1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const s = officialShortSweepRad(ang0, ang1);
    if (Math.abs(s - stepRad) > FILLET_TESSELLATION_STEP_EPS_RAD) break;
    end = next;
    if (end === start) break;
  }
  return { start, end, center, radius, stepRad };
}

/** Maximal circular runs on the ring (may wrap). Overlapping detections merge. */
function findCircularRuns(ring: Vec2[]): CircularRun[] {
  const n = ring.length;
  const runs: CircularRun[] = [];
  if (n < 3) return runs;
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const run = circularRunFromChordPair(ring, i);
    if (!run) continue;
    const key = `${run.start}|${run.end}|${run.center.x.toFixed(9)}|${run.center.y.toFixed(9)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    runs.push(run);
  }
  return runs;
}

function runIndexSet(run: CircularRun, n: number): Set<number> {
  const s = new Set<number>();
  let i = run.start;
  for (;;) {
    s.add(i);
    if (i === run.end) break;
    i = (i + 1) % n;
  }
  return s;
}

function runVertexCount(run: CircularRun, n: number): number {
  let count = 1;
  let i = run.start;
  while (i !== run.end) {
    i = (i + 1) % n;
    count++;
    if (count > n) break;
  }
  return count;
}

/**
 * Unit tangent at `at` on the arc, pointing toward `toward`. Uses the short
 * signed sweep from `at` to `toward` (the direction along the run to the far
 * end), not the run's global step sign — at a run end the walk back is opposite
 * the original tessellation step.
 */
function arcTangentAway(
  center: Vec2,
  radius: number,
  at: Vec2,
  toward: Vec2,
  stepRad: number
): Vec2 | null {
  void stepRad;
  const ang0 = Math.atan2(at.y - center.y, at.x - center.x);
  const ang1 = Math.atan2(toward.y - center.y, toward.x - center.x);
  const sweep = officialShortSweepRad(ang0, ang1);
  if (!(Math.abs(sweep) > 1e-12)) return null;
  const sign = Math.sign(sweep);
  const rx = (at.x - center.x) / radius;
  const ry = (at.y - center.y) / radius;
  const t = sign > 0 ? { x: -ry, y: rx } : { x: ry, y: -rx };
  return normalize(t);
}

function sideEntityToward(
  ring: Vec2[],
  cornerIndex: number,
  direction: 1 | -1,
  runs: CircularRun[]
): SideEntity | null {
  const n = ring.length;
  const corner = ring[cornerIndex]!;
  const nextIdx = (cornerIndex + direction + n) % n;
  const next = ring[nextIdx]!;

  // Prefer an arc run that includes corner and next.
  for (const run of runs) {
    const set = runIndexSet(run, n);
    if (!set.has(cornerIndex) || !set.has(nextIdx)) continue;
    // Build indices from corner toward far end of this run in `direction`.
    const indices: number[] = [cornerIndex];
    let i = cornerIndex;
    for (;;) {
      i = (i + direction + n) % n;
      if (!set.has(i)) {
        // Stepped past the run
        indices.pop();
        break;
      }
      indices.push(i);
      if (i === run.start || i === run.end) {
        // Reached a run endpoint. If the endpoint is the corner, continue was wrong.
        if (i === cornerIndex) break;
        // Far end when the other endpoint is behind us — stop at whichever
        // endpoint we hit that is not the corner.
        break;
      }
      if (indices.length > n) break;
    }
    if (indices.length < 2) continue;
    // Ensure far is the run endpoint away from corner
    const farIndex = indices[indices.length - 1]!;
    // If both run endpoints are in indices and corner is one endpoint, good.
    // If corner is interior to the run, this side walk still goes to one end;
    // the other direction will get the other end — caller detects same-run.
    const far = ring[farIndex]!;
    const uAway = arcTangentAway(run.center, run.radius, corner, far, run.stepRad);
    if (!uAway) continue;
    const ang0 = Math.atan2(corner.y - run.center.y, corner.x - run.center.x);
    const ang1 = Math.atan2(far.y - run.center.y, far.x - run.center.x);
    // Short sweep toward the far end (may oppose the original tessellation step
    // when walking back from a run endpoint).
    const sweepRad = officialShortSweepRad(ang0, ang1);
    const len = Math.abs(sweepRad) * run.radius;
    if (!(len > 0)) continue;
    return {
      kind: "arc",
      center: clonePt(run.center),
      radius: run.radius,
      corner: clonePt(corner),
      cornerIndex,
      far: clonePt(far),
      farIndex,
      indices: [...indices],
      sweepRad,
      len,
      uAway,
      stepRad: run.stepRad,
    };
  }

  // Straight edge to the immediate neighbour.
  const len = dist(corner, next);
  if (!(len > 0)) return null;
  const uAway = normalize(sub(next, corner));
  if (!uAway) return null;
  return {
    kind: "line",
    far: clonePt(next),
    farIndex: nextIdx,
    corner: clonePt(corner),
    cornerIndex,
    len,
    uAway,
  };
}

function lineCircleIntersections(
  origin: Vec2,
  dir: Vec2,
  center: Vec2,
  radius: number
): Vec2[] {
  // Points origin + t*dir with |p - center| = radius, |dir|=1
  const f = sub(origin, center);
  const b = dot(f, dir);
  const c = dot(f, f) - radius * radius;
  const disc = b * b - c;
  if (disc < -1e-12) return [];
  const s = Math.sqrt(Math.max(0, disc));
  const out: Vec2[] = [];
  for (const t of [-b - s, -b + s]) {
    out.push(add(origin, scale(dir, t)));
  }
  return out;
}

function circleCircleIntersections(
  c1: Vec2,
  r1: number,
  c2: Vec2,
  r2: number
): Vec2[] {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-14)) return [];
  if (d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < -1e-9) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const mx = c1.x + (a * dx) / d;
  const my = c1.y + (a * dy) / d;
  if (h < 1e-14) return [{ x: mx, y: my }];
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  return [
    { x: mx + rx, y: my + ry },
    { x: mx - rx, y: my - ry },
  ];
}

type OffsetLocus =
  | { kind: "line"; origin: Vec2; dir: Vec2; normal: Vec2 }
  | { kind: "circle"; center: Vec2; radius: number };

function entityOffsetLocus(entity: SideEntity, radiusM: number, bis: Vec2): OffsetLocus | null {
  if (entity.kind === "line") {
    // Normal toward the fillet wedge (bisector side).
    const n1 = { x: -entity.uAway.y, y: entity.uAway.x };
    const n2 = { x: entity.uAway.y, y: -entity.uAway.x };
    const normal = dot(n1, bis) >= dot(n2, bis) ? n1 : n2;
    const nu = normalize(normal);
    if (!nu) return null;
    return {
      kind: "line",
      origin: add(entity.corner, scale(nu, radiusM)),
      dir: entity.uAway,
      normal: nu,
    };
  }
  // Arc: interior toward bis ⇒ concentric |R − r|; otherwise R + r.
  const toCenter = sub(entity.center, entity.corner);
  const towardInterior = dot(toCenter, bis) > 0;
  const R = entity.radius;
  const r = radiusM;
  let offsetR: number;
  if (towardInterior) {
    offsetR = R - r;
    if (!(offsetR > 1e-12)) return null;
  } else {
    offsetR = R + r;
  }
  return { kind: "circle", center: clonePt(entity.center), radius: offsetR };
}

function intersectLoci(a: OffsetLocus, b: OffsetLocus): Vec2[] {
  if (a.kind === "line" && b.kind === "line") {
    // Solve originA + t dA = originB + s dB
    const det = cross2(a.dir, b.dir);
    if (Math.abs(det) < 1e-12) return [];
    const diff = sub(b.origin, a.origin);
    const t = cross2(diff, b.dir) / det;
    return [add(a.origin, scale(a.dir, t))];
  }
  if (a.kind === "line" && b.kind === "circle") {
    return lineCircleIntersections(a.origin, a.dir, b.center, b.radius);
  }
  if (a.kind === "circle" && b.kind === "line") {
    return lineCircleIntersections(b.origin, b.dir, a.center, a.radius);
  }
  if (a.kind === "circle" && b.kind === "circle") {
    return circleCircleIntersections(a.center, a.radius, b.center, b.radius);
  }
  return [];
}

function tangentPointOnEntity(entity: SideEntity, filletCenter: Vec2, radiusM: number): Vec2 | null {
  if (entity.kind === "line") {
    const toCf = sub(filletCenter, entity.corner);
    const t = dot(toCf, entity.uAway);
    return add(entity.corner, scale(entity.uAway, t));
  }
  const R = entity.radius;
  const O = entity.center;
  const cfToO = sub(filletCenter, O);
  const sep = Math.hypot(cfToO.x, cfToO.y);
  if (!(sep > 1e-14)) return null;
  // External |Cf-O|=R+r → T = O + R*normalize(Cf-O).
  // Internal |Cf-O|=|R-r|: R≥r → same ray; r>R → opposite ray.
  if (Math.abs(sep - (R + radiusM)) < 1e-4) {
    return add(O, scale(cfToO, R / sep));
  }
  if (Math.abs(sep - Math.abs(R - radiusM)) < 1e-4) {
    if (R >= radiusM) {
      return add(O, scale(cfToO, R / sep));
    }
    return add(O, scale(cfToO, -R / sep));
  }
  return add(O, scale(cfToO, R / sep));
}

function pointOnArcSweep(entity: Extract<SideEntity, { kind: "arc" }>, p: Vec2): boolean {
  if (Math.abs(dist(p, entity.center) - entity.radius) > 1e-6) return false;
  const angC = Math.atan2(entity.corner.y - entity.center.y, entity.corner.x - entity.center.x);
  const angP = Math.atan2(p.y - entity.center.y, p.x - entity.center.x);
  const total = entity.sweepRad;
  if (!(Math.abs(total) > 1e-14)) return false;
  // Progress from corner toward far along the same signed sense as sweepRad.
  let along = angP - angC;
  const tau = Math.PI * 2;
  if (total > 0) {
    while (along < 0) along += tau;
    while (along >= tau) along -= tau;
  } else {
    while (along > 0) along -= tau;
    while (along <= -tau) along += tau;
  }
  const absAlong = Math.abs(along);
  const absTotal = Math.abs(total);
  if (absAlong < 1e-10) return false; // at corner — not a strict trim
  if (absAlong > absTotal + 1e-8) return false;
  return Math.sign(along) === Math.sign(total) || absAlong < 1e-10;
}

function trimParamOnEntity(entity: SideEntity, t: Vec2): number | null {
  if (entity.kind === "line") {
    const along = dot(sub(t, entity.corner), entity.uAway);
    if (!(along > 1e-12) || along >= entity.len - 1e-12) return null;
    // Must lie on the segment
    const proj = add(entity.corner, scale(entity.uAway, along));
    if (dist(proj, t) > 1e-6) return null;
    return along;
  }
  if (!pointOnArcSweep(entity, t)) return null;
  const angC = Math.atan2(entity.corner.y - entity.center.y, entity.corner.x - entity.center.x);
  const angT = Math.atan2(t.y - entity.center.y, t.x - entity.center.x);
  let sweep = officialShortSweepRad(angC, angT);
  const tau = Math.PI * 2;
  if (Math.sign(sweep) !== Math.sign(entity.sweepRad) && Math.abs(sweep) > 1e-12) {
    sweep = sweep > 0 ? sweep - tau : sweep + tau;
  }
  const arcLen = Math.abs(sweep) * entity.radius;
  if (!(arcLen > 1e-12) || arcLen >= entity.len - 1e-12) return null;
  return arcLen;
}

function keepIndexForTrim(entity: SideEntity, t: Vec2, ring: Vec2[]): number {
  // Last/first ring vertex still kept on this entity beyond the trim point.
  if (entity.kind === "line") {
    return entity.farIndex; // far is the only other vertex; always kept
  }
  // Arc: find the first index from far back toward corner that is on the
  // kept side of T (at or beyond T away from corner).
  const angC = Math.atan2(entity.corner.y - entity.center.y, entity.corner.x - entity.center.x);
  const angT = Math.atan2(t.y - entity.center.y, t.x - entity.center.x);
  let sweepT = officialShortSweepRad(angC, angT);
  const tau = Math.PI * 2;
  if (Math.sign(sweepT) !== Math.sign(entity.sweepRad) && Math.abs(sweepT) > 1e-12) {
    sweepT = sweepT > 0 ? sweepT - tau : sweepT + tau;
  }
  const absT = Math.abs(sweepT);
  // Walk indices from corner toward far; last vertex with sweep <= absT is before/at T.
  // rightKeep / leftKeep should be the first vertex at or past T toward far.
  let keep = entity.farIndex;
  for (let k = 1; k < entity.indices.length; k++) {
    const idx = entity.indices[k]!;
    const p = ring[idx]!;
    const angP = Math.atan2(p.y - entity.center.y, p.x - entity.center.x);
    let sweepP = officialShortSweepRad(angC, angP);
    if (Math.sign(sweepP) !== Math.sign(entity.sweepRad) && Math.abs(sweepP) > 1e-12) {
      sweepP = sweepP > 0 ? sweepP - tau : sweepP + tau;
    }
    if (Math.abs(sweepP) + 1e-10 >= absT) {
      keep = idx;
      break;
    }
  }
  return keep;
}

/**
 * Geometry of one official corner fillet against the given ring. Adjacent
 * sides may be straight edges or recognized circular-arc runs (official
 * fillet / DXF ARC·CIRCLE·bulge tessellation). Radius is metres.
 */
function officialCornerFilletBuild(
  ring: Vec2[],
  vertexIndex: number,
  radiusM: number
): OfficialCornerFilletBuild {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) {
    return { ok: false, reason: "radius" };
  }
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0) {
    return { ok: false, reason: "corner" };
  }
  const n = ring.length;
  if (n < 3 || vertexIndex >= n) {
    return { ok: false, reason: "corner" };
  }

  const runs = findCircularRuns(ring);
  const left = sideEntityToward(ring, vertexIndex, -1, runs);
  const right = sideEntityToward(ring, vertexIndex, 1, runs);
  if (!left || !right) {
    return { ok: false, reason: "straight" };
  }

  // Interior to a single arc run ⇒ already G1 along the arc.
  if (
    left.kind === "arc" &&
    right.kind === "arc" &&
    dist(left.center, right.center) < 1e-7 &&
    Math.abs(left.radius - right.radius) < 1e-7
  ) {
    return { ok: false, reason: "straight" };
  }

  const u1 = left.uAway;
  const u2 = right.uAway;
  const cr = cross2(u1, u2);
  const dp = dot(u1, u2);
  const alpha = Math.atan2(Math.abs(cr), dp);
  if (
    !Number.isFinite(alpha) ||
    alpha < FILLET_STRAIGHT_EPS_RAD ||
    Math.PI - alpha < FILLET_STRAIGHT_EPS_RAD
  ) {
    return { ok: false, reason: "straight" };
  }

  const bisRaw = add(u1, u2);
  const bis = normalize(bisRaw);
  if (!bis) {
    return { ok: false, reason: "straight" };
  }

  // Fast path: both lines — same closed form as the original official fillet.
  if (left.kind === "line" && right.kind === "line") {
    const half = alpha / 2;
    const tanHalf = Math.tan(half);
    const sinHalf = Math.sin(half);
    if (!(tanHalf > 0) || !(sinHalf > 0)) {
      return { ok: false, reason: "straight" };
    }
    const d = radiusM / tanHalf;
    if (!(d > 0) || !Number.isFinite(d) || !(d < left.len) || !(d < right.len)) {
      return { ok: false, reason: "too-large" };
    }
    const B = ring[vertexIndex]!;
    const t1: Vec2 = { x: B.x + u1.x * d, y: B.y + u1.y * d };
    const t2: Vec2 = { x: B.x + u2.x * d, y: B.y + u2.y * d };
    const centerDist = radiusM / sinHalf;
    const cx = B.x + bis.x * centerDist;
    const cy = B.y + bis.y * centerDist;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      return { ok: false, reason: "invalid" };
    }
    const startRad = Math.atan2(t1.y - cy, t1.x - cx);
    const endRad = Math.atan2(t2.y - cy, t2.x - cx);
    const sweepRad = officialShortSweepRad(startRad, endRad);
    if (!Number.isFinite(sweepRad) || !(Math.abs(sweepRad) > 0)) {
      return { ok: false, reason: "invalid" };
    }
    const mid = tessellateCircularArcIntermediates(cx, cy, radiusM, startRad, sweepRad);
    return {
      ok: true,
      t1,
      t2,
      mid,
      cornerIndex: vertexIndex,
      leftKeepIndex: left.farIndex,
      rightKeepIndex: right.farIndex,
      trimLeft: d,
      trimRight: d,
      leftLen: left.len,
      rightLen: right.len,
      leftKind: "line",
      rightKind: "line",
      leftFarIndex: left.farIndex,
      rightFarIndex: right.farIndex,
    };
  }

  const locA = entityOffsetLocus(left, radiusM, bis);
  const locB = entityOffsetLocus(right, radiusM, bis);
  if (!locA || !locB) {
    return { ok: false, reason: "too-large" };
  }
  const candidates = intersectLoci(locA, locB);
  if (candidates.length === 0) {
    return { ok: false, reason: "too-large" };
  }
  const B = ring[vertexIndex]!;
  // Pick the centre on the fillet-wedge side closest to the corner; when two
  // hits are equally close, prefer the one farther along the bisector.
  let best: Vec2 | null = null;
  let bestAlong = -Infinity;
  let bestDist = Infinity;
  for (const p of candidates) {
    const along = dot(sub(p, B), bis);
    if (!(along > 1e-9)) continue;
    const d = dist(p, B);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && along > bestAlong)) {
      bestAlong = along;
      bestDist = d;
      best = p;
    }
  }
  if (!best || !Number.isFinite(bestDist)) {
    return { ok: false, reason: "too-large" };
  }
  const cf = best;

  const t1 = tangentPointOnEntity(left, cf, radiusM);
  const t2 = tangentPointOnEntity(right, cf, radiusM);
  if (!t1 || !t2) {
    return { ok: false, reason: "too-large" };
  }
  // Snap tangent points onto the true entity distance
  if (Math.abs(dist(cf, t1) - radiusM) > 1e-4 || Math.abs(dist(cf, t2) - radiusM) > 1e-4) {
    return { ok: false, reason: "invalid" };
  }

  const trimLeft = trimParamOnEntity(left, t1);
  const trimRight = trimParamOnEntity(right, t2);
  if (trimLeft == null || trimRight == null) {
    return { ok: false, reason: "too-large" };
  }

  const startRad = Math.atan2(t1.y - cf.y, t1.x - cf.x);
  const endRad = Math.atan2(t2.y - cf.y, t2.x - cf.x);
  const sweepRad = officialShortSweepRad(startRad, endRad);
  if (!Number.isFinite(sweepRad) || !(Math.abs(sweepRad) > 0)) {
    return { ok: false, reason: "invalid" };
  }
  // Fillet sweep should lie in the wedge; reject inverted solutions.
  const midProbe = {
    x: cf.x + radiusM * Math.cos(startRad + sweepRad / 2),
    y: cf.y + radiusM * Math.sin(startRad + sweepRad / 2),
  };
  if (dot(sub(midProbe, B), bis) < -1e-6) {
    // Try the long way — should not happen with short sweep; refuse.
    return { ok: false, reason: "invalid" };
  }

  const mid = tessellateCircularArcIntermediates(cf.x, cf.y, radiusM, startRad, sweepRad);

  let leftKeepIndex: number;
  let rightKeepIndex: number;
  if (left.kind === "line") {
    leftKeepIndex = left.farIndex;
  } else {
    // Keep vertices from far back to the first at/past t1; leftKeep is the
    // vertex immediately before the trimmed stretch when walking to the corner
    // — i.e. the keep side away from corner. For reconstruction we need the
    // last kept vertex before t1 when walking toward the corner from far.
    // Using keepIndexForTrim from far: first at/past t1 from corner = right-like.
    // For left arc, "keep" boundary from the far side:
    leftKeepIndex = keepIndexForTrim(left, t1, ring);
  }
  if (right.kind === "line") {
    rightKeepIndex = right.farIndex;
  } else {
    rightKeepIndex = keepIndexForTrim(right, t2, ring);
  }

  return {
    ok: true,
    t1,
    t2,
    mid,
    cornerIndex: vertexIndex,
    leftKeepIndex,
    rightKeepIndex,
    trimLeft,
    trimRight,
    leftLen: left.len,
    rightLen: right.len,
    leftKind: left.kind,
    rightKind: right.kind,
    leftFarIndex: left.farIndex,
    rightFarIndex: right.farIndex,
  };
}

function circumcenterOf(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return { x: cx, y: cy };
}

/**
 * Vertices that should be skipped by Fillet all: interior points of a
 * recognized circular run, and run endpoints that are already G1-tangent to
 * the neighbouring non-run edge (official fillet trim points). A sharp
 * line–arc joint at a run endpoint is NOT skipped.
 */
function officialAlreadyFilletedVertexMask(ring: Vec2[]): boolean[] {
  const n = ring.length;
  const skip = Array.from({ length: n }, () => false);
  if (n < 3) return skip;
  for (const run of findCircularRuns(ring)) {
    if (runVertexCount(run, n) < 3) continue;
    const set = runIndexSet(run, n);
    for (const idx of set) {
      if (idx !== run.start && idx !== run.end) {
        skip[idx] = true;
        continue;
      }
      // Endpoint: skip only when the outside neighbour is G1 with the arc.
      const outside = idx === run.start ? (idx - 1 + n) % n : (idx + 1) % n;
      if (set.has(outside)) {
        // Closed full-circle run — treat as already smooth.
        skip[idx] = true;
        continue;
      }
      const at = ring[idx]!;
      const outPt = ring[outside]!;
      const along = normalize(sub(outPt, at));
      if (!along) {
        skip[idx] = true;
        continue;
      }
      const towardInside =
        idx === run.start
          ? ring[(idx + 1) % n]!
          : ring[(idx - 1 + n) % n]!;
      const tangent = arcTangentAway(run.center, run.radius, at, towardInside, run.stepRad);
      if (!tangent) {
        skip[idx] = true;
        continue;
      }
      // G1 when the outside edge continues opposite the inward arc tangent
      // (dot ≈ -1) or along it (dot ≈ 1) within a small angle.
      const align = Math.abs(dot(along, tangent));
      if (align > 1 - 1e-6) {
        skip[idx] = true;
      }
    }
  }
  return skip;
}

function removedIndicesForFillet(
  ringLen: number,
  built: Extract<OfficialCornerFilletBuild, { ok: true }>
): Set<number> {
  const drop = new Set<number>();
  const n = ringLen;
  let x = (built.leftKeepIndex + 1) % n;
  while (x !== built.rightKeepIndex) {
    drop.add(x);
    x = (x + 1) % n;
    if (drop.size > n) break;
  }
  // Always drop the corner itself
  drop.add(built.cornerIndex);
  return drop;
}

/**
 * Replace one closed-ring corner with tangent points and a tessellated
 * interior circular arc (no stored bulge). Adjacent sides may be straight
 * edges or recognized circular-arc runs. The arc centre sits in the
 * smaller-angle wedge so a convex room corner is cut off and a concave
 * (reflex) corner is rounded with the arc facing the room interior.
 * Radius is metres. A mid-edge point is not a corner and should not be
 * passed as vertexIndex — vertexIndex is a ring-corner index.
 */
export function filletOfficialRoomCorner(
  polygon: Vec2[],
  vertexIndex: number,
  radiusM: number
): OfficialPolygonFilletResult {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) {
    return { ok: false, reason: "radius" };
  }
  if (!Number.isInteger(vertexIndex) || vertexIndex < 0) {
    return { ok: false, reason: "corner" };
  }
  const ring = officialRoomRingVertices(polygon);
  const n = ring.length;
  if (n < 3 || vertexIndex >= n) {
    return { ok: false, reason: "corner" };
  }

  const built = officialCornerFilletBuild(ring, vertexIndex, radiusM);
  if (!built.ok) return built;

  const closed =
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!);

  const drop = removedIndicesForFillet(n, built);
  const next: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    if (i === built.cornerIndex) {
      next.push(clonePt(built.t1), ...built.mid.map(clonePt), clonePt(built.t2));
      continue;
    }
    if (drop.has(i)) continue;
    // Avoid duplicating a trim point that lands exactly on a kept ring vertex.
    if (
      officialDxfPointsCoincide(ring[i]!, built.t1) ||
      officialDxfPointsCoincide(ring[i]!, built.t2)
    ) {
      continue;
    }
    next.push(clonePt(ring[i]!));
  }
  if (closed && next[0]) {
    next.push(clonePt(next[0]));
  }

  const check = validateStretchedRoomPolygon(next);
  if (!check.ok) {
    if (check.reason === "area") return { ok: false, reason: "area" };
    if (check.reason === "self-crossing") return { ok: false, reason: "self-crossing" };
    return { ok: false, reason: "degenerate-vertices" };
  }
  return { ok: true, polygon: next };
}

/**
 * Fillet every remaining sharp corner of a simple official room polygon in
 * one pass, computed against the original outline. Already-straight and
 * already-filleted (G1 circular-run) corners are skipped. Remaining sharp
 * line–line, line–arc, and arc–arc junctions are filleted. If any remaining
 * sharp corner cannot be filleted at this radius (including when two trims
 * would overlap on the same edge or arc), the whole command is refused and
 * the polygon is unchanged. Radius is metres.
 */
export function filletOfficialRoomAllCorners(
  polygon: Vec2[],
  radiusM: number
): OfficialPolygonFilletAllResult {
  if (!(Number.isFinite(radiusM) && radiusM > 0)) {
    return { ok: false, reason: "radius" };
  }
  const ring = officialRoomRingVertices(polygon);
  const n = ring.length;
  if (n < 3) {
    return { ok: false, reason: "degenerate-vertices" };
  }

  const alreadyFilleted = officialAlreadyFilletedVertexMask(ring);
  const builds: Array<Extract<OfficialCornerFilletBuild, { ok: true }> | null> = Array.from(
    { length: n },
    () => null
  );
  for (let i = 0; i < n; i++) {
    if (alreadyFilleted[i]) continue;
    const built = officialCornerFilletBuild(ring, i, radiusM);
    if (!built.ok) {
      if (built.reason === "straight") continue;
      if (built.reason === "corner") return { ok: false, reason: "invalid" };
      return { ok: false, reason: built.reason };
    }
    builds[i] = built;
  }

  if (!builds.some((b) => b != null)) {
    return { ok: false, reason: "straight" };
  }

  // All-or-nothing overlap: any two fillets that share an entity must fit.
  for (let i = 0; i < n; i++) {
    const a = builds[i];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = builds[j];
      if (!b) continue;
      // Share left/right far endpoints ⇒ same edge or same arc end.
      const share =
        a.rightFarIndex === b.leftFarIndex ||
        a.leftFarIndex === b.rightFarIndex ||
        a.rightFarIndex === b.rightFarIndex ||
        a.leftFarIndex === b.leftFarIndex ||
        (a.rightFarIndex === b.cornerIndex && b.leftFarIndex === a.cornerIndex) ||
        (b.rightFarIndex === a.cornerIndex && a.leftFarIndex === b.cornerIndex);
      // Adjacent corners on a shared line/arc: classic case i and next sharp.
      const adjacentAlongRing =
        (a.rightFarIndex === b.cornerIndex && b.leftFarIndex === a.cornerIndex) ||
        (b.rightFarIndex === a.cornerIndex && a.leftFarIndex === b.cornerIndex) ||
        // line-line neighbours: far of a.right is b's corner when right is the single edge
        (a.rightKind === "line" && a.rightFarIndex === b.cornerIndex) ||
        (b.rightKind === "line" && b.rightFarIndex === a.cornerIndex) ||
        (a.leftKind === "line" && a.leftFarIndex === b.cornerIndex) ||
        (b.leftKind === "line" && b.leftFarIndex === a.cornerIndex);

      if (!share && !adjacentAlongRing) continue;

      // If a's right entity ends at b (or is the edge a→b):
      if (
        (a.rightKind === "line" && a.rightFarIndex === b.cornerIndex) ||
        (b.leftKind === "line" && b.leftFarIndex === a.cornerIndex) ||
        (a.rightFarIndex === b.cornerIndex && b.leftFarIndex === a.cornerIndex)
      ) {
        const len = a.rightLen;
        if (!(a.trimRight + b.trimLeft < len)) {
          return { ok: false, reason: "too-large" };
        }
      }
      if (
        (b.rightKind === "line" && b.rightFarIndex === a.cornerIndex) ||
        (a.leftKind === "line" && a.leftFarIndex === b.cornerIndex) ||
        (b.rightFarIndex === a.cornerIndex && a.leftFarIndex === b.cornerIndex)
      ) {
        const len = b.rightLen;
        if (!(b.trimRight + a.trimLeft < len)) {
          return { ok: false, reason: "too-large" };
        }
      }
      // Shared arc between two junctions
      if (a.rightKind === "arc" && b.leftKind === "arc" && a.rightFarIndex === b.leftFarIndex) {
        // Same arc run from a to far and b to same far — unusual; check lengths
        if (a.rightFarIndex === b.leftFarIndex && a.cornerIndex !== b.cornerIndex) {
          // If both trim the same arc toward a common far, they may be opposite ends
        }
      }
      if (
        a.rightKind === "arc" &&
        b.leftKind === "arc" &&
        a.rightFarIndex === b.cornerIndex &&
        b.leftFarIndex === a.cornerIndex
      ) {
        const len = a.rightLen;
        if (!(a.trimRight + b.trimLeft < len)) {
          return { ok: false, reason: "too-large" };
        }
      }
      if (
        b.rightKind === "arc" &&
        a.leftKind === "arc" &&
        b.rightFarIndex === a.cornerIndex &&
        a.leftFarIndex === b.cornerIndex
      ) {
        const len = b.rightLen;
        if (!(b.trimRight + a.trimLeft < len)) {
          return { ok: false, reason: "too-large" };
        }
      }
    }
  }

  // Also keep the original adjacent-edge check for pure line neighbours
  for (let i = 0; i < n; i++) {
    const a = builds[i];
    const b = builds[(i + 1) % n];
    if (!a || !b) continue;
    if (a.rightKind === "line" && b.leftKind === "line" && a.rightFarIndex === b.cornerIndex) {
      const P = ring[i]!;
      const Q = ring[(i + 1) % n]!;
      const len = Math.hypot(Q.x - P.x, Q.y - P.y);
      if (!(a.trimRight + b.trimLeft < len)) {
        return { ok: false, reason: "too-large" };
      }
    }
  }

  const closed =
    polygon.length >= 2 &&
    officialDxfPointsCoincide(polygon[0]!, polygon[polygon.length - 1]!);

  const drop = new Set<number>();
  for (const built of builds) {
    if (!built) continue;
    for (const idx of removedIndicesForFillet(n, built)) {
      drop.add(idx);
    }
  }

  const next: Vec2[] = [];
  const trimPoints: Vec2[] = [];
  for (const built of builds) {
    if (!built) continue;
    trimPoints.push(built.t1, built.t2);
  }
  for (let i = 0; i < n; i++) {
    const built = builds[i];
    if (built) {
      next.push(clonePt(built.t1), ...built.mid.map(clonePt), clonePt(built.t2));
      continue;
    }
    if (drop.has(i)) continue;
    if (trimPoints.some((p) => officialDxfPointsCoincide(ring[i]!, p))) continue;
    next.push(clonePt(ring[i]!));
  }
  if (closed && next[0]) {
    next.push(clonePt(next[0]));
  }

  const check = validateStretchedRoomPolygon(next);
  if (!check.ok) {
    if (check.reason === "area") return { ok: false, reason: "area" };
    if (check.reason === "self-crossing") return { ok: false, reason: "self-crossing" };
    return { ok: false, reason: "degenerate-vertices" };
  }
  return { ok: true, polygon: next };
}

function unassignFixturesAfterFillet(
  instances: FixtureInstance[],
  roomId: string,
  ring: Vec2[],
  storeyId: string
): FixtureInstance[] {
  return instances.map((inst) => {
    if (inst.roomId !== roomId) return inst;
    const xy = { x: inst.position.x, y: inst.position.y };
    if (officialPointInPolygonInclusive(xy, ring)) return inst;
    return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
  });
}

/**
 * Fillet one corner of an official room on the current storey. The room
 * keeps its id, name, and other official properties; its polygon becomes
 * the filleted simple ring. Fixtures assigned to the room whose XY no
 * longer lie in the new outline have roomId cleared; fixtures still inside
 * keep their assignment and are not moved. Luminaires are never deleted.
 * Calculation results are left as they are — this helper only updates the
 * scene. A refused call returns the same scene object unchanged.
 */
export function officialFilletRoomCorner(
  scene: ProjectSceneV2,
  roomId: string,
  vertexIndex: number,
  radiusM: number
): OfficialFilletRoomCornerResult {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) {
    return {
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (room.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: FILLET_CORNER_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const filleted = filletOfficialRoomCorner(room.polygon, vertexIndex, radiusM);
  if (!filleted.ok) {
    return {
      ok: false,
      scene,
      status: refuseStatus(filleted.reason),
      reason: filleted.reason,
    };
  }

  const polygon = filleted.polygon.map(clonePt);
  const withPolygon = officialSetRoomPolygon(scene, roomId, polygon);
  const instances = unassignFixturesAfterFillet(
    withPolygon.instances,
    roomId,
    officialRoomRingVertices(polygon),
    storeyId
  );

  return {
    ok: true,
    scene: {
      ...withPolygon,
      instances,
      ui: { ...withPolygon.ui },
    },
    status: formatFilletCornerSuccessStatus(room.name),
    roomId,
    vertexIndex,
    polygon,
  };
}

/**
 * Fillet every remaining sharp corner of an official room on the current
 * storey, in one command. The room keeps its id, name, and other official
 * properties; its polygon becomes the filleted simple ring. Already-straight
 * and already-filleted corners are skipped. The command is all-or-nothing:
 * if any remaining sharp corner cannot be filleted at the given radius, the
 * same scene object is returned unchanged. Fixtures assigned to the room
 * whose XY no longer lie in the new outline have roomId cleared; fixtures
 * still inside keep their assignment and are not moved. Luminaires are never
 * deleted. Calculation results are left as they are.
 */
export function officialFilletRoomAllCorners(
  scene: ProjectSceneV2,
  roomId: string,
  radiusM: number
): OfficialFilletRoomAllCornersResult {
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) {
    return {
      ok: false,
      scene,
      status: FILLET_ALL_CORNERS_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (room.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: FILLET_ALL_CORNERS_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const filleted = filletOfficialRoomAllCorners(room.polygon, radiusM);
  if (!filleted.ok) {
    return {
      ok: false,
      scene,
      status: refuseAllStatus(filleted.reason),
      reason: filleted.reason,
    };
  }

  const polygon = filleted.polygon.map(clonePt);
  const withPolygon = officialSetRoomPolygon(scene, roomId, polygon);
  const instances = unassignFixturesAfterFillet(
    withPolygon.instances,
    roomId,
    officialRoomRingVertices(polygon),
    storeyId
  );

  return {
    ok: true,
    scene: {
      ...withPolygon,
      instances,
      ui: { ...withPolygon.ui },
    },
    status: formatFilletAllCornersSuccessStatus(room.name),
    roomId,
    polygon,
  };
}
