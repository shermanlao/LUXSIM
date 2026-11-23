import { pointInPolygon, roomAreaM2 } from "./geometry";
import { officialEntityLayer } from "./official-dxf-layers";
import {
  officialDxfDropContainingRings,
  officialDxfNetworkFaceRings,
  officialDxfRingFullyContains,
  officialDxfRingsMatch,
} from "./official-dxf-network-rooms";
import {
  officialDxfSimpleLineLoopRings,
} from "./official-dxf-line-loops";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfClosedRingVertices,
  officialDxfEntitySegments,
  officialDxfPointsCoincide,
  officialDxfPolylineClosed,
} from "./official-dxf-polyline";
import { officialValidateSimplePolygon } from "./official-storey-outline";
import type { DxfEntity, Vec2, RoomV2 } from "./types";

/**
 * Official minimum area for rooms created automatically from a DXF/DWG plan
 * (Create rooms from DXF and Create from plan). 1 m² drops a typical 600×600 mm
 * ceiling tile (~0.36 m²) while still allowing a small WC. Hand-drawn rooms
 * (Draw room) keep the 0.01 m² official minimum.
 */
export const DXF_FROM_PLAN_ROOM_MIN_AREA_M2 = 1;

/** Skip a regular grid whose similar cells are smaller than this. */
const GRID_CELL_AREA_MAX_M2 = 4;

/** Treat a set of similar small rectangles as a grid at or above this count. */
const GRID_CELL_MIN_COUNT = 12;

/** Do not run wall-network face tracing above this segment count (too slow). */
const NETWORK_FACE_MAX_SEGMENTS = 2500;

/** Refuse a local "layout" that still looks like a leftover grid. */
const LAYOUT_ROOM_COUNT_CAP = 400;

const CLUSTER_SNAP_M = 1e-3;

const LAYOUT_LAYER_RE =
  /WALL|DOOR|WINDOW|\bWIN\b|PARTITION|ROOM|\bAREA\b|FFL|FLOOR|LAYOUT|\bPLAN\b|ARCH|牆|房間|隔斷|隔牆|平面|門窗/i;

const RCP_LAYER_RE =
  /CEILING|\bCLG\b|\bRCP\b|C-LIGHT|EL-LIGHT|LIGHTING|\bLTG\b|\bLIGHT\b|FIXTURE|LUMINAIRE|\bLAMP\b|\bTILE\b|\bGRID\b|T-?BAR|天花|燈具|燈盤|\b燈\b/i;

export type OfficialPlanLayerRole = "layout" | "rcp" | "other";

export type OfficialPlanLayerSummary = {
  name: string;
  role: OfficialPlanLayerRole;
  entityCount: number;
};

export type OfficialRoomAnalysisSummary = {
  layers: OfficialPlanLayerSummary[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  contour: Vec2[] | null;
  candidateRings: Vec2[][];
  linework: [Vec2, Vec2][];
};

function ringAreaM2(ring: Vec2[]): number {
  return roomAreaM2({ polygon: ring } as RoomV2);
}

function uniqueVertexCount(points: Vec2[], epsM: number): number {
  const unique: Vec2[] = [];
  for (const p of points) {
    if (!unique.some((q) => officialDxfPointsCoincide(p, q, epsM))) unique.push(p);
  }
  return unique.length;
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

function pointInOrOnRing(point: Vec2, ring: Vec2[], epsM: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) {
      if (officialDxfPointsCoincide(point, a, epsM)) return true;
      continue;
    }
    const t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (len * len);
    if (t >= -1e-9 && t <= 1 + 1e-9) {
      const dist =
        Math.abs((point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)) / len;
      if (dist <= epsM) return true;
    }
  }
  return pointInPolygon(point, ring);
}

