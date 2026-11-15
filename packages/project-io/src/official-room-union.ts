import { pointInPolygon, roomAreaM2 } from "./geometry";
import { DXF_CLOSED_ROOM_MIN_AREA_M2 } from "./official-dxf-closed-rooms";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfPointsCoincide,
} from "./official-dxf-polyline";
import {
  officialRoomPolygonSelfIntersects,
  officialRoomRingVertices,
  validateStretchedRoomPolygon,
} from "./official-room-vertex";
import type { FixtureInstance, ProjectSceneV2, RoomV2, Vec2 } from "./types";

export const UNION_ROOMS_PICK_FIRST_STATUS =
  "Select the first room to keep, then a second room on this storey. Esc cancels.";

export const UNION_ROOMS_PICK_SECOND_STATUS =
  "Select a second room on this storey to union. Esc cancels.";

export const UNION_ROOMS_CANCELLED_STATUS = "Union rooms cancelled.";

export const UNION_ROOMS_REFUSE_SAME_STATUS =
  "Union rooms refused: select two different rooms.";

export const UNION_ROOMS_REFUSE_STOREY_STATUS =
  "Union rooms refused: both rooms must be on the current storey.";

export const UNION_ROOMS_REFUSE_MISSING_STATUS =
  "Union rooms refused: a room is missing.";

export const UNION_ROOMS_REFUSE_DISJOINT_STATUS =
  "Union rooms refused: the rooms do not overlap or share an edge.";

export const UNION_ROOMS_REFUSE_HOLE_STATUS =
  "Union rooms refused: the union would contain a hole.";

export const UNION_ROOMS_REFUSE_INVALID_STATUS =
  "Union rooms refused: the union would not be a single simple room.";

export const UNION_ROOMS_REFUSE_AREA_STATUS =
  "Union rooms refused: the room area would be below 0.01 m².";

export const UNION_ROOMS_REFUSE_CROSS_STATUS =
  "Union rooms refused: the room outline would cross itself.";

export const UNION_ROOMS_REFUSE_VERTICES_STATUS =
  "Union rooms refused: the room would have fewer than 3 unique corners.";

export function formatUnionRoomsSuccessStatus(name: string): string {
  return `United rooms into “${name}”.`;
}

const EPS = DXF_CLOSED_VERTEX_EPS_M;
const COLINEAR_ABS = 1e-12;
const SIDE_OFFSET_M = 1e-5;

export type OfficialUnionRoomsReason =
  | "missing"
  | "storey"
  | "same"
  | "disjoint"
  | "hole"
  | "self-crossing"
  | "degenerate-vertices"
  | "area"
  | "invalid";

export type OfficialPolygonUnionResult =
  | { ok: true; polygon: Vec2[] }
  | { ok: false; reason: Exclude<OfficialUnionRoomsReason, "missing" | "storey" | "same"> };

export type OfficialUnionRoomsResult =
  | {
      ok: true;
      scene: ProjectSceneV2;
      status: string;
      keptRoomId: string;
      removedRoomId: string;
      polygon: Vec2[];
    }
  | {
      ok: false;
      scene: ProjectSceneV2;
      status: string;
      reason: OfficialUnionRoomsReason;
    };

function clonePt(p: Vec2): Vec2 {
  return { x: p.x, y: p.y };
}

function ringOf(polygon: Vec2[]): Vec2[] {
  return officialRoomRingVertices(polygon).map(clonePt);
}

function signedArea(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function ensureCcw(poly: Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function projectT(a: Vec2, b: Vec2, p: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

export function officialPointOnSegment(
  a: Vec2,
  b: Vec2,
  p: Vec2,
  epsM = EPS
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= epsM) return officialDxfPointsCoincide(a, p, epsM);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
  if (t < -epsM / len || t > 1 + epsM / len) return false;
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return officialDxfPointsCoincide(proj, p, epsM);
}

function pointOnRingBoundary(p: Vec2, ring: Vec2[], epsM = EPS): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    if (officialPointOnSegment(ring[i]!, ring[(i + 1) % n]!, p, epsM)) return true;
  }
  return false;
}

export function officialPointStrictlyInsidePolygon(p: Vec2, ring: Vec2[]): boolean {
  if (ring.length < 3) return false;
  if (pointOnRingBoundary(p, ring)) return false;
  return pointInPolygon(p, ring);
}

