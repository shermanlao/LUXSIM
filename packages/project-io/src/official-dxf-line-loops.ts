import type { DxfEntity, Vec2 } from "./types";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfPointsCoincide,
  officialDxfPolylineClosed,
} from "./official-dxf-polyline";

/**
 * Segments used to look for simple line loops: LINE entities, and consecutive
 * vertices of *open* LWPOLYLINE paths. Closed polylines are excluded so they
 * stay on the official closed-polyline room path and are not double-created.
 * Zero-length segments are dropped. Open paths still have no invented closing
 * edge.
 */
export function officialDxfOpenPathSegments(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>
): [Vec2, Vec2][] {
  const segs: [Vec2, Vec2][] = [];
  for (const entity of entities) {
    if (officialDxfPolylineClosed(entity)) continue;
    const pts = entity.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
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

function nextAlongDegree2(adj: number[][], cur: number, prev: number): number | null {
  const nbrs = adj[cur] ?? [];
  if (nbrs.length !== 2) return null;
  if (nbrs[0] === prev) return nbrs[1]!;
  if (nbrs[1] === prev) return nbrs[0]!;
  return null;
}

/**
 * Simple closed loops formed by joining open LINE / LWPOLYLINE endpoints that
 * coincide within DXF_CLOSED_VERTEX_EPS_M. A simple loop in this increment is
 * a cycle in which every vertex has degree exactly 2 (a single closed chain).
 * Vertices with degree ≠ 2 are ignored: T-junctions, figure-8 / degree-4
 * shared vertices, and shared-edge networks do not invent a room by picking
 * an arbitrary cycle through a junction.
 */
export function officialDxfSimpleLineLoopRings(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>,
  epsM: number = DXF_CLOSED_VERTEX_EPS_M
): Vec2[][] {
  const segs = officialDxfOpenPathSegments(entities);
  const vertices: Vec2[] = [];
  const adj: number[][] = [];

  for (const [p, q] of segs) {
    const a = vertexIndex(vertices, p, epsM);
    const b = vertexIndex(vertices, q, epsM);
    if (a === b) continue;
    while (adj.length <= Math.max(a, b)) adj.push([]);
    adj[a]!.push(b);
    adj[b]!.push(a);
  }

  const n = vertices.length;
  const degree = Array.from({ length: n }, (_, i) => adj[i]?.length ?? 0);
  const used = Array.from({ length: n }, () => false);
  const rings: Vec2[][] = [];

  for (let start = 0; start < n; start++) {
    if (used[start] || degree[start] !== 2) continue;

    const ringIdx: number[] = [start];
    const first = adj[start]![0]!;
    let prev = start;
    let cur: number | null = first;
    let ok = true;

    while (cur !== start) {
      if (cur === null || degree[cur] !== 2 || used[cur]) {
        ok = false;
        break;
      }
      used[cur] = true;
      ringIdx.push(cur);
      const next = nextAlongDegree2(adj, cur, prev);
      prev = cur;
      cur = next;
      if (ringIdx.length > n) {
        ok = false;
        break;
      }
    }

    if (!ok || cur !== start || ringIdx.length < 3) {
      continue;
    }
    used[start] = true;
    rings.push(ringIdx.map((i) => ({ x: vertices[i]!.x, y: vertices[i]!.y })));
  }

  return rings;
}

/** True when at least one simple degree-2 line loop exists after world mapping. */
export function officialDxfHasSimpleLineLoop(
  entities: ReadonlyArray<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>
): boolean {
  return officialDxfSimpleLineLoopRings(entities).length > 0;
}