export function officialPlanLayerRole(layerName: string): OfficialPlanLayerRole {
  const name = layerName.trim();
  if (!name) return "other";
  if (RCP_LAYER_RE.test(name)) return "rcp";
  if (LAYOUT_LAYER_RE.test(name)) return "layout";
  return "other";
}

export function officialIsLayoutPlanLayer(layerName: string): boolean {
  return officialPlanLayerRole(layerName) === "layout";
}

export function officialIsRcpOrLightingLayer(layerName: string): boolean {
  return officialPlanLayerRole(layerName) === "rcp";
}

function entitySegments(
  entity: Pick<DxfEntity, "points" | "closed" | "type">
): [Vec2, Vec2][] {
  return officialDxfEntitySegments(entity).filter(
    ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y) > 0
  );
}

type Cluster = {
  segments: [Vec2, Vec2][];
  entities: DxfEntity[];
  length: number;
};

function quantKey(p: Vec2): string {
  return `${Math.round(p.x / CLUSTER_SNAP_M)},${Math.round(p.y / CLUSTER_SNAP_M)}`;
}

function clusterVisibleLinework(entities: ReadonlyArray<DxfEntity>): Cluster[] {
  const parent: number[] = [];
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pb] = pa;
  };

  const keyIndex = new Map<string, number>();
  const indexOf = (p: Vec2): number => {
    const key = quantKey(p);
    const found = keyIndex.get(key);
    if (found != null) return found;
    const i = parent.length;
    parent.push(i);
    keyIndex.set(key, i);
    return i;
  };

  const entitySegs: [Vec2, Vec2][][] = [];
  for (const entity of entities) {
    const segs = entitySegments(entity);
    entitySegs.push(segs);
    for (const [a, b] of segs) unite(indexOf(a), indexOf(b));
  }

  const clusters = new Map<number, Cluster>();
  entities.forEach((entity, i) => {
    const segs = entitySegs[i]!;
    if (segs.length === 0) return;
    const root = find(indexOf(segs[0]![0]));
    let cluster = clusters.get(root);
    if (!cluster) {
      cluster = { segments: [], entities: [], length: 0 };
      clusters.set(root, cluster);
    }
    cluster.entities.push(entity);
    for (const seg of segs) {
      cluster.segments.push(seg);
      cluster.length += Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
    }
  });
  return [...clusters.values()];
}

function mainBuildingCluster(clusters: Cluster[]): Cluster | null {
  if (clusters.length === 0) return null;
  let best: Cluster | null = null;
  for (const cluster of clusters) {
    if (!best || cluster.length > best.length) best = cluster;
  }
  if (!best || best.length < 1e-3 || best.segments.length < 3) return null;
  return best;
}

/** Minimum gap for merging endpoint-disconnected islands of the same plate. */
const SPATIAL_MERGE_MIN_GAP_M = 2;

/** Also allow a gap of this fraction of the longest cluster's bounding box. */
const SPATIAL_MERGE_GAP_FRACTION = 0.1;

