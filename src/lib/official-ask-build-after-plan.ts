import type { ProjectSceneV2 } from "@luxsim/project-io";

export const ASK_BUILD_AFTER_PLAN_TITLE_EN = "Build the storey and rooms?";
export const ASK_BUILD_AFTER_PLAN_TITLE_ZH = "要自行建立樓層和房間嗎？";
export const ASK_BUILD_AFTER_PLAN_BODY_EN =
  "Do you want to build the storey and rooms yourself, or create them from this plan?";
export const ASK_BUILD_AFTER_PLAN_BODY_ZH =
  "你要自行建立樓層和房間，還是由這份圖則自動建立？";
export const ASK_BUILD_AFTER_PLAN_SELF_EN = "I'll build them";
export const ASK_BUILD_AFTER_PLAN_SELF_ZH = "我自己建立";
export const ASK_BUILD_AFTER_PLAN_AUTO_EN = "Create from plan";
export const ASK_BUILD_AFTER_PLAN_AUTO_ZH = "從圖則建立";

/** Plan kinds that may prompt after a successful Import plan. */
export function officialIsCadPlanAssetKind(kind: string | null | undefined): boolean {
  return kind === "dwg" || kind === "dxf";
}

/**
 * After a successful DXF/DWG Import plan, ask whether to build the storey and
 * rooms when the active storey currently has zero rooms. Never in view-only.
 * Re-import onto a storey that already has rooms does not ask.
 */
export function officialShouldAskBuildAfterPlanImport(
  scene: Pick<ProjectSceneV2, "rooms" | "ui">,
  assetKind: string | null | undefined,
  readOnly: boolean
): boolean {
  if (readOnly) return false;
  if (!officialIsCadPlanAssetKind(assetKind)) return false;
  const storeyId = scene.ui.activeStoreyId;
  const roomCount = scene.rooms.filter((room) => room.storeyId === storeyId).length;
  return roomCount === 0;
}
