import { pointInPolygon } from "./geometry";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfEntitySegments,
  officialDxfPointsCoincide,
} from "./official-dxf-polyline";
import type { DxfEntity, Vec2 } from "./types";

/** Matches DXF_CLOSED_ROOM_MIN_AREA_M2; kept local to avoid a circular import. */
const NETWORK_FACE_MIN_AREA_M2 = 0.01;

/**
 * Segments used to trace wall-network rooms: LINE entities, consecutive
 * vertices of open LWPOLYLINE paths, and closed polylines including their
 * official closing edge. Zero-length segments are dropped. Open paths still
 * have no invented closing edge.
 */
export function officialDxfNetworkSegments(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>
): [Vec2, Vec2][] {
  const segs: [Vec2, Vec2][] = [];
  for (const entity of entities) {
    for (const [a, b] of officialDxfEntitySegments(entity)) {
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0) segs.push([a, b]);
    }
  }
  return segs;
}

function vertexIndex(vertices: Vec2[], point: Vec2, epsM: number): number {
  const found = vertices.findIndex((q) => officialDxfPointsCoincide(point, q, epsM));
  if (found >= 0) return found;
  vertices.push({ x: point.x, y: point.y });
  return vertices.length - 1;
}

function lineLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function distToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const len = lineLength(a, b);
  if (len === 0) return lineLength(p, a);
  return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len;
}

function projectParam(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
}

/** True when P lies on segment AB within epsM, including near the endpoints. */
export function officialDxfPointOnSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): boolean {
  if (officialDxfPointsCoincide(p, a, epsM) || officialDxfPointsCoincide(p, b, epsM)) {
    return true;
  }
  const len = lineLength(a, b);
  if (len <= epsM) return officialDxfPointsCoincide(p, a, epsM);
  const t = projectParam(p, a, b);
  const slack = epsM / len;
  if (t < -slack || t > 1 + slack) return false;
  return distToLine(p, a, b) <= epsM;
}

function pointInOrOnRing(point: Vec2, ring: Vec2[], epsM: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    if (officialDxfPointOnSegment(point, ring[i]!, ring[(i + 1) % ring.length]!, epsM)) {
      return true;
    }
  }
  return pointInPolygon(point, ring);
}

