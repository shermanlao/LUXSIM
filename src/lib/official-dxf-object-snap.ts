import {
  officialDxfEntitySegments,
  type DxfEntity,
  type Vec2,
} from "@luxsim/project-io";

/**
 * Official DXF object-snap aperture, in CSS pixels at the current official
 * plan zoom. Converted to world metres with the same client→world scale used
 * for Draw room and array picks (`worldMetresPerCssPixel`).
 */
export const DXF_OBJECT_SNAP_CSS_PX = 8;

/**
 * Distances within this many metres are a tie, so an endpoint or midpoint
 * at the same location wins over nearest-on-segment.
 */
export const DXF_SNAP_TIE_EPS_M = 1e-9;

/** Closest-first, then this stable order when distances tie. */
export const DXF_SNAP_KIND_PRIORITY = ["endpoint", "midpoint", "nearest"] as const;

export type DxfSnapKind = (typeof DXF_SNAP_KIND_PRIORITY)[number];

export type DxfSnapCandidate = {
  kind: DxfSnapKind;
  point: Vec2;
};

export type DxfSnapHit = DxfSnapCandidate & {
  distanceM: number;
};

const KIND_RANK: Record<DxfSnapKind, number> = {
  endpoint: 0,
  midpoint: 1,
  nearest: 2,
};

/** World-metre snap radius for 8 CSS pixels at the current plan zoom. */
export function dxfObjectSnapRadiusM(metresPerCssPx: number): number {
  if (!(Number.isFinite(metresPerCssPx) && metresPerCssPx > 0)) return 0;
  return metresPerCssPx * DXF_OBJECT_SNAP_CSS_PX;
}

/**
 * Only a parsed DXF underlay with LINE / LWPOLYLINE entities is snappable.
 * DWG, rasters, empty entity lists, and missing underlays yield [].
 */
export function officialDxfSnapEntities(
  underlay: { kind?: string; dxfEntities?: DxfEntity[] } | null | undefined,
  entities?: DxfEntity[] | null
): DxfEntity[] {
  if (!underlay || underlay.kind !== "dxf") return [];
  const list = entities ?? underlay.dxfEntities ?? [];
  return list.length > 0 ? list : [];
}

export function nearestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Endpoint and midpoint of every displayed segment, plus the nearest point
 * on that segment to the pointer. Closed polylines include the official
 * closing segment. Open LINE / LWPOLYLINE paths stay open — no invented
 * closing edge.
 */
export function collectDxfSnapCandidates(
  entities: Array<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>,
  pointer: Vec2
): DxfSnapCandidate[] {
  const candidates: DxfSnapCandidate[] = [];
  for (const ent of entities) {
    for (const [a, b] of officialDxfEntitySegments(ent)) {
      candidates.push({ kind: "endpoint", point: { x: a.x, y: a.y } });
      candidates.push({ kind: "endpoint", point: { x: b.x, y: b.y } });
      candidates.push({
        kind: "midpoint",
        point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      });
      candidates.push({
        kind: "nearest",
        point: nearestPointOnSegment(pointer, a, b),
      });
    }
  }
  return candidates;
}

export function pickDxfSnapCandidate(
  pointer: Vec2,
  candidates: DxfSnapCandidate[],
  radiusM: number
): DxfSnapHit | null {
  if (!(Number.isFinite(radiusM) && radiusM > 0) || candidates.length === 0) return null;
  let best: DxfSnapHit | null = null;
  for (const c of candidates) {
    const distanceM = Math.hypot(c.point.x - pointer.x, c.point.y - pointer.y);
    if (!(distanceM <= radiusM)) continue;
    const hit: DxfSnapHit = { kind: c.kind, point: c.point, distanceM };
    if (!best) {
      best = hit;
      continue;
    }
    const delta = hit.distanceM - best.distanceM;
    if (delta < -DXF_SNAP_TIE_EPS_M) {
      best = hit;
    } else if (Math.abs(delta) <= DXF_SNAP_TIE_EPS_M && KIND_RANK[hit.kind] < KIND_RANK[best.kind]) {
      best = hit;
    }
  }
  return best;
}

export function pickDxfObjectSnap(
  pointer: Vec2,
  entities: Array<Pick<DxfEntity, "points" | "closed"> & { type?: DxfEntity["type"] }>,
  radiusM: number
): DxfSnapHit | null {
  if (!entities.length) return null;
  return pickDxfSnapCandidate(pointer, collectDxfSnapCandidates(entities, pointer), radiusM);
}
