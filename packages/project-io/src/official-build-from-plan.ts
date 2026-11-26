import { appendOfficialNewRoom } from "./new-room-defaults";
import { officialDxfWorldEntitiesForRooms } from "./official-dxf-closed-rooms";
import {
  DXF_FROM_PLAN_ROOM_MIN_AREA_M2,
  formatOfficialFromPlanStatus,
  officialBuildRoomAnalysisSummary,
  officialCheapStoreyOutlineFromLinework,
  officialConvexHullRing,
  officialFilterFromPlanRoomRings,
  officialFindLayoutRoomsFromPlan,
  officialRoomRingsSubstantiallyOverlap,
  officialValidateFromPlanRoomRing,
  type OfficialRoomAnalysisSummary,
} from "./official-layout-plan";
import { officialDxfRingsMatch } from "./official-dxf-network-rooms";
import {
  DXF_CLOSED_VERTEX_EPS_M,
  officialDxfPointsCoincide,
} from "./official-dxf-polyline";
import { officialAppendStorey } from "./official-storey-metrics";
import {
  officialSetStoreyOutline,
} from "./official-storey-outline";
import type { DxfEntity, ProjectSceneV2, RoomV2, Vec2 } from "./types";

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

export { officialConvexHullRing, DXF_FROM_PLAN_ROOM_MIN_AREA_M2 };

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

function storeyOutline(
  scene: ProjectSceneV2,
  storeyId: string
): Vec2[] | null {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  if (!storey || !Array.isArray(storey.outline) || storey.outline.length < 3) {
    return null;
  }
  return storey.outline;
}

/**
 * Cheap outer boundary of the main visible linework cluster on this storey.
 * Returns null when the storey already has a contour, has no usable linework,
 * or no valid outer ring can be formed. This helper does not overwrite an
 * existing contour. The explicit Create from plan / Create rooms from DXF
 * command may replace a previous official contour. Does not enumerate inner
 * ceiling-grid faces.
 */
export function officialSuggestStoreyOutlineFromPlan(
  scene: ProjectSceneV2,
  storeyId: string
): Vec2[] | null {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  if (!storey) return null;
  if (Array.isArray(storey.outline) && storey.outline.length >= 3) return null;
  const underlay = scene.underlays.find((u) => u.storeyId === storeyId);
  const world = officialDxfWorldEntitiesForRooms(underlay);
  if (world.length === 0) return null;
  return officialCheapStoreyOutlineFromLinework(world);
}

export type OfficialFromPlanGeometryResult = {
  outline: Vec2[] | null;
  outlineCreated: boolean;
  outlineExisting: boolean;
  outlineFailed: boolean;
  layoutFound: boolean;
  rooms: Vec2[][];
  status: string;
  analysis: OfficialRoomAnalysisSummary;
};

/**
 * Compute the storey contour first (cheap outer boundary), then search for a
 * room layout on architectural layers. Does not invent a contour or rooms when
 * none can be made. Existing rooms are not returned — only new layout rooms.
 */
export function officialBuildFromPlanGeometry(
  worldEntities: ReadonlyArray<DxfEntity>,
  existingOutline?: Vec2[] | null
): OfficialFromPlanGeometryResult {
  const hasExisting =
    Array.isArray(existingOutline) && existingOutline.length >= 3;
  let outline: Vec2[] | null = hasExisting ? existingOutline!.map((p) => ({ x: p.x, y: p.y })) : null;
  let outlineCreated = false;
  let outlineFailed = false;

  if (!hasExisting) {
    const computed = officialCheapStoreyOutlineFromLinework(worldEntities);
    if (computed) {
      outline = computed;
      outlineCreated = true;
    } else {
      outlineFailed = true;
    }
  }

  const emptyAnalysis = officialBuildRoomAnalysisSummary(
    worldEntities,
    outline,
    []
  );

  if (!outline) {
    return {
      outline: null,
      outlineCreated: false,
      outlineExisting: false,
      outlineFailed,
      layoutFound: false,
      rooms: [],
      status: formatOfficialFromPlanStatus({
        outlineCreated: false,
        outlineExisting: false,
        outlineFailed,
        created: 0,
        roomSource: "none",
      }),
      analysis: emptyAnalysis,
    };
  }

  const found = officialFindLayoutRoomsFromPlan(worldEntities, outline);
  return {
    outline,
    outlineCreated,
    outlineExisting: hasExisting,
    outlineFailed: false,
    layoutFound: found.layoutFound,
    rooms: found.rooms,
    status: formatOfficialFromPlanStatus({
      outlineCreated,
      outlineExisting: hasExisting,
      outlineFailed: false,
      created: found.rooms.length,
      roomSource: found.layoutFound ? "layout" : "none",
    }),
    analysis: { ...found.analysis, contour: outline },
  };
}

