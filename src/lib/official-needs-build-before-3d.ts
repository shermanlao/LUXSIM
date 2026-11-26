import type { ProjectSceneV2, ViewMode } from "@luxsim/project-io";
import { officialValidateSimplePolygon } from "@luxsim/project-io";
import { shouldWaitForOfficialViewSwitch } from "./official-view-switch";

export const BUILD_MODEL_FIRST_TITLE_EN = "Build the model first";
export const BUILD_MODEL_FIRST_TITLE_ZH = "請先建立模型";
export const BUILD_MODEL_FIRST_BODY_EN =
  "Add a storey contour or at least one room before opening the 3D view.";
export const BUILD_MODEL_FIRST_BODY_ZH =
  "請先新增樓層輪廓或至少一個房間，再開啟 3D 視圖。";
export const BUILD_MODEL_FIRST_OK_LABEL = "OK";

/** True when any official storey has a valid floor-plate outline (storey contour). */
export function officialHasValidStoreyContour(
  scene: Pick<ProjectSceneV2, "storeys">,
): boolean {
  return scene.storeys.some((storey) => {
    if (!Array.isArray(storey.outline) || storey.outline.length < 3) return false;
    return officialValidateSimplePolygon(storey.outline).ok;
  });
}

/**
 * True when 3D should stay blocked: no valid storey contour on any storey,
 * and no official rooms. A floor-plate outline alone is enough; rooms alone
 * are also enough.
 */
export function officialNeedsBuildBefore3d(
  scene: Pick<ProjectSceneV2, "storeys" | "rooms">,
): boolean {
  if (scene.rooms.length > 0) return false;
  return !officialHasValidStoreyContour(scene);
}

/**
 * Whether clicking a view tab should show the build-first dialog instead of
 * switching. Already being in 3D does not re-open it. Front and Side are not gated.
 */
export function officialShouldPromptBuildBefore3d(
  currentView: string,
  nextView: ViewMode | string,
  scene: Pick<ProjectSceneV2, "storeys" | "rooms">,
): boolean {
  if (!shouldWaitForOfficialViewSwitch(currentView, nextView)) return false;
  return nextView === "persp3d" && officialNeedsBuildBefore3d(scene);
}