function bboxSeparation(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

function spatialMergeGapM(clusters: Cluster[]): number {
  let best: Cluster | null = null;
  for (const cluster of clusters) {
    if (!best || cluster.length > best.length) best = cluster;
  }
  if (!best) return SPATIAL_MERGE_MIN_GAP_M;
  const box = boundsOfSegments(best.segments);
  if (!box) return SPATIAL_MERGE_MIN_GAP_M;
  const scale = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  return Math.max(SPATIAL_MERGE_MIN_GAP_M, scale * SPATIAL_MERGE_GAP_FRACTION);
}

/**
 * Merge endpoint clusters whose bounding boxes overlap or sit within a modest
 * gap, so a ceiling grid of disconnected tiles still forms one floor plate,
 * while far-away title-block scraps stay separate.
 */
function mergeSpatiallyNearbyClusters(clusters: Cluster[]): Cluster[] {
  if (clusters.length <= 1) return clusters;
  const gap = spatialMergeGapM(clusters);
  const boxes = clusters.map((cluster) => boundsOfSegments(cluster.segments));
  const parent = clusters.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pb] = pa;
  };

  const cell = Math.max(gap, 0.5);
  const buckets = new Map<string, number[]>();
  clusters.forEach((_, i) => {
    const box = boxes[i];
    if (!box) return;
    const c0 = Math.floor((box.minX - gap) / cell);
    const c1 = Math.floor((box.maxX + gap) / cell);
    const r0 = Math.floor((box.minY - gap) / cell);
    const r1 = Math.floor((box.maxY + gap) / cell);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const key = `${cx},${cy}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(i);
        else buckets.set(key, [i]);
      }
    }
  });

  const seen = new Set<string>();
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const ia = bucket[i]!;
      const ba = boxes[ia];
      if (!ba) continue;
      for (let j = i + 1; j < bucket.length; j++) {
        const ib = bucket[j]!;
        if (ia === ib) continue;
        const pair = ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        const bb = boxes[ib];
        if (!bb) continue;
        if (bboxSeparation(ba, bb) <= gap) unite(ia, ib);
      }
    }
  }

  const merged = new Map<number, Cluster>();
  clusters.forEach((cluster, i) => {
    const root = find(i);
    let next = merged.get(root);
    if (!next) {
      next = { segments: [], entities: [], length: 0 };
      merged.set(root, next);
    }
    next.segments.push(...cluster.segments);
    next.entities.push(...cluster.entities);
    next.length += cluster.length;
  });
  return [...merged.values()];
}

function boundsOfSegments(
  segs: ReadonlyArray<[Vec2, Vec2]>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (segs.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [a, b] of segs) {
    minX = Math.min(minX, a.x, b.x);
    minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x);
    maxY = Math.max(maxY, a.y, b.y);
  }
  if (!Number.isFinite(minX) || maxX - minX <= 0 || maxY - minY <= 0) return null;
  return { minX, minY, maxX, maxY };
}

function downsamplePoints(points: ReadonlyArray<Vec2>, maxCount: number): Vec2[] {
  if (points.length <= maxCount) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Vec2[] = [];
  const step = (points.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    const p = points[Math.round(i * step)]!;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/**
 * Convex hull (Andrew's monotone chain) of plan points. Returns an open ring
 * (no repeated closing vertex). Degenerate inputs return fewer than 3 points.
 */
export function officialConvexHullRing(points: ReadonlyArray<Vec2>): Vec2[] {
  const eps = DXF_CLOSED_VERTEX_EPS_M;
  const uniq: Vec2[] = [];
  for (const p of points) {
    if (!uniq.some((q) => officialDxfPointsCoincide(p, q, eps))) uniq.push({ x: p.x, y: p.y });
  }
  uniq.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (uniq.length <= 2) return uniq;

  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Vec2[] = [];
  for (const p of uniq) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function douglasPeucker(points: Vec2[], epsM: number): Vec2[] {
  if (points.length <= 3) return points.slice();
  const dist = (p: Vec2, a: Vec2, b: Vec2) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len;
  };
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxD = 0;
    let maxI = start;
    const a = points[start]!;
    const b = points[end]!;
    for (let i = start + 1; i < end; i++) {
      const d = dist(points[i]!, a, b);
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > epsM) {
      keep[maxI] = true;
      stack.push([start, maxI], [maxI, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function occupancyOuterRing(segs: ReadonlyArray<[Vec2, Vec2]>): Vec2[] | null {
  const bounds = boundsOfSegments(segs);
  if (!bounds) return null;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const maxEdge = 192;
  const cell = Math.max(Math.max(width, height) / maxEdge, 0.05);
  const cols = Math.max(2, Math.ceil(width / cell) + 2);
  const rows = Math.max(2, Math.ceil(height / cell) + 2);
  const marked = new Uint8Array(cols * rows);
  const at = (c: number, r: number) => r * cols + c;
  const inGrid = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;

  const markSeg = (a: Vec2, b: Vec2) => {
    const x0 = Math.floor((a.x - bounds.minX) / cell) + 1;
    const y0 = Math.floor((a.y - bounds.minY) / cell) + 1;
    const x1 = Math.floor((b.x - bounds.minX) / cell) + 1;
    const y1 = Math.floor((b.y - bounds.minY) / cell) + 1;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const c = Math.round(x0 + ((x1 - x0) * i) / steps);
      const r = Math.round(y0 + ((y1 - y0) * i) / steps);
      if (inGrid(c, r)) marked[at(c, r)] = 1;
    }
  };
  for (const [a, b] of segs) markSeg(a, b);

  // Close one-cell gaps so a sparse wall outline still forms a floor plate.
  const closed = marked.slice();
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (marked[at(c, r)]) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (marked[at(c + dc, r + dr)]) n += 1;
        }
      }
      if (n >= 5) closed[at(c, r)] = 1;
    }
  }

  const filled = closed.slice();
  const visit: number[] = [];
  const push = (c: number, r: number) => {
    if (!inGrid(c, r) || filled[at(c, r)]) return;
    filled[at(c, r)] = 2; // exterior flood
    visit.push(c, r);
  };
  for (let c = 0; c < cols; c++) {
    push(c, 0);
    push(c, rows - 1);
  }
  for (let r = 0; r < rows; r++) {
    push(0, r);
    push(cols - 1, r);
  }
  while (visit.length) {
    const r = visit.pop()!;
    const c = visit.pop()!;
    push(c + 1, r);
    push(c - 1, r);
    push(c, r + 1);
    push(c, r - 1);
  }

  // Occupied or interior (not exterior flood) becomes the floor plate.
  const solid = new Uint8Array(cols * rows);
  for (let i = 0; i < solid.length; i++) {
    solid[i] = filled[i] === 2 ? 0 : 1;
  }

  let startC = -1;
  let startR = -1;
  for (let r = 0; r < rows && startC < 0; r++) {
    for (let c = 0; c < cols; c++) {
      if (solid[at(c, r)]) {
        startC = c;
        startR = r;
        break;
      }
    }
  }
  if (startC < 0) return null;

  // Moore-neighbour boundary walk on cell centres of the outer solid blob.
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ] as const;
  const ring: Vec2[] = [];
  let c = startC;
  let r = startR;
  let dir = 0;
  const maxSteps = cols * rows * 4 + 8;
  for (let step = 0; step < maxSteps; step++) {
    ring.push({
      x: bounds.minX + (c - 0.5) * cell,
      y: bounds.minY + (r - 0.5) * cell,
    });
    let found = false;
    for (let k = 0; k < 8; k++) {
      const look = (dir + 6 + k) % 8; // start from forward-left
      const nc = c + dirs[look]![0];
      const nr = r + dirs[look]![1];
      if (inGrid(nc, nr) && solid[at(nc, nr)]) {
        c = nc;
        r = nr;
        dir = look;
        found = true;
        break;
      }
    }
    if (!found) return null;
    if (c === startC && r === startR && ring.length > 3) break;
  }
  if (ring.length < 4) return null;
  if (
    officialDxfPointsCoincide(ring[0]!, ring[ring.length - 1]!, cell * 0.6)
  ) {
    ring.pop();
  }
  const simplified = douglasPeucker(ring, Math.max(cell * 0.75, 0.08));
  return simplified.length >= 3 ? simplified : null;
}

function largestContainingClosedRing(
  entities: ReadonlyArray<DxfEntity>,
  segs: ReadonlyArray<[Vec2, Vec2]>
): Vec2[] | null {
  const bounds = boundsOfSegments(segs);
  if (!bounds) return null;
  const bboxArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  if (!(bboxArea > 0)) return null;
  const midpoints = segs.map(([a, b]) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }));
  const sample = downsamplePoints(midpoints, 80);
  const pickBest = (rings: ReadonlyArray<Vec2[]>): Vec2[] | null => {
    let best: Vec2[] | null = null;
    let bestArea = 0;
    for (const ring of rings) {
      const valid = officialValidateSimplePolygon(ring);
      if (!valid.ok) continue;
      const area = ringAreaM2(valid.ring);
      if (area < Math.max(DXF_FROM_PLAN_ROOM_MIN_AREA_M2, bboxArea * 0.4)) continue;
      // A drawing frame around the whole sheet is much larger than the plate.
      if (area > bboxArea * 2.5) continue;
      const contained = sample.filter((p) =>
        pointInOrOnRing(p, valid.ring, CLUSTER_SNAP_M)
      ).length;
      if (contained < sample.length * 0.7) continue;
      if (area > bestArea) {
        best = valid.ring;
        bestArea = area;
      }
    }
    return best;
  };

  const closedRings: Vec2[][] = [];
  for (const entity of entities) {
    if (!officialDxfPolylineClosed(entity)) continue;
    const ring = officialDxfClosedRingVertices(entity);
    if (ring) closedRings.push(ring);
  }
  const fromPolylines = pickBest(closedRings);
  if (fromPolylines) return fromPolylines;

  // Reconstructing every line loop on a dense ceiling grid is too heavy for
  // this cheap outline path. Only try it on a modest cluster.
  if (segs.length <= NETWORK_FACE_MAX_SEGMENTS) {
    const fromLoops = pickBest(officialDxfSimpleLineLoopRings(entities));
    if (fromLoops) return fromLoops;
  }
  return null;
}

/**
 * Cheap outer boundary of the main visible linework cluster. Endpoint
 * clusters that lie next to each other are merged so a disconnected ceiling
 * grid still counts as one floor plate. Prefers a large already-closed
 * outline only when it encloses most of that merged cluster (never an inner
 * courtyard). Otherwise a coarse occupancy-grid outer ring, otherwise a
 * convex hull. Does not enumerate inner network faces.
 */
export function officialCheapStoreyOutlineFromLinework(
  entities: ReadonlyArray<DxfEntity>
): Vec2[] | null {
  const clusters = mergeSpatiallyNearbyClusters(clusterVisibleLinework(entities));
  const main = mainBuildingCluster(clusters);
  if (!main) return null;

  const fromClosed = largestContainingClosedRing(main.entities, main.segments);
  if (fromClosed) return fromClosed;

  const occupancy = occupancyOuterRing(main.segments);
  if (occupancy) {
    const valid = officialValidateSimplePolygon(occupancy);
    if (valid.ok) return valid.ring;
  }

  const hullPts: Vec2[] = [];
  for (const [a, b] of main.segments) {
    hullPts.push(a, b);
  }
  const hull = officialConvexHullRing(downsamplePoints(hullPts, 400));
  const validHull = officialValidateSimplePolygon(hull);
  return validHull.ok ? validHull.ring : null;
}

function isRoughlyRectangular(ring: Vec2[]): boolean {
  if (ring.length < 4) return false;
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return false;
  const area = ringAreaM2(ring);
  return area / (bw * bh) >= 0.85 && ring.length <= 8;
}

/**
 * Drop a large regular grid of similar small rectangles (ceiling tiles) rather
 * than creating one room per cell. Larger unique rooms in the same set are kept.
 */
export function officialDropRegularSmallGridRings(rings: ReadonlyArray<Vec2[]>): Vec2[][] {
  if (rings.length < GRID_CELL_MIN_COUNT) return rings.slice();
  const scored = rings.map((ring) => ({
    ring,
    area: ringAreaM2(ring),
    rectangular: isRoughlyRectangular(ring),
  }));
  const smallRects = scored.filter(
    (s) => s.rectangular && s.area < GRID_CELL_AREA_MAX_M2 && s.area >= 0
  );
  if (smallRects.length < GRID_CELL_MIN_COUNT) return rings.slice();
  const areas = smallRects.map((s) => s.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)]!;
  if (!(median > 0)) return rings.slice();
  const similar = smallRects.filter(
    (s) => Math.abs(s.area - median) / median <= 0.25
  );
  if (similar.length < GRID_CELL_MIN_COUNT) return rings.slice();
  const skip = new Set(similar.map((s) => s.ring));
  return rings.filter((ring) => !skip.has(ring));
}

function collectClosedAndLoopRings(entities: ReadonlyArray<DxfEntity>): Vec2[][] {
  const closedRings: Vec2[][] = [];
  for (const entity of entities) {
    if (!officialDxfPolylineClosed(entity)) continue;
    const ring = officialDxfClosedRingVertices(entity);
    if (ring) closedRings.push(ring);
  }
  return [...closedRings, ...officialDxfSimpleLineLoopRings(entities)];
}

function collectLayoutNetworkFaces(entities: ReadonlyArray<DxfEntity>): Vec2[][] {
  let segs = 0;
  for (const entity of entities) segs += entitySegments(entity).length;
  if (segs === 0 || segs > NETWORK_FACE_MAX_SEGMENTS) return [];
  return officialDxfNetworkFaceRings(entities);
}

function looksLikeUniformGridEntities(entities: ReadonlyArray<DxfEntity>): boolean {
  const closed = collectClosedAndLoopRings(entities).filter(
    (ring) => ringAreaM2(ring) < GRID_CELL_AREA_MAX_M2
  );
  if (closed.length >= GRID_CELL_MIN_COUNT) {
    const kept = officialDropRegularSmallGridRings(closed);
    if (kept.length === 0 || kept.length <= closed.length - GRID_CELL_MIN_COUNT) {
      return true;
    }
  }
  return false;
}

export function officialValidateFromPlanRoomRing(ring: Vec2[]): Vec2[] | null {
  if (uniqueVertexCount(ring, DXF_CLOSED_VERTEX_EPS_M) < 3) return null;
  const valid = officialValidateSimplePolygon(ring);
  if (!valid.ok) return null;
  if (ringAreaM2(valid.ring) < DXF_FROM_PLAN_ROOM_MIN_AREA_M2) return null;
  return valid.ring;
}

export function officialFilterFromPlanRoomRings(
  rings: ReadonlyArray<Vec2[]>,
  outline?: Vec2[] | null
): Vec2[][] {
  const eps = DXF_CLOSED_VERTEX_EPS_M;
  const valid: Vec2[][] = [];
  for (const ring of rings) {
    const ok = officialValidateFromPlanRoomRing(ring);
    if (!ok) continue;
    if (outline && outline.length >= 3) {
      const c = ringCentroid(ok);
      if (!pointInOrOnRing(c, outline, eps) && !officialDxfRingFullyContains(outline, ok, eps)) {
        // Keep a ring that clearly sits on the floor plate; skip scraps outside.
        const containedVerts = ok.filter((p) => pointInOrOnRing(p, outline, eps)).length;
        if (containedVerts < ok.length * 0.6) continue;
      }
    }
    if (valid.some((other) => officialDxfRingsMatch(ok, other, eps))) continue;
    valid.push(ok);
  }
  const withoutGrid = officialDropRegularSmallGridRings(valid);
  const kept = officialDxfDropContainingRings(withoutGrid, eps);
  if (kept.length > LAYOUT_ROOM_COUNT_CAP) return [];
  return kept;
}

function summarizeLayers(entities: ReadonlyArray<DxfEntity>): OfficialPlanLayerSummary[] {
  const map = new Map<string, OfficialPlanLayerSummary>();
  for (const entity of entities) {
    const name = officialEntityLayer(entity);
    const row = map.get(name);
    if (row) {
      row.entityCount += 1;
    } else {
      map.set(name, { name, role: officialPlanLayerRole(name), entityCount: 1 });
    }
  }
  return [...map.values()];
}

function compactLinework(
  segs: ReadonlyArray<[Vec2, Vec2]>,
  maxCount: number
): [Vec2, Vec2][] {
  if (segs.length <= maxCount) {
    return segs.map(([a, b]) => [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]);
  }
  const out: [Vec2, Vec2][] = [];
  const step = segs.length / maxCount;
  for (let i = 0; i < maxCount; i++) {
    const [a, b] = segs[Math.floor(i * step)]!;
    out.push([
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]);
  }
  return out;
}

function allVisibleSegments(entities: ReadonlyArray<DxfEntity>): [Vec2, Vec2][] {
  const segs: [Vec2, Vec2][] = [];
  for (const entity of entities) segs.push(...entitySegments(entity));
  return segs;
}

export function officialBuildRoomAnalysisSummary(
  entities: ReadonlyArray<DxfEntity>,
  contour: Vec2[] | null,
  candidateRings: Vec2[][]
): OfficialRoomAnalysisSummary {
  return {
    layers: summarizeLayers(entities),
    bounds: boundsOfSegments(allVisibleSegments(entities)),
    contour: contour ? contour.map((p) => ({ x: p.x, y: p.y })) : null,
    candidateRings: candidateRings.slice(0, 80).map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))),
    linework: compactLinework(allVisibleSegments(entities), 2500),
  };
}

export type OfficialFindLayoutRoomsResult = {
  layoutFound: boolean;
  rooms: Vec2[][];
  analysis: OfficialRoomAnalysisSummary;
};

/**
 * Search the imported plan for a room / architectural layout, never a lighting
 * RCP grid. Layout-like layers may use closed polylines, simple loops, and
 * network faces. If those layers are absent, only room-sized closed shapes that
 * are not a uniform small grid are considered (no full-network face walk).
 */
export function officialFindLayoutRoomsFromPlan(
  entities: ReadonlyArray<DxfEntity>,
  outline?: Vec2[] | null
): OfficialFindLayoutRoomsResult {
  const layoutEntities = entities.filter((e) =>
    officialIsLayoutPlanLayer(officialEntityLayer(e))
  );
  const nonRcp = entities.filter(
    (e) => !officialIsRcpOrLightingLayer(officialEntityLayer(e))
  );

  const tryRings = (source: ReadonlyArray<DxfEntity>, allowNetwork: boolean): Vec2[][] => {
    if (source.length === 0) return [];
    if (looksLikeUniformGridEntities(source) && !allowNetwork) {
      const closed = officialFilterFromPlanRoomRings(
        collectClosedAndLoopRings(source),
        outline
      );
      return closed;
    }
    const rings = collectClosedAndLoopRings(source);
    if (allowNetwork && !looksLikeUniformGridEntities(source)) {
      rings.push(...collectLayoutNetworkFaces(source));
    }
    return officialFilterFromPlanRoomRings(rings, outline);
  };

  let rooms: Vec2[][] = [];
  let layoutFound = false;

  if (layoutEntities.length > 0) {
    rooms = tryRings(layoutEntities, true);
    layoutFound = rooms.length > 0;
  }

  if (!layoutFound) {
    const closedOnNonRcp = tryRings(nonRcp, false);
    if (closedOnNonRcp.length > 0) {
      rooms = closedOnNonRcp;
      layoutFound = true;
    }
  }

  const candidateSource = layoutEntities.length > 0 ? layoutEntities : nonRcp;
  const candidates = officialFilterFromPlanRoomRings(
    collectClosedAndLoopRings(candidateSource),
    outline
  );

  return {
    layoutFound,
    rooms,
    analysis: officialBuildRoomAnalysisSummary(entities, outline ?? null, candidates),
  };
}

export type OfficialFromPlanAiFailReason =
  | "timeout"
  | "model-unavailable"
  | "provider-error"
  | "invalid-response";

export type OfficialFromPlanStatusFlags = {
  outlineCreated: boolean;
  outlineExisting: boolean;
  outlineReplaced?: boolean;
  outlineFailed: boolean;
  created: number;
  roomSource: "layout" | "ai" | "none";
  aiConfigured?: boolean;
  aiFailed?: boolean;
  aiFailReason?: OfficialFromPlanAiFailReason;
};

export function formatOfficialFromPlanStatus(flags: OfficialFromPlanStatusFlags): string {
  const contourEn = flags.outlineCreated
    ? "Storey contour created."
    : flags.outlineReplaced
      ? "Storey contour updated."
      : flags.outlineExisting
        ? "Storey contour left unchanged."
        : flags.outlineFailed
          ? "A storey contour could not be created from the plan."
          : "No storey contour was set.";
  const contourZh = flags.outlineCreated
    ? "已建立樓層輪廓。"
    : flags.outlineReplaced
      ? "已更新樓層輪廓。"
      : flags.outlineExisting
        ? "樓層輪廓維持不變。"
        : flags.outlineFailed
          ? "無法從圖則建立樓層輪廓。"
          : "未設定樓層輪廓。";

  let roomsEn = "";
  let roomsZh = "";
  if (flags.roomSource === "layout") {
    roomsEn =
      flags.created === 1
        ? " Created 1 room from the layout plan."
        : ` Created ${flags.created} rooms from the layout plan.`;
    roomsZh =
      flags.created === 1
        ? " 已從房間佈局圖建立 1 個房間。"
        : ` 已從房間佈局圖建立 ${flags.created} 個房間。`;
  } else if (flags.roomSource === "ai") {
    if (flags.created > 0) {
      roomsEn =
        flags.created === 1
          ? " No room layout plan was found. AI analysis created 1 room."
          : ` No room layout plan was found. AI analysis created ${flags.created} rooms.`;
      roomsZh =
        flags.created === 1
          ? " 找不到房間佈局圖。AI 辨認後建立了 1 個房間。"
          : ` 找不到房間佈局圖。AI 辨認後建立了 ${flags.created} 個房間。`;
    } else {
      roomsEn = " No room layout plan was found, and AI analysis found no rooms.";
      roomsZh = " 找不到房間佈局圖，AI 也未能辨認出房間。";
    }
  } else if (flags.aiFailed) {
    if (flags.aiFailReason === "model-unavailable") {
      roomsEn =
        " No room layout plan was found, and AI analysis failed because the configured model is not available. No rooms were added.";
      roomsZh = " 找不到房間佈局圖，而且 AI 辨認失敗（已設定的模型無法使用）。沒有新增房間。";
    } else if (flags.aiFailReason === "timeout") {
      roomsEn =
        " No room layout plan was found, and AI analysis timed out. No rooms were added.";
      roomsZh = " 找不到房間佈局圖，而且 AI 辨認逾時。沒有新增房間。";
    } else {
      roomsEn = " No room layout plan was found, and AI analysis failed. No rooms were added.";
      roomsZh = " 找不到房間佈局圖，而且 AI 辨認失敗。沒有新增房間。";
    }
  } else if (flags.aiConfigured === false) {
    roomsEn =
      " No room layout plan was found, and AI analysis is not configured. A site administrator must enable Room-analysis AI in Admin → Settings and save an API key.";
    roomsZh =
      " 找不到房間佈局圖，而且尚未設定 AI 辨認。請網站管理員在「管理 → 設定」啟用房間辨認 AI 並儲存 API 金鑰。";
  } else {
    roomsEn = " No room layout plan was found.";
    roomsZh = " 找不到房間佈局圖。";
  }

  return `${contourEn}${roomsEn} / ${contourZh}${roomsZh}`;
}