function signedAreaM2(polygon: Vec2[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function uniqueVertexCount(points: Vec2[], epsM: number): number {
  const unique: Vec2[] = [];
  for (const p of points) {
    if (!unique.some((q) => officialDxfPointsCoincide(p, q, epsM))) unique.push(p);
  }
  return unique.length;
}

export function officialDxfRingsMatch(a: Vec2[], b: Vec2[], epsM: number): boolean {
  if (a.length !== b.length) return false;
  const n = a.length;
  if (n === 0) return true;
  for (let start = 0; start < n; start++) {
    let fwd = true;
    let rev = true;
    for (let i = 0; i < n; i++) {
      const bi = b[(start + i) % n]!;
      const bj = b[(start - i + n) % n]!;
      if (fwd && !officialDxfPointsCoincide(a[i]!, bi, epsM)) fwd = false;
      if (rev && !officialDxfPointsCoincide(a[i]!, bj, epsM)) rev = false;
      if (!fwd && !rev) break;
    }
    if (fwd || rev) return true;
  }
  return false;
}

function ringCentroid(ring: Vec2[]): Vec2 {
  if (ring.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

/**
 * True when `outer` fully contains `inner` as a distinct, smaller ring
 * (every inner vertex, and the inner centroid, is inside or on `outer`).
 * Adjacent rooms that only share a wall do not contain one another.
 */
export function officialDxfRingFullyContains(
  outer: Vec2[],
  inner: Vec2[],
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): boolean {
  if (outer.length < 3 || inner.length < 3) return false;
  if (officialDxfRingsMatch(outer, inner, epsM)) return false;
  const outerArea = Math.abs(signedAreaM2(outer));
  const innerArea = Math.abs(signedAreaM2(inner));
  if (outerArea <= innerArea + 1e-12) return false;
  for (const p of inner) {
    if (!pointInOrOnRing(p, outer, epsM)) return false;
  }
  return pointInOrOnRing(ringCentroid(inner), outer, epsM);
}

function isValidRoomRing(ring: Vec2[], epsM: number): boolean {
  return uniqueVertexCount(ring, epsM) >= 3 && Math.abs(signedAreaM2(ring)) >= NETWORK_FACE_MIN_AREA_M2;
}

/**
 * Drop later exact duplicates and any ring that fully contains another
 * remaining valid room ring, so a holed outer outline is not kept beside an
 * inner room. A degenerate inner (area below 0.01 m², or fewer than 3 unique
 * vertices) does not suppress a valid outer.
 */
export function officialDxfDropContainingRings(
  rings: ReadonlyArray<Vec2[]>,
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): Vec2[][] {
  const unique: Vec2[][] = [];
  for (const ring of rings) {
    if (unique.some((other) => officialDxfRingsMatch(ring, other, epsM))) continue;
    unique.push(ring);
  }
  return unique.filter(
    (ring) =>
      !unique.some(
        (other) =>
          isValidRoomRing(other, epsM) && officialDxfRingFullyContains(ring, other, epsM)
      )
  );
}

function segmentsCollinear(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  epsM: number
): boolean {
  return distToLine(c, a, b) <= epsM && distToLine(d, a, b) <= epsM;
}

function segmentIntersection(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  epsM: number
): Vec2 | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const den = abx * cdy - aby * cdx;
  const lenAB = lineLength(a, b);
  const lenCD = lineLength(c, d);
  if (lenAB <= epsM || lenCD <= epsM) return null;
  if (Math.abs(den) <= epsM * Math.max(lenAB, lenCD)) return null;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const t = (acx * cdy - acy * cdx) / den;
  const u = (acx * aby - acy * abx) / den;
  const slackT = epsM / lenAB;
  const slackU = epsM / lenCD;
  if (t < -slackT || t > 1 + slackT || u < -slackU || u > 1 + slackU) return null;
  return { x: a.x + t * abx, y: a.y + t * aby };
}

type RawSeg = { a: Vec2; b: Vec2 };

function planarize(
  segments: ReadonlyArray<[Vec2, Vec2]>,
  epsM: number
): { vertices: Vec2[]; edges: [number, number][] } {
  const raw: RawSeg[] = [];
  for (const [p, q] of segments) {
    if (lineLength(p, q) <= epsM) continue;
    raw.push({ a: { x: p.x, y: p.y }, b: { x: q.x, y: q.y } });
  }

  const vertices: Vec2[] = [];
  const splitAt: number[][] = raw.map(() => []);

  const addPoint = (p: Vec2): number => vertexIndex(vertices, p, epsM);
  const addSplit = (segIndex: number, p: Vec2) => {
    const idx = addPoint(p);
    if (!splitAt[segIndex]!.includes(idx)) splitAt[segIndex]!.push(idx);
  };

  for (let i = 0; i < raw.length; i++) {
    addSplit(i, raw[i]!.a);
    addSplit(i, raw[i]!.b);
  }

  const recordPair = (i: number, j: number) => {
    const A = raw[i]!;
    const B = raw[j]!;
    if (segmentsCollinear(A.a, A.b, B.a, B.b, epsM)) {
      for (const p of [B.a, B.b]) {
        if (officialDxfPointOnSegment(p, A.a, A.b, epsM)) addSplit(i, p);
      }
      for (const p of [A.a, A.b]) {
        if (officialDxfPointOnSegment(p, B.a, B.b, epsM)) addSplit(j, p);
      }
      return;
    }
    const hit = segmentIntersection(A.a, A.b, B.a, B.b, epsM);
    if (!hit) return;
    addSplit(i, hit);
    addSplit(j, hit);
  };

  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) recordPair(i, j);
  }

  // T-junctions and three-or-more walls through a point: any vertex on a segment.
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]!;
    for (const p of vertices) {
      if (officialDxfPointOnSegment(p, seg.a, seg.b, epsM)) addSplit(i, p);
    }
  }

  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]!;
    const pts = splitAt[i]!.slice();
    pts.sort((ia, ib) => projectParam(vertices[ia]!, seg.a, seg.b) - projectParam(vertices[ib]!, seg.a, seg.b));
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      if (a === b) continue;
      if (lineLength(vertices[a]!, vertices[b]!) <= epsM) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo},${hi}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([a, b]);
    }
  }

  return { vertices, edges };
}

function buildAdjacency(vertexCount: number, edges: ReadonlyArray<[number, number]>): number[][] {
  const adj: number[][] = Array.from({ length: vertexCount }, () => []);
  for (const [a, b] of edges) {
    if (a === b) continue;
    if (!adj[a]!.includes(b)) adj[a]!.push(b);
    if (!adj[b]!.includes(a)) adj[b]!.push(a);
  }
  return adj;
}

