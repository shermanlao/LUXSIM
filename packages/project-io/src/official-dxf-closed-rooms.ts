import { roomAreaM2 } from "./geometry";
import { appendOfficialNewRoom } from "./new-room-defaults";
import {
  officialDxfEntitiesToWorld,
  type OfficialDxfWorldUnderlay,
} from "./official-dxf-world";
import {
  officialDxfHasSimpleLineLoop,
  officialDxfSimpleLineLoopRings,
} from "./official-dxf-line-loops";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfClosedRingVertices,
  officialDxfPointsCoincide,
  officialDxfPolylineClosed,
} from "./official-dxf-polyline";
import type { DxfEntity, ProjectSceneV2, RoomV2, Vec2 } from "./types";

/** Official skip threshold for a degenerate closed-polyline or line-loop room. */
export const DXF_CLOSED_ROOM_MIN_AREA_M2 = 0.01;

export const DXF_CLOSED_ROOMS_NONE_STATUS =
  "No valid closed DXF polylines or simple line loops to create as rooms. T-junction and shared-wall networks are not auto-traced. Degenerate outlines and rooms that already exist on this storey are skipped.";

export const DXF_CLOSED_ROOMS_NEED_DXF_STATUS =
  "Create rooms from DXF needs a DXF underlay on the current storey.";

export function formatDxfClosedRoomsCreatedStatus(created: number): string {
  if (created <= 0) return DXF_CLOSED_ROOMS_NONE_STATUS;
  return created === 1
    ? "Created 1 room from DXF"
    : `Created ${created} rooms from DXF`;
}

export type OfficialDxfRoomsUnderlay = OfficialDxfWorldUnderlay & {
  kind?: string;
  dxfEntities?: DxfEntity[];
};

/** World-mapped entities for a parsed DXF underlay; otherwise []. */
export function officialDxfWorldEntitiesForRooms(
  underlay: OfficialDxfRoomsUnderlay | null | undefined
): DxfEntity[] {
  if (!underlay || underlay.kind !== "dxf") return [];
  return officialDxfEntitiesToWorld(underlay.dxfEntities ?? [], underlay);
}

/**
 * The official command is enabled when the current storey’s underlay is a
 * parsed DXF and at least one closed polyline or simple LINE / open-polyline
 * loop exists after world mapping.
 */
export function officialCanCreateRoomsFromDxf(
  underlay: OfficialDxfRoomsUnderlay | null | undefined
): boolean {
  const world = officialDxfWorldEntitiesForRooms(underlay);
  return (
    world.some((entity) => officialDxfPolylineClosed(entity)) ||
    officialDxfHasSimpleLineLoop(world)
  );
}

function uniqueVertexCount(points: Vec2[], epsM: number): number {
  const unique: Vec2[] = [];
  for (const p of points) {
    if (!unique.some((q) => officialDxfPointsCoincide(p, q, epsM))) unique.push(p);
  }
  return unique.length;
}

function polygonAreaM2(polygon: Vec2[]): number {
  return roomAreaM2({ polygon } as RoomV2);
}

function ringsMatch(a: Vec2[], b: Vec2[], epsM: number): boolean {
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

export type OfficialAppendDxfClosedRoomsInput = {
  heightM: number;
  nextId: () => string;
};

export type OfficialAppendDxfClosedRoomsResult = {
  scene: ProjectSceneV2;
  created: number;
  skipped: number;
  status: string;
};

function considerRing(
  ring: Vec2[],
  existingRings: Vec2[][],
  next: ProjectSceneV2,
  input: OfficialAppendDxfClosedRoomsInput
): { next: ProjectSceneV2; created: boolean } {
  if (
    ring.length < 3 ||
    uniqueVertexCount(ring, DXF_CLOSED_VERTEX_EPS_M) < 3 ||
    polygonAreaM2(ring) < DXF_CLOSED_ROOM_MIN_AREA_M2
  ) {
    return { next, created: false };
  }
  if (existingRings.some((other) => ringsMatch(ring, other, DXF_CLOSED_VERTEX_EPS_M))) {
    return { next, created: false };
  }
  const created = appendOfficialNewRoom(next, {
    id: input.nextId(),
    polygon: ring,
    heightM: input.heightM,
  });
  existingRings.push(ring);
  return { next: created, created: true };
}

/**
 * Create official new rooms on the current storey from (a) each valid closed
 * DXF polyline, then (b) each valid simple loop of connected LINE / open
 * LWPOLYLINE segments. T-junction, figure-8, and shared-wall networks are
 * not auto-traced. Existing rooms are left unchanged. Degenerate rings and
 * outlines that already exist on the storey (including a loop that matches a
 * closed polyline just created) are skipped.
 */
export function officialAppendRoomsFromDxfClosedPolylines(
  scene: ProjectSceneV2,
  input: OfficialAppendDxfClosedRoomsInput
): OfficialAppendDxfClosedRoomsResult {
  const underlay = scene.underlays.find((u) => u.storeyId === scene.ui.activeStoreyId);
  if (!underlay || underlay.kind !== "dxf") {
    return {
      scene,
      created: 0,
      skipped: 0,
      status: DXF_CLOSED_ROOMS_NEED_DXF_STATUS,
    };
  }

  const world = officialDxfEntitiesToWorld(underlay.dxfEntities ?? [], underlay);
  const storeyId = scene.ui.activeStoreyId;
  const existingRings = scene.rooms
    .filter((room) => room.storeyId === storeyId)
    .map((room) => roomRing(room));

  let next = scene;
  let created = 0;
  let skipped = 0;

  for (const entity of world) {
    if (!officialDxfPolylineClosed(entity)) continue;
    const ring = officialDxfClosedRingVertices(entity);
    if (!ring) {
      skipped += 1;
      continue;
    }
    const out = considerRing(ring, existingRings, next, input);
    next = out.next;
    if (out.created) created += 1;
    else skipped += 1;
  }

  for (const ring of officialDxfSimpleLineLoopRings(world)) {
    const out = considerRing(ring, existingRings, next, input);
    next = out.next;
    if (out.created) created += 1;
    else skipped += 1;
  }

  if (created === 0) {
    return { scene, created: 0, skipped, status: DXF_CLOSED_ROOMS_NONE_STATUS };
  }
  return {
    scene: next,
    created,
    skipped,
    status: formatDxfClosedRoomsCreatedStatus(created),
  };
}
