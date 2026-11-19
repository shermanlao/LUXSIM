import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";
import {
  runClientCalcForRooms,
  type WriteInstancesCalcDeps,
} from "@/lib/write-instances";

export type PostPlaceCalcResult = {
  results: ResultsV2;
  calcFailed: boolean;
  missingLuminaireIds: string[];
  errorMessage?: string;
};

export function luminaireIdsForRooms(scene: ProjectSceneV2, roomIds: string[]): string[] {
  const roomSet = new Set(roomIds);
  const ids = new Set<string>();
  for (const inst of scene.instances) {
    if (inst.roomId && roomSet.has(inst.roomId)) ids.add(inst.luminaireId);
  }
  return [...ids];
}

export async function missingPhotometryLuminaireIds(
  scene: ProjectSceneV2,
  roomIds: string[],
  ensurePhotometry: WriteInstancesCalcDeps["ensurePhotometry"]
): Promise<string[]> {
  const missing: string[] = [];
  for (const luminaireId of luminaireIdsForRooms(scene, roomIds)) {
    const photo = await ensurePhotometry(luminaireId);
    if (!photo) missing.push(luminaireId);
  }
  return missing;
}

export function formatMissingPhotometryStatus(
  missingIds: string[],
  luminaireNames?: Record<string, string>
): string {
  const labels = missingIds.map((id) => luminaireNames?.[id] ?? id);
  return `Missing photometry — upload IES/LDT: ${labels.join(", ")} / 缺少配光檔：${labels.join("、")}`;
}

/** Shared client calc after placement (RCP commit, array, drag-drop, Calc button). */
export async function runPostPlaceCalcForRooms(
  scene: ProjectSceneV2,
  results: ResultsV2,
  roomIds: string[],
  deps: WriteInstancesCalcDeps,
  options?: { luminaireNames?: Record<string, string> }
): Promise<PostPlaceCalcResult> {
  if (!roomIds.length) {
    return { results, calcFailed: false, missingLuminaireIds: [] };
  }

  const missing = await missingPhotometryLuminaireIds(scene, roomIds, deps.ensurePhotometry);
  if (missing.length) {
    return {
      results,
      calcFailed: true,
      missingLuminaireIds: missing,
      errorMessage: formatMissingPhotometryStatus(missing, options?.luminaireNames),
    };
  }

  try {
    const next = await runClientCalcForRooms(scene, results, roomIds, deps);
    return { results: next, calcFailed: false, missingLuminaireIds: [] };
  } catch (e) {
    return {
      results,
      calcFailed: true,
      missingLuminaireIds: [],
      errorMessage: e instanceof Error ? e.message : "Calculation failed",
    };
  }
}

/** Pick a room for the results strip after batch placement. */
export function focusActiveRoomAfterPlacement(
  scene: ProjectSceneV2,
  affectedRoomIds: string[]
): ProjectSceneV2 {
  if (!affectedRoomIds.length) return scene;
  const current = scene.ui.activeRoomId;
  if (current && affectedRoomIds.includes(current)) return scene;
  return {
    ...scene,
    ui: { ...scene.ui, activeRoomId: affectedRoomIds[0]! },
  };
}

export function postPlaceCalcStatusSuffix(calc: PostPlaceCalcResult, requested: boolean): string {
  if (!requested) return "";
  if (!calc.calcFailed) return " · calculated / 已計算";
  if (calc.missingLuminaireIds.length) {
    return ` · ${calc.errorMessage ?? "calc skipped"}`;
  }
  return " · calc failed (fixtures kept) / 計算失敗（燈具已保留）";
}