function sortAndPruneNeighbors(vertices: Vec2[], adj: number[][]): number[][] {
  return adj.map((nbrs, v) => {
    if (nbrs.length <= 1) return nbrs.slice();
    const origin = vertices[v]!;
    const scored = nbrs.map((n) => {
      const p = vertices[n]!;
      return {
        n,
        angle: Math.atan2(p.y - origin.y, p.x - origin.x),
        dist: lineLength(origin, p),
      };
    });
    scored.sort((a, b) => a.angle - b.angle || a.dist - b.dist);
    const kept: typeof scored = [];
    for (const item of scored) {
      const prev = kept[kept.length - 1];
      if (prev && angleDelta(prev.angle, item.angle) <= 1e-12 && item.dist > prev.dist) {
        continue;
      }
      if (
        kept.length > 0 &&
        angleDelta(kept[0]!.angle, item.angle + 2 * Math.PI) <= 1e-12 &&
        item.dist > kept[0]!.dist
      ) {
        continue;
      }
      kept.push(item);
    }
    return kept.map((s) => s.n);
  });
}

function angleDelta(a: number, b: number): number {
  return Math.abs(a - b);
}

function nextLeft(sortedAdj: number[][], v: number, fromU: number): number | null {
  const nbrs = sortedAdj[v] ?? [];
  if (nbrs.length === 0) return null;
  const idx = nbrs.indexOf(fromU);
  if (idx < 0) return null;
  return nbrs[(idx - 1 + nbrs.length) % nbrs.length]!;
}

function stripSpikesAndCollinear(ring: Vec2[], epsM: number): Vec2[] {
  const pts = ring.map((p) => ({ x: p.x, y: p.y }));
  let changed = true;
  while (changed) {
    changed = false;
    if (pts.length < 3) return [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]!;
      const cur = pts[i]!;
      const next = pts[(i + 1) % pts.length]!;
      if (officialDxfPointsCoincide(prev, next, epsM)) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
      if (officialDxfPointsCoincide(prev, cur, epsM) || officialDxfPointsCoincide(cur, next, epsM)) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
      if (distToLine(cur, prev, next) <= epsM) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/**
 * Minimal simple bounded interior faces of the planarized wall network.
 * Isolated closed polylines and simple degree-2 loops appear as faces of a
 * trivial network. Nested outers that fully contain another face are dropped
 * so LUXSIM does not create a holed or overlapping outer room.
 */
export function officialDxfNetworkFaceRings(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>,
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): Vec2[][] {
  const { vertices, edges } = planarize(officialDxfNetworkSegments(entities), epsM);
  if (vertices.length < 3 || edges.length < 3) return [];

  const sortedAdj = sortAndPruneNeighbors(vertices, buildAdjacency(vertices.length, edges));
  const used = new Set<string>();
  const halfKey = (u: number, v: number) => `${u}>${v}`;
  const faces: Vec2[][] = [];

  const walk = (startU: number, startV: number): number[] | null => {
    const ringIdx: number[] = [];
    let u = startU;
    let v = startV;
    const maxSteps = vertices.length * 3 + 8;
    for (let step = 0; step < maxSteps; step++) {
      const k = halfKey(u, v);
      if (used.has(k)) return null;
      used.add(k);
      ringIdx.push(u);
      const w = nextLeft(sortedAdj, v, u);
      if (w == null) return null;
      u = v;
      v = w;
      if (u === startU && v === startV) return ringIdx;
    }
    return null;
  };

  for (const [a, b] of edges) {
    for (const [u, v] of [
      [a, b],
      [b, a],
    ] as const) {
      if (used.has(halfKey(u, v))) continue;
      const idx = walk(u, v);
      if (!idx || idx.length < 3) continue;
      const raw = idx.map((i) => ({ x: vertices[i]!.x, y: vertices[i]!.y }));
      const ring = stripSpikesAndCollinear(raw, epsM);
      if (uniqueVertexCount(ring, epsM) < 3) continue;
      const area = signedAreaM2(ring);
      if (area <= 0) continue;
      if (area < NETWORK_FACE_MIN_AREA_M2) continue;
      faces.push(ring);
    }
  }

  return officialDxfDropContainingRings(faces, epsM);
}

/** True when at least one valid network face exists after world mapping. */
export function officialDxfHasNetworkFace(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>
): boolean {
  return officialDxfNetworkFaceRings(entities).length > 0;
}
