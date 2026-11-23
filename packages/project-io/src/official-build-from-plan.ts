import {
  formatDxfClosedRoomsCreatedStatus,
  officialAppendRoomsFromDxfClosedPolylines,
  officialDxfWorldEntitiesForRooms,
} from "./official-dxf-closed-rooms";
import { officialDxfSimpleLineLoopRings } from "./official-dxf-line-loops";
import {
  officialDxfDropContainingRings,
  officialDxfNetworkFaceRings,
  officialDxfRingFullyContains,
  officialDxfRingsMatch,
} from "./official-dxf-network-rooms";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfClosedRingVertices,
  officialDxfPointsCoincide,
  officialDxfPolylineClosed,
} from "./official-dxf-polyline";
import { roomAreaM2 } from "./geometry";
import { officialAppendStorey } from "./official-storey-metrics";
import {
  officialSetStoreyOutline,
  officialValidateSimplePolygon,
  STOREY_OUTLINE_CREATED_STATUS,
} from "./official-storey-outline";
import type { ProjectSceneV2, RoomV2, Vec2 } from "./types";

function roomRing(room: Pick<RoomV2, "polygon">): Vec2[] {
  const pts = room.polygon;
  if (
    pts.length >= 2 &&
    officialDxfPointsCoincide(pts[0]!, pts[pts.length - 1]!)
  ) {
    return pts.slice(0, -1);
  }
  return pts;
}

function uniqueRings(rings: ReadonlyArray<Vec2[]>, epsM: number): Vec2[][] {
  const out: Vec2[][] = [];
  for (const ring of rings) {
    if (out.some((other) => officialDxfRingsMatch(ring, other, epsM))) continue;
    out.push(ring);
  }
  return out;
}

function ringAreaM2(ring: Vec2[]): number {
  return roomAreaM2({ polygon: ring } as RoomV2);
}

