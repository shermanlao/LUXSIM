import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";
import {
  formatCalcCompleteStatus,
  formatCalcEmptyError,
  planCalcRooms,
  type CalcRoomSkip,
  type CalcScope,
} from "@/lib/editor-calc-rooms";
import {
  formatMissingPhotometryStatus,
  missingPhotometryLuminaireIds,
  runPostPlaceCalcForRooms,
} from "@/lib/post-place-calc";
import type { WriteInstancesCalcDeps } from "@/lib/write-instances";

export type OfficialCalcSkip = CalcRoomSkip & {
  reason: "no-fixtures" | "missing-photometry";
  missingLuminaireIds?: string[];
};

export type OfficialClientCalcResult = {
  ok: boolean;
  /** False only when planning failed before any photometry or solver work. */
  started: boolean;
  status: string;
  results: ResultsV2;
  calculatedRoomIds: string[];
  skippedEmpty: OfficialCalcSkip[];
  skippedMissing: OfficialCalcSkip[];
  missingLuminaireIds: string[];
};

function roomName(scene: ProjectSceneV2, roomId: string): string {
  return scene.rooms.find((r) => r.id === roomId)?.name ?? roomId;
}

/**
 * Split planned rooms into those whose luminaires all have photometry,
 * and those that cannot be calculated because a source IES/LDT is missing.
 * Does not invent or substitute photometry.
 */
export async function partitionRoomsByPhotometry(
  scene: ProjectSceneV2,
  roomIds: string[],
  ensurePhotometry: WriteInstancesCalcDeps["ensurePhotometry"]
): Promise<{ readyRoomIds: string[]; skippedMissing: OfficialCalcSkip[] }> {
  const readyRoomIds: string[] = [];
  const skippedMissing: OfficialCalcSkip[] = [];
  for (const roomId of roomIds) {
    const missingLuminaireIds = await missingPhotometryLuminaireIds(
      scene,
      [roomId],
      ensurePhotometry
    );
    if (missingLuminaireIds.length) {
      skippedMissing.push({
        id: roomId,
        name: roomName(scene, roomId),
        reason: "missing-photometry",
        missingLuminaireIds,
      });
    } else {
      readyRoomIds.push(roomId);
    }
  }
  return { readyRoomIds, skippedMissing };
}

/**
 * Official Calc room / Calc storey / Calc all path. Calc storey and Calc all
 * skip rooms that lack photometry the same way they skip empty rooms: explain
 * in the status and still write results for rooms that can be calculated. A
 * direct Calc room request still fails clearly when that room itself lacks
 * photometry. The scene (fixtures) is never mutated. Calc storey only plans
 * rooms on `scene.ui.activeStoreyId`; other storeys’ existing results are kept.
 */
export async function runOfficialClientCalc(
  scene: ProjectSceneV2,
  results: ResultsV2,
  scope: CalcScope,
  deps: WriteInstancesCalcDeps,
  options?: { luminaireNames?: Record<string, string>; bilingual?: boolean }
): Promise<OfficialClientCalcResult> {
  const plan = planCalcRooms(scene, scope);
  const skippedEmpty: OfficialCalcSkip[] = plan.skippedEmpty.map((s) => ({
    ...s,
    reason: "no-fixtures",
  }));

  if (!plan.ok) {
    return {
      ok: false,
      started: false,
      status: formatCalcEmptyError(plan),
      results,
      calculatedRoomIds: [],
      skippedEmpty,
      skippedMissing: [],
      missingLuminaireIds: [],
    };
  }

  const { readyRoomIds, skippedMissing } = await partitionRoomsByPhotometry(
    scene,
    plan.roomIds,
    deps.ensurePhotometry
  );

  // Calc room: a single-room request with missing photometry lands here with
  // no ready rooms and fails clearly. Calc storey / Calc all skip missing
  // photometry rooms like empty rooms when others remain.
  if (!readyRoomIds.length) {
    const missingLuminaireIds = [
      ...new Set(skippedMissing.flatMap((s) => s.missingLuminaireIds ?? [])),
    ];
    return {
      ok: false,
      started: true,
      status: formatMissingPhotometryStatus(missingLuminaireIds, options?.luminaireNames),
      results,
      calculatedRoomIds: [],
      skippedEmpty,
      skippedMissing,
      missingLuminaireIds,
    };
  }

  const calc = await runPostPlaceCalcForRooms(scene, results, readyRoomIds, deps, {
    luminaireNames: options?.luminaireNames,
  });

  if (calc.calcFailed) {
    return {
      ok: false,
      started: true,
      status: calc.errorMessage ?? "Calculation failed / 計算失敗",
      results,
      calculatedRoomIds: [],
      skippedEmpty,
      skippedMissing,
      missingLuminaireIds: calc.missingLuminaireIds,
    };
  }

  return {
    ok: true,
    started: true,
    status: formatCalcCompleteStatus(
      plan.skippedEmpty,
      options?.bilingual ?? true,
      skippedMissing
    ),
    results: calc.results,
    calculatedRoomIds: readyRoomIds,
    skippedEmpty,
    skippedMissing,
    missingLuminaireIds: skippedMissing.flatMap((s) => s.missingLuminaireIds ?? []),
  };
}