export type OfficialApplyFromPlanGeometryInput = {
  outline?: Vec2[] | null;
  rooms: ReadonlyArray<Vec2[]>;
  heightM: number;
  nextRoomId: () => string;
  /** When true, do not replace an existing official contour. Default true. */
  keepExistingOutline?: boolean;
};

export type OfficialApplyFromPlanGeometryResult = {
  scene: ProjectSceneV2;
  created: number;
  outlineCreated: boolean;
  outlineReplaced: boolean;
};

/**
 * Apply a computed contour and new room rings to the scene as one write.
 * Existing rooms are left unchanged. An existing contour is left unchanged
 * unless keepExistingOutline is false.
 */
export function officialApplyFromPlanGeometry(
  scene: ProjectSceneV2,
  input: OfficialApplyFromPlanGeometryInput
): OfficialApplyFromPlanGeometryResult {
  const storeyId = scene.ui.activeStoreyId;
  const existing = storeyOutline(scene, storeyId);
  let next = scene;
  let outlineCreated = false;
  let outlineReplaced = false;
  const keepExisting = input.keepExistingOutline !== false;
  if (input.outline && input.outline.length >= 3 && (!existing || !keepExisting)) {
    const set = officialSetStoreyOutline(next, storeyId, input.outline);
    if (set.ok) {
      next = set.scene;
      outlineCreated = set.created;
      outlineReplaced = set.replaced;
    }
  }

  let created = 0;
  const outline = storeyOutline(next, storeyId);
  const rings = officialFilterFromPlanRoomRings(input.rooms, outline);
  const existingRings = next.rooms
    .filter((r) => r.storeyId === storeyId)
    .map((r) => roomRing(r));
  for (const ring of rings) {
    const valid = officialValidateFromPlanRoomRing(ring);
    if (!valid) continue;
    if (
      existingRings.some(
        (other) =>
          officialDxfRingsMatch(valid, other, DXF_CLOSED_VERTEX_EPS_M) ||
          officialRoomRingsSubstantiallyOverlap(valid, other, DXF_CLOSED_VERTEX_EPS_M)
      )
    ) {
      continue;
    }
    next = appendOfficialNewRoom(next, {
      id: input.nextRoomId(),
      polygon: valid,
      heightM: input.heightM,
    });
    existingRings.push(valid);
    created += 1;
  }

  return { scene: next, created, outlineCreated, outlineReplaced };
}

export type OfficialBuildFromPlanInput = {
  heightM: number;
  nextStoreyId: () => string;
  nextRoomId: () => string;
  /** When true, replace a previous official contour. Default true. */
  replaceExistingOutline?: boolean;
};

export type OfficialBuildFromPlanResult = {
  scene: ProjectSceneV2;
  created: number;
  outlineCreated: boolean;
  outlineExisting: boolean;
  outlineReplaced: boolean;
  outlineFailed: boolean;
  layoutFound: boolean;
  status: string;
  analysis: OfficialRoomAnalysisSummary;
};

/**
 * Create the official storey contour first, then rooms from a layout plan on
 * the active storey. Same path as Create rooms from DXF and Create from plan.
 * Does not overwrite existing rooms. An explicit run replaces a previous
 * official contour unless replaceExistingOutline is false. Heavy callers
 * should run this off the browser main thread (official server route).
 */
export function officialBuildStoreyAndRoomsFromPlan(
  scene: ProjectSceneV2,
  input: OfficialBuildFromPlanInput
): OfficialBuildFromPlanResult {
  const nextBase = officialEnsureActiveStoreyForPlanBuild(scene, input.nextStoreyId);
  const storeyId = nextBase.ui.activeStoreyId;
  const underlay = nextBase.underlays.find((u) => u.storeyId === storeyId);
  const world = officialDxfWorldEntitiesForRooms(underlay);
  const replace = input.replaceExistingOutline !== false;
  const existing = replace ? null : storeyOutline(nextBase, storeyId);
  const geometry = officialBuildFromPlanGeometry(world, existing);
  const applied = officialApplyFromPlanGeometry(nextBase, {
    outline: geometry.outline,
    rooms: geometry.rooms,
    heightM: input.heightM,
    nextRoomId: input.nextRoomId,
    keepExistingOutline: !replace,
  });
  return {
    scene: applied.scene,
    created: applied.created,
    outlineCreated: applied.outlineCreated,
    outlineExisting: geometry.outlineExisting,
    outlineReplaced: applied.outlineReplaced,
    outlineFailed: geometry.outlineFailed,
    layoutFound: geometry.layoutFound,
    status: formatOfficialFromPlanStatus({
      outlineCreated: applied.outlineCreated,
      outlineExisting: geometry.outlineExisting && !applied.outlineReplaced,
      outlineReplaced: applied.outlineReplaced,
      outlineFailed: geometry.outlineFailed,
      created: applied.created,
      roomSource: geometry.layoutFound ? "layout" : "none",
    }),
    analysis: geometry.analysis,
  };
}