/** Collect the same candidate rings Create rooms from DXF considers, before drop. */
function officialDxfCandidateRingsForStorey(scene: ProjectSceneV2, storeyId: string): Vec2[][] {
  const underlay = scene.underlays.find((u) => u.storeyId === storeyId);
  const world = officialDxfWorldEntitiesForRooms(underlay);
  const closedRings: Vec2[][] = [];
  for (const entity of world) {
    if (!officialDxfPolylineClosed(entity)) continue;
    const ring = officialDxfClosedRingVertices(entity);
    if (ring) closedRings.push(ring);
  }
  const loopRings = officialDxfSimpleLineLoopRings(world);
  const networkRings = officialDxfNetworkFaceRings(world);
  return [...closedRings, ...loopRings, ...networkRings];
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

/**
 * Prefer a containing ring that Create rooms from DXF dropped; otherwise a
 * simple outer ring (convex hull) of the storey’s rooms when that polygon is
 * officially valid. Returns null when the storey already has a contour, has
 * no rooms, or no valid outer ring can be formed.
 */
export function officialSuggestStoreyOutlineFromPlan(
  scene: ProjectSceneV2,
  storeyId: string
): Vec2[] | null {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  if (!storey) return null;
  if (Array.isArray(storey.outline) && storey.outline.length >= 3) return null;

  const roomRings = scene.rooms
    .filter((room) => room.storeyId === storeyId)
    .map((room) => roomRing(room));
  if (roomRings.length === 0) return null;

  const eps = DXF_CLOSED_VERTEX_EPS_M;
  const all = uniqueRings(officialDxfCandidateRingsForStorey(scene, storeyId), eps);
  const kept = officialDxfDropContainingRings(all, eps);
  const dropped = all.filter(
    (ring) => !kept.some((other) => officialDxfRingsMatch(ring, other, eps))
  );

  let best: Vec2[] | null = null;
  let bestArea = 0;
  for (const ring of dropped) {
    const containsAll = roomRings.every(
      (rr) =>
        officialDxfRingsMatch(ring, rr, eps) ||
        officialDxfRingFullyContains(ring, rr, eps)
    );
    if (!containsAll) continue;
    const area = ringAreaM2(ring);
    if (area > bestArea) {
      best = ring;
      bestArea = area;
    }
  }
  if (best) {
    const valid = officialValidateSimplePolygon(best);
    if (valid.ok) return valid.ring;
  }

  const hull = officialConvexHullRing(roomRings.flatMap((r) => r));
  const validHull = officialValidateSimplePolygon(hull);
  return validHull.ok ? validHull.ring : null;
}

/**
 * Ensure the scene has an active storey (new-project defaults when empty) and
 * that CAD underlays land on that storey so Create rooms from DXF can run.
 */
export function officialEnsureActiveStoreyForPlanBuild(
  scene: ProjectSceneV2,
  nextStoreyId: () => string
): ProjectSceneV2 {
  if (scene.storeys.length > 0) {
    if (scene.storeys.some((s) => s.id === scene.ui.activeStoreyId)) return scene;
    const first = scene.storeys[0]!;
    return {
      ...scene,
      ui: { ...scene.ui, activeStoreyId: first.id, activeRoomId: null },
    };
  }

  const oldActive = scene.ui.activeStoreyId;
  const id = nextStoreyId();
  const withStorey = officialAppendStorey(scene, { id, name: "GF" });
  return {
    ...withStorey,
    underlays: withStorey.underlays.map((u) =>
      u.storeyId === oldActive ||
      !withStorey.storeys.some((s) => s.id === u.storeyId)
        ? { ...u, storeyId: id }
        : u
    ),
  };
}

export type OfficialBuildFromPlanInput = {
  heightM: number;
  nextStoreyId: () => string;
  nextRoomId: () => string;
};

export type OfficialBuildFromPlanResult = {
  scene: ProjectSceneV2;
  created: number;
  outlineCreated: boolean;
  status: string;
};

/**
 * Create rooms on the active storey with the same path as Create rooms from
 * DXF. When the storey has no contour and at least one room is created, set
 * the official storey outline from a dropped containing ring or a simple
 * outer ring of the created rooms. Does not overwrite existing rooms or an
 * existing contour. Zero rooms → no contour invented from leftover linework.
 */
export function officialBuildStoreyAndRoomsFromPlan(
  scene: ProjectSceneV2,
  input: OfficialBuildFromPlanInput
): OfficialBuildFromPlanResult {
  let next = officialEnsureActiveStoreyForPlanBuild(scene, input.nextStoreyId);
  const roomsResult = officialAppendRoomsFromDxfClosedPolylines(next, {
    heightM: input.heightM,
    nextId: input.nextRoomId,
  });
  next = roomsResult.scene;

  if (roomsResult.created <= 0) {
    return {
      scene: next,
      created: 0,
      outlineCreated: false,
      status: roomsResult.status,
    };
  }

  const storeyId = next.ui.activeStoreyId;
  const storey = next.storeys.find((s) => s.id === storeyId);
  const hasOutline =
    !!storey && Array.isArray(storey.outline) && storey.outline.length >= 3;
  if (hasOutline) {
    return {
      scene: next,
      created: roomsResult.created,
      outlineCreated: false,
      status: roomsResult.status,
    };
  }

  const ring = officialSuggestStoreyOutlineFromPlan(next, storeyId);
  if (!ring) {
    return {
      scene: next,
      created: roomsResult.created,
      outlineCreated: false,
      status: roomsResult.status,
    };
  }

  const outline = officialSetStoreyOutline(next, storeyId, ring);
  if (!outline.ok) {
    return {
      scene: next,
      created: roomsResult.created,
      outlineCreated: false,
      status: roomsResult.status,
    };
  }

  const roomStatus = formatDxfClosedRoomsCreatedStatus(roomsResult.created);
  return {
    scene: outline.scene,
    created: roomsResult.created,
    outlineCreated: true,
    status: `${roomStatus}. ${STOREY_OUTLINE_CREATED_STATUS}`,
  };
}
