import type { ProjectSceneV2, Vec2 } from "./types";
import { officialRoomRingVertices, validateStretchedRoomPolygon } from "./official-room-vertex";

export const STOREY_OUTLINE_REFUSE_VERTICES_STATUS =
  "Storey contour refused: need at least 3 unique corners.";
export const STOREY_OUTLINE_REFUSE_CROSS_STATUS =
  "Storey contour refused: the outline would cross itself.";
export const STOREY_OUTLINE_REFUSE_AREA_STATUS =
  "Storey contour refused: the area would be below 0.01 m².";
export const STOREY_OUTLINE_REFUSE_MISSING_STATUS =
  "Storey contour refused: the storey is missing.";
export const STOREY_OUTLINE_CREATED_STATUS = "Storey contour created";
export const STOREY_OUTLINE_REPLACED_STATUS = "Storey contour replaced";

export type OfficialStoreyOutlineReason =
  | "ok"
  | "missing-storey"
  | "degenerate-vertices"
  | "self-crossing"
  | "area";

export type OfficialSetStoreyOutlineResult = {
  scene: ProjectSceneV2;
  ok: boolean;
  created: boolean;
  replaced: boolean;
  reason: OfficialStoreyOutlineReason;
  status: string;
};

function refuseStatus(reason: OfficialStoreyOutlineReason): string {
  if (reason === "missing-storey") return STOREY_OUTLINE_REFUSE_MISSING_STATUS;
  if (reason === "self-crossing") return STOREY_OUTLINE_REFUSE_CROSS_STATUS;
  if (reason === "area") return STOREY_OUTLINE_REFUSE_AREA_STATUS;
  return STOREY_OUTLINE_REFUSE_VERTICES_STATUS;
}

/** Official simple-polygon check shared with rooms (no holes). */
export function officialValidateSimplePolygon(
  polygon: Vec2[]
): { ok: true; ring: Vec2[] } | { ok: false; reason: Exclude<OfficialStoreyOutlineReason, "ok" | "missing-storey"> } {
  const ring = officialRoomRingVertices(polygon).map((p) => ({ x: p.x, y: p.y }));
  const check = validateStretchedRoomPolygon(ring);
  if (!check.ok) return { ok: false, reason: check.reason };
  return { ok: true, ring };
}

/**
 * Set or replace the official floor-plate outline on a storey.
 * Invalid polygons are refused and the scene is left unchanged.
 * Closing a new path replaces any previous outline as one step.
 */
export function officialSetStoreyOutline(
  scene: ProjectSceneV2,
  storeyId: string,
  polygon: Vec2[]
): OfficialSetStoreyOutlineResult {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  if (!storey) {
    return {
      scene,
      ok: false,
      created: false,
      replaced: false,
      reason: "missing-storey",
      status: STOREY_OUTLINE_REFUSE_MISSING_STATUS,
    };
  }
  const valid = officialValidateSimplePolygon(polygon);
  if (!valid.ok) {
    return {
      scene,
      ok: false,
      created: false,
      replaced: false,
      reason: valid.reason,
      status: refuseStatus(valid.reason),
    };
  }
  const replaced = Array.isArray(storey.outline) && storey.outline.length >= 3;
  const storeys = scene.storeys.map((s) =>
    s.id === storeyId ? { ...s, outline: valid.ring } : s
  );
  return {
    scene: { ...scene, storeys },
    ok: true,
    created: !replaced,
    replaced,
    reason: "ok",
    status: replaced ? STOREY_OUTLINE_REPLACED_STATUS : STOREY_OUTLINE_CREATED_STATUS,
  };
}