export function officialPointInPolygonInclusive(p: Vec2, ring: Vec2[]): boolean {
  if (ring.length < 3) return false;
  return pointOnRingBoundary(p, ring) || pointInPolygon(p, ring);
}

function collinearOverlapLength(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const cd = Math.hypot(d.x - c.x, d.y - c.y);
  if (ab < EPS || cd < EPS) return 0;
  const scale = Math.max(1, ab, cd);
  if (Math.abs(orient(a, b, c)) > EPS * scale || Math.abs(orient(a, b, d)) > EPS * scale) {
    return 0;
  }
  const u1 = projectT(a, b, c);
  const u2 = projectT(a, b, d);
  const lo = Math.max(0, Math.min(u1, u2));
  const hi = Math.min(1, Math.max(u1, u2));
  return Math.max(0, (hi - lo) * ab);
}

/** Shared boundary length of two rings (metres). */
export function officialSharedBoundaryLengthM(a: Vec2[], b: Vec2[]): number {
  const A = ringOf(a);
  const B = ringOf(b);
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i]!;
    const a1 = A[(i + 1) % A.length]!;
    for (let j = 0; j < B.length; j++) {
      sum += collinearOverlapLength(a0, a1, B[j]!, B[(j + 1) % B.length]!);
    }
  }
  return sum;
}

function segmentIntersectionPoints(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2[] {
  const out: Vec2[] = [];
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const cd = Math.hypot(d.x - c.x, d.y - c.y);
  if (ab < EPS || cd < EPS) return out;
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  const epsDen = COLINEAR_ABS * Math.max(1, ab, cd);
  if (Math.abs(denom) > epsDen) {
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
    if (t >= -EPS / ab && t <= 1 + EPS / ab && u >= -EPS / cd && u <= 1 + EPS / cd) {
      const tt = Math.max(0, Math.min(1, t));
      out.push({ x: a.x + tt * (b.x - a.x), y: a.y + tt * (b.y - a.y) });
    }
    return out;
  }
  if (Math.abs(orient(a, b, c)) > EPS * Math.max(1, ab, cd)) return out;
  for (const p of [a, b]) {
    if (officialPointOnSegment(c, d, p)) out.push(clonePt(p));
  }
  for (const p of [c, d]) {
    if (officialPointOnSegment(a, b, p)) out.push(clonePt(p));
  }
  return out;
}

function properCrossing(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const cd = Math.hypot(d.x - c.x, d.y - c.y);
  if (ab < EPS || cd < EPS) return false;
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) <= COLINEAR_ABS * Math.max(1, ab, cd)) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
  const et = EPS / ab;
  const eu = EPS / cd;
  return t > et && t < 1 - et && u > eu && u < 1 - eu;
}

export function officialPolygonsOverlapOrShareEdge(a: Vec2[], b: Vec2[]): "overlap" | "edge-adjacent" | "disjoint" {
  const A = ringOf(a);
  const B = ringOf(b);
  if (A.length < 3 || B.length < 3) return "disjoint";

  let overlap = false;
  for (const p of A) {
    if (officialPointStrictlyInsidePolygon(p, B)) overlap = true;
  }
  for (const p of B) {
    if (officialPointStrictlyInsidePolygon(p, A)) overlap = true;
  }
  for (let i = 0; i < A.length && !overlap; i++) {
    const a0 = A[i]!;
    const a1 = A[(i + 1) % A.length]!;
    const mid = { x: (a0.x + a1.x) / 2, y: (a0.y + a1.y) / 2 };
    if (officialPointStrictlyInsidePolygon(mid, B)) overlap = true;
    for (let j = 0; j < B.length && !overlap; j++) {
      if (properCrossing(a0, a1, B[j]!, B[(j + 1) % B.length]!)) overlap = true;
    }
  }
  for (let j = 0; j < B.length && !overlap; j++) {
    const b0 = B[j]!;
    const b1 = B[(j + 1) % B.length]!;
    const mid = { x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2 };
    if (officialPointStrictlyInsidePolygon(mid, A)) overlap = true;
  }
  // Identical or contained with all vertices on the other boundary.
  if (!overlap) {
    const aInsideB = A.every((p) => officialPointInPolygonInclusive(p, B));
    const bInsideA = B.every((p) => officialPointInPolygonInclusive(p, A));
    if (aInsideB || bInsideA) {
      const areaA = Math.abs(signedArea(A));
      const areaB = Math.abs(signedArea(B));
      if (areaA > EPS && areaB > EPS) overlap = true;
    }
  }

  const shared = officialSharedBoundaryLengthM(A, B);
  if (overlap) return "overlap";
  if (shared > EPS) return "edge-adjacent";
  return "disjoint";
}

