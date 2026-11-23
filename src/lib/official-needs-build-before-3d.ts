import type { ProjectSceneV2, ViewMode } from "@luxsim/project-io";
import { shouldWaitForOfficialViewSwitch } from "./official-view-switch";

export const BUILD_MODEL_FIRST_TITLE_EN = "Build the model first";
export const BUILD_MODEL_FIRST_TITLE_ZH = "請先建立模型";
export const BUILD_MODEL_FIRST_BODY_EN =
  "Add a storey and at least one room before opening the 3D view.";
export const BUILD_MODEL_FIRST_BODY_ZH =
  "請先新增樓層並建立至少一個房間，再開啟 3D 視圖。";
export const BUILD_MODEL_FIRST_OK_LABEL = "OK";

/** True when the project has no storeys, or has no rooms on any storey. */
export function officialNeedsBuildBefore3d(
  scene: Pick<ProjectSceneV2, "storeys" | "rooms">,
): boolean {
  return scene.storeys.length === 0 || scene.rooms.length === 0;
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