type Frag = { a: Vec2; b: Vec2 };

function uniquePoints(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const hit = out.find((q) => officialDxfPointsCoincide(p, q));
    if (hit) continue;
    out.push(clonePt(p));
  }
  return out;
}

function snapToPool(p: Vec2, pool: Vec2[]): Vec2 {
  for (const q of pool) {
    if (officialDxfPointsCoincide(p, q)) return clonePt(q);
  }
  return clonePt(p);
}

function splitEdge(a: Vec2, b: Vec2, cuts: Vec2[]): Frag[] {
  const pts = uniquePoints([a, b, ...cuts.filter((p) => officialPointOnSegment(a, b, p))]);
  pts.sort((p, q) => projectT(a, b, p) - projectT(a, b, q));
  const frags: Frag[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    if (officialDxfPointsCoincide(p, q)) continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) < EPS) continue;
    frags.push({ a: clonePt(p), b: clonePt(q) });
  }
  return frags;
}

function leftNormal(a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: -dy / len, y: dx / len };
}

function inUnionInclusive(p: Vec2, a: Vec2[], b: Vec2[]): boolean {
  return officialPointInPolygonInclusive(p, a) || officialPointInPolygonInclusive(p, b);
}

function unionBoundaryFragments(A: Vec2[], B: Vec2[]): Frag[] {
  const cutsA: Vec2[][] = A.map(() => []);
  const cutsB: Vec2[][] = B.map(() => []);
  const pool: Vec2[] = [...A, ...B].map(clonePt);

  for (let i = 0; i < A.length; i++) {
    const a0 = A[i]!;
    const a1 = A[(i + 1) % A.length]!;
    for (let j = 0; j < B.length; j++) {
      const b0 = B[j]!;
      const b1 = B[(j + 1) % B.length]!;
      for (const p of segmentIntersectionPoints(a0, a1, b0, b1)) {
        const snapped = snapToPool(p, pool);
        if (!pool.some((q) => officialDxfPointsCoincide(q, snapped))) pool.push(snapped);
        cutsA[i]!.push(snapped);
        cutsB[j]!.push(snapped);
      }
    }
    for (const p of B) {
      if (officialPointOnSegment(a0, a1, p)) {
        const snapped = snapToPool(p, pool);
        cutsA[i]!.push(snapped);
      }
    }
  }
  for (let j = 0; j < B.length; j++) {
    const b0 = B[j]!;
    const b1 = B[(j + 1) % B.length]!;
    for (const p of A) {
      if (officialPointOnSegment(b0, b1, p)) {
        const snapped = snapToPool(p, pool);
        cutsB[j]!.push(snapped);
      }
    }
  }

  const raw: Frag[] = [];
  for (let i = 0; i < A.length; i++) {
    raw.push(...splitEdge(A[i]!, A[(i + 1) % A.length]!, cutsA[i]!));
  }
  for (let j = 0; j < B.length; j++) {
    raw.push(...splitEdge(B[j]!, B[(j + 1) % B.length]!, cutsB[j]!));
  }

  const kept: Frag[] = [];
  const seen = new Set<string>();
  for (const frag of raw) {
    const n = leftNormal(frag.a, frag.b);
    if (!n) continue;
    const mid = { x: (frag.a.x + frag.b.x) / 2, y: (frag.a.y + frag.b.y) / 2 };
    const len = Math.hypot(frag.b.x - frag.a.x, frag.b.y - frag.a.y);
    const off = Math.min(SIDE_OFFSET_M, len / 4);
    if (!(off > 0)) continue;
    const left = { x: mid.x + n.x * off, y: mid.y + n.y * off };
    const right = { x: mid.x - n.x * off, y: mid.y - n.y * off };
    const leftIn = inUnionInclusive(left, A, B);
    const rightIn = inUnionInclusive(right, A, B);
    if (leftIn === rightIn) continue;
    const oriented = leftIn ? frag : { a: clonePt(frag.b), b: clonePt(frag.a) };
    const key = fragmentKey(oriented.a, oriented.b);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(oriented);
  }
  return kept;
}

function fragmentKey(a: Vec2, b: Vec2): string {
  const flip = a.x > b.x + EPS || (Math.abs(a.x - b.x) <= EPS && a.y > b.y);
  const p = flip ? b : a;
  const q = flip ? a : b;
  const r = (v: Vec2) => `${v.x.toFixed(7)},${v.y.toFixed(7)}`;
  return `${r(p)}|${r(q)}`;
}

function stitchRings(frags: Frag[]): Vec2[][] | null {
  const unused = frags.map((f) => ({ a: clonePt(f.a), b: clonePt(f.b) }));
  const rings: Vec2[][] = [];

  const takeNext = (from: Vec2): Frag | null => {
    const idx = unused.findIndex(
      (f) => officialDxfPointsCoincide(f.a, from) || officialDxfPointsCoincide(f.b, from)
    );
    if (idx < 0) return null;
    const f = unused.splice(idx, 1)[0]!;
    if (officialDxfPointsCoincide(f.b, from)) return { a: f.b, b: f.a };
    return f;
  };

  while (unused.length > 0) {
    const first = unused.shift()!;
    const ring: Vec2[] = [clonePt(first.a), clonePt(first.b)];
    let guard = frags.length + 2;
    while (guard-- > 0) {
      const end = ring[ring.length - 1]!;
      if (officialDxfPointsCoincide(end, ring[0]!) && ring.length >= 3) {
        ring.pop();
        break;
      }
      const next = takeNext(end);
      if (!next) return null;
      ring.push(clonePt(next.b));
    }
    if (ring.length >= 2 && officialDxfPointsCoincide(ring[0]!, ring[ring.length - 1]!)) {
      ring.pop();
    }
    if (ring.length >= 3) rings.push(ring);
    else if (ring.length > 0 && unused.length > 0) return null;
  }
  return rings;
}

function collapseColinear(ring: Vec2[]): Vec2[] {
  let pts = ring.map(clonePt);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    const next: Vec2[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n]!;
      const cur = pts[i]!;
      const nxt = pts[(i + 1) % n]!;
      if (officialDxfPointsCoincide(prev, cur) || officialDxfPointsCoincide(cur, nxt)) {
        changed = true;
        continue;
      }
      const scale = Math.max(
        1,
        Math.hypot(cur.x - prev.x, cur.y - prev.y),
        Math.hypot(nxt.x - cur.x, nxt.y - cur.y)
      );
      if (Math.abs(orient(prev, cur, nxt)) <= EPS * scale) {
        changed = true;
        continue;
      }
      next.push(cur);
    }
    if (next.length < 3) break;
    pts = next;
  }
  const cleaned: Vec2[] = [];
  for (const p of pts) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && officialDxfPointsCoincide(prev, p)) continue;
    cleaned.push(p);
  }
  if (
    cleaned.length >= 2 &&
    officialDxfPointsCoincide(cleaned[0]!, cleaned[cleaned.length - 1]!)
  ) {
    cleaned.pop();
  }
  return cleaned;
}

/**
 * Union of two simple official room polygons (no holes). Allowed when they
 * overlap in area or share a boundary of positive length. Refuses disjoint
 * or point-touch-only polygons, hole-producing unions, and results that are
 * not a single simple ring.
 */
export function unionOfficialRoomPolygons(a: Vec2[], b: Vec2[]): OfficialPolygonUnionResult {
  const A = ensureCcw(ringOf(a));
  const B = ensureCcw(ringOf(b));
  if (A.length < 3 || B.length < 3) return { ok: false, reason: "degenerate-vertices" };

  const relation = officialPolygonsOverlapOrShareEdge(A, B);
  if (relation === "disjoint") return { ok: false, reason: "disjoint" };

  const frags = unionBoundaryFragments(A, B);
  if (frags.length < 3) return { ok: false, reason: "invalid" };

  const stitched = stitchRings(frags);
  if (!stitched) return { ok: false, reason: "invalid" };
  if (stitched.length > 1) return { ok: false, reason: "hole" };
  if (stitched.length !== 1) return { ok: false, reason: "invalid" };

  const ring = ensureCcw(collapseColinear(stitched[0]!));
  const check = validateStretchedRoomPolygon(ring);
  if (!check.ok) {
    if (check.reason === "area") return { ok: false, reason: "area" };
    if (check.reason === "self-crossing") return { ok: false, reason: "self-crossing" };
    return { ok: false, reason: "degenerate-vertices" };
  }
  if (officialRoomPolygonSelfIntersects(ring)) {
    return { ok: false, reason: "self-crossing" };
  }
  if (roomAreaM2({ polygon: ring } as RoomV2) < DXF_CLOSED_ROOM_MIN_AREA_M2) {
    return { ok: false, reason: "area" };
  }
  return { ok: true, polygon: ring.map(clonePt) };
}

function refuseStatus(reason: OfficialUnionRoomsReason): string {
  switch (reason) {
    case "missing":
      return UNION_ROOMS_REFUSE_MISSING_STATUS;
    case "storey":
      return UNION_ROOMS_REFUSE_STOREY_STATUS;
    case "same":
      return UNION_ROOMS_REFUSE_SAME_STATUS;
    case "disjoint":
      return UNION_ROOMS_REFUSE_DISJOINT_STATUS;
    case "hole":
      return UNION_ROOMS_REFUSE_HOLE_STATUS;
    case "self-crossing":
      return UNION_ROOMS_REFUSE_CROSS_STATUS;
    case "degenerate-vertices":
      return UNION_ROOMS_REFUSE_VERTICES_STATUS;
    case "area":
      return UNION_ROOMS_REFUSE_AREA_STATUS;
    default:
      return UNION_ROOMS_REFUSE_INVALID_STATUS;
  }
}

function reassignFixturesAfterUnion(
  instances: FixtureInstance[],
  keptId: string,
  removedId: string,
  unionRing: Vec2[],
  storeyId: string
): FixtureInstance[] {
  return instances.map((inst) => {
    if (inst.roomId !== removedId) return inst;
    const xy = { x: inst.position.x, y: inst.position.y };
    if (officialPointInPolygonInclusive(xy, unionRing)) {
      return { ...inst, roomId: keptId };
    }
    return { ...inst, roomId: null, storeyId: inst.storeyId || storeyId };
  });
}

/**
 * Union two official rooms on the current storey. The first room keeps its
 * id, name, MF, EN template, height, and other properties. The second room
 * is removed after a successful union. Fixtures of the removed room that
 * still lie in the union are reassigned to the surviving room; fixtures
 * that fall outside stay on the storey with roomId cleared. Luminaires are
 * never deleted. Calculation results are left as they are (same policy as
 * official room translation) — this helper only updates the scene.
 */
export function officialUnionRooms(
  scene: ProjectSceneV2,
  keepRoomId: string,
  removeRoomId: string
): OfficialUnionRoomsResult {
  if (keepRoomId === removeRoomId) {
    return {
      ok: false,
      scene,
      status: UNION_ROOMS_REFUSE_SAME_STATUS,
      reason: "same",
    };
  }
  const keep = scene.rooms.find((room) => room.id === keepRoomId);
  const remove = scene.rooms.find((room) => room.id === removeRoomId);
  if (!keep || !remove) {
    return {
      ok: false,
      scene,
      status: UNION_ROOMS_REFUSE_MISSING_STATUS,
      reason: "missing",
    };
  }
  const storeyId = scene.ui.activeStoreyId;
  if (keep.storeyId !== storeyId || remove.storeyId !== storeyId) {
    return {
      ok: false,
      scene,
      status: UNION_ROOMS_REFUSE_STOREY_STATUS,
      reason: "storey",
    };
  }

  const unioned = unionOfficialRoomPolygons(keep.polygon, remove.polygon);
  if (!unioned.ok) {
    return {
      ok: false,
      scene,
      status: refuseStatus(unioned.reason),
      reason: unioned.reason,
    };
  }

  const polygon = unioned.polygon.map(clonePt);
  const rooms = scene.rooms
    .filter((room) => room.id !== removeRoomId)
    .map((room) => (room.id === keepRoomId ? { ...room, polygon } : room));
  const instances = reassignFixturesAfterUnion(
    scene.instances,
    keepRoomId,
    removeRoomId,
    polygon,
    storeyId
  );
  const activeRoomId =
    scene.ui.activeRoomId === removeRoomId ? keepRoomId : scene.ui.activeRoomId;

  return {
    ok: true,
    scene: {
      ...scene,
      rooms,
      instances,
      ui: { ...scene.ui, activeRoomId },
    },
    status: formatUnionRoomsSuccessStatus(keep.name),
    keptRoomId: keepRoomId,
    removedRoomId: removeRoomId,
    polygon,
  };
}
