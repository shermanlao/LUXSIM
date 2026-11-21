import {
  findRoomAt,
  officialDxfTextLabelsToWorld,
  officialVisibleDxfTextLabels,
  type FixtureCodeMapRule,
  type OfficialDxfTextLabel,
  type OfficialDxfWorldUnderlay,
  type ProjectSceneV2,
  type ResultsV2,
  type RoomV2,
} from "@luxsim/project-io";
import { lookupFixtureCode, type CodeMapStatus } from "@/lib/fixture-code-map";
import {
  focusActiveRoomAfterPlacement,
  runPostPlaceCalcForRooms,
} from "@/lib/post-place-calc";
import {
  type FixtureInstanceDraft,
  type WriteInstancesCalcDeps,
  writeFixtureInstances,
} from "@/lib/write-instances";

export const PLAN_CODE_REFUSE_NO_PLAN =
  "Import a DXF or converted DWG plan first / 請先匯入 DXF 或已轉換的 DWG 圖則";
export const PLAN_CODE_REFUSE_NO_LABELS =
  "No lighting codes found on the plan / 圖則上沒有燈碼文字";
export const PLAN_CODE_REFUSE_NO_VISIBLE =
  "No visible plan codes on the current layers / 目前可見圖層沒有燈碼";

export type PlanCodeReviewStatus = "pending" | "accepted" | "rejected";

export type PlanCodePlaceRow = {
  id: string;
  codeRaw: string;
  x: number;
  y: number;
  rotationDeg: number;
  layer?: string;
  kind?: OfficialDxfTextLabel["kind"];
  reviewStatus: PlanCodeReviewStatus;
  mapStatus: CodeMapStatus;
  luminaireId?: string;
  roomId: string | null;
  outsideRoom: boolean;
};

export type PlanCodeImportSummary = {
  accepted: number;
  rejected: number;
  pending: number;
  readyForCommit: number;
  unmappedBlocked: number;
  outsideSkipped: number;
};

export type PlanCodeCommitPlan = {
  drafts: FixtureInstanceDraft[];
  readyRowIds: string[];
  skippedOutside: { codeRaw: string; x: number; y: number }[];
  planCodeSourcedOnStorey: number;
};

export type PlanCodeCommitOptions = {
  replaceExistingFromPlanCodes?: boolean;
  runCalc?: boolean;
};

export type PlanCodeCommitResult = {
  scene: ProjectSceneV2;
  results: ResultsV2;
  instanceIds: string[];
  affectedRoomIds: string[];
  skippedOutside: { codeRaw: string; x: number; y: number }[];
  calcFailed: boolean;
  calcErrorMessage?: string;
  missingLuminaireIds: string[];
  blockedReason?: string;
};

export type PlanCodeScanResult =
  | { ok: true; rows: PlanCodePlaceRow[]; outsideSkipped: number }
  | { ok: false; reason: string };

export function countPlanCodeSourcedInstances(
  scene: ProjectSceneV2,
  storeyId: string
): number {
  return scene.instances.filter((i) => i.planCodeId && i.storeyId === storeyId).length;
}

export function removePlanCodeSourcedInstances(
  scene: ProjectSceneV2,
  storeyId: string
): ProjectSceneV2 {
  return {
    ...scene,
    instances: scene.instances.filter(
      (i) => !(i.planCodeId && i.storeyId === storeyId)
    ),
  };
}

export function enrichPlanCodeLabels(
  labels: OfficialDxfTextLabel[],
  rules: FixtureCodeMapRule[],
  rooms: RoomV2[],
  storeyId: string
): PlanCodePlaceRow[] {
  return labels.map((label, index) => {
    const lookup = lookupFixtureCode(label.text, rules);
    const room = findRoomAt(rooms, storeyId, { x: label.x, y: label.y });
    const mapped = lookup.status === "mapped" && lookup.luminaireId;
    return {
      id: `plancode_${index}`,
      codeRaw: label.text,
      x: label.x,
      y: label.y,
      rotationDeg: Number.isFinite(label.rotationDeg) ? label.rotationDeg : 0,
      layer: label.layer,
      kind: label.kind,
      reviewStatus: mapped && room ? ("accepted" as const) : ("pending" as const),
      mapStatus: lookup.status,
      luminaireId: lookup.luminaireId,
      roomId: room?.id ?? null,
      outsideRoom: !room,
    };
  });
}

/**
 * Scale drawing-unit labels into scene metres, drop hidden layers, and
 * build the confirm table. Empty input or no remaining visible codes refuse
 * without inventing rows.
 */
export function scanPlanCodeLabels(input: {
  labels: OfficialDxfTextLabel[];
  underlay?: OfficialDxfWorldUnderlay;
  hiddenLayers?: Iterable<string> | null;
  rules: FixtureCodeMapRule[];
  rooms: RoomV2[];
  storeyId: string;
}): PlanCodeScanResult {
  if (!input.labels.length) {
    return { ok: false, reason: PLAN_CODE_REFUSE_NO_LABELS };
  }
  const visible = officialVisibleDxfTextLabels(input.labels, input.hiddenLayers);
  if (!visible.length) {
    return { ok: false, reason: PLAN_CODE_REFUSE_NO_VISIBLE };
  }
  const world = officialDxfTextLabelsToWorld(visible, input.underlay);
  const rows = enrichPlanCodeLabels(world, input.rules, input.rooms, input.storeyId);
  return {
    ok: true,
    rows,
    outsideSkipped: rows.filter((r) => r.outsideRoom).length,
  };
}

export function isPlanCodePositiveReview(status: PlanCodeReviewStatus): boolean {
  return status === "accepted";
}

export function planCodeRowReady(row: PlanCodePlaceRow): boolean {
  if (!isPlanCodePositiveReview(row.reviewStatus)) return false;
  if (row.mapStatus !== "mapped" || !row.luminaireId) return false;
  if (!row.roomId || row.outsideRoom) return false;
  return true;
}

export function summarizePlanCodeImport(rows: PlanCodePlaceRow[]): PlanCodeImportSummary {
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  let readyForCommit = 0;
  let unmappedBlocked = 0;
  let outsideSkipped = 0;

  for (const row of rows) {
    if (row.reviewStatus === "rejected") rejected += 1;
    else if (row.reviewStatus === "pending") pending += 1;
    else accepted += 1;

    if (planCodeRowReady(row)) readyForCommit += 1;
    else if (isPlanCodePositiveReview(row.reviewStatus)) {
      if (row.mapStatus !== "mapped") unmappedBlocked += 1;
      if (row.outsideRoom || !row.roomId) outsideSkipped += 1;
    } else if (row.outsideRoom) {
      outsideSkipped += 1;
    }
  }

  return {
    accepted,
    rejected,
    pending,
    readyForCommit,
    unmappedBlocked,
    outsideSkipped,
  };
}

/**
 * Accepted but unmapped or ambiguous rows block the whole commit.
 * Pipelines must not guess a luminaire.
 */
export function planCodeCommitBlockedReason(rows: PlanCodePlaceRow[]): string | null {
  const bad = rows.filter(
    (r) => isPlanCodePositiveReview(r.reviewStatus) && r.mapStatus !== "mapped"
  );
  if (bad.length) {
    return `${bad.length} accepted row(s) unmapped or ambiguous — map codes or reject / 已接受但未對應`;
  }
  return null;
}

export function planCodeImportCanCommit(
  summary: PlanCodeImportSummary,
  committing = false,
  blockedReason: string | null = null
): boolean {
  return summary.readyForCommit > 0 && !committing && !blockedReason;
}

export function acceptAllMappedPlanCodeRows(rows: PlanCodePlaceRow[]): PlanCodePlaceRow[] {
  return rows.map((r) => {
    if (r.reviewStatus === "rejected") return r;
    if (r.mapStatus === "mapped" && r.luminaireId && !r.outsideRoom) {
      return { ...r, reviewStatus: "accepted" as const };
    }
    return r;
  });
}

export function setPlanCodeRowStatus(
  row: PlanCodePlaceRow,
  reviewStatus: PlanCodeReviewStatus
): PlanCodePlaceRow {
  return { ...row, reviewStatus };
}

export function planPlanCodeCommit(
  rows: PlanCodePlaceRow[],
  scene: ProjectSceneV2,
  luminaireNames: Record<string, string>
): PlanCodeCommitPlan {
  const blocked = planCodeCommitBlockedReason(rows);
  if (blocked) {
    return {
      drafts: [],
      readyRowIds: [],
      skippedOutside: [],
      planCodeSourcedOnStorey: countPlanCodeSourcedInstances(scene, scene.ui.activeStoreyId),
    };
  }

  const drafts: FixtureInstanceDraft[] = [];
  const readyRowIds: string[] = [];
  const skippedOutside: { codeRaw: string; x: number; y: number }[] = [];
  const storeyId = scene.ui.activeStoreyId;

  for (const row of rows) {
    if (!isPlanCodePositiveReview(row.reviewStatus)) continue;
    if (row.mapStatus !== "mapped" || !row.luminaireId) continue;

    const room = row.roomId
      ? scene.rooms.find((r) => r.id === row.roomId)
      : findRoomAt(scene.rooms, storeyId, { x: row.x, y: row.y });

    if (!room) {
      skippedOutside.push({ codeRaw: row.codeRaw, x: row.x, y: row.y });
      continue;
    }

    const mountZ = room.heightM - 0.1;
    const name = row.codeRaw.trim() || luminaireNames[row.luminaireId] || "Fixture";
    drafts.push({
      luminaireId: row.luminaireId,
      storeyId,
      roomId: room.id,
      name,
      position: { x: row.x, y: row.y, z: mountZ },
      rotationDeg: row.rotationDeg,
      planCodeId: row.id,
    });
    readyRowIds.push(row.id);
  }

  return {
    drafts,
    readyRowIds,
    skippedOutside,
    planCodeSourcedOnStorey: countPlanCodeSourcedInstances(scene, storeyId),
  };
}

export async function commitPlanCodePlacements(
  input: {
    scene: ProjectSceneV2;
    results: ResultsV2;
    rows: PlanCodePlaceRow[];
    luminaireNames: Record<string, string>;
    options?: PlanCodeCommitOptions;
  },
  deps: WriteInstancesCalcDeps
): Promise<PlanCodeCommitResult> {
  const blockedReason = planCodeCommitBlockedReason(input.rows);
  if (blockedReason) {
    return {
      scene: input.scene,
      results: input.results,
      instanceIds: [],
      affectedRoomIds: [],
      skippedOutside: [],
      calcFailed: false,
      missingLuminaireIds: [],
      blockedReason,
    };
  }

  const plan = planPlanCodeCommit(input.rows, input.scene, input.luminaireNames);
  if (!plan.drafts.length) {
    return {
      scene: input.scene,
      results: input.results,
      instanceIds: [],
      affectedRoomIds: [],
      skippedOutside: plan.skippedOutside,
      calcFailed: false,
      missingLuminaireIds: [],
    };
  }

  let scene = input.scene;
  const storeyId = scene.ui.activeStoreyId;
  if (input.options?.replaceExistingFromPlanCodes) {
    scene = removePlanCodeSourcedInstances(scene, storeyId);
  }

  const out = await writeFixtureInstances(
    {
      scene,
      results: input.results,
      drafts: plan.drafts,
      options: { runCalc: false, calcScope: "room" },
    },
    deps
  );

  let results = out.results;
  let calcFailed = false;
  let calcErrorMessage: string | undefined;
  let missingLuminaireIds: string[] = [];

  if (input.options?.runCalc) {
    const calc = await runPostPlaceCalcForRooms(
      out.scene,
      results,
      out.affectedRoomIds,
      deps,
      { luminaireNames: input.luminaireNames }
    );
    results = calc.results;
    calcFailed = calc.calcFailed;
    calcErrorMessage = calc.errorMessage;
    missingLuminaireIds = calc.missingLuminaireIds;
  }

  const sceneWithFocus = focusActiveRoomAfterPlacement(out.scene, out.affectedRoomIds);

  return {
    scene: sceneWithFocus,
    results,
    instanceIds: out.instanceIds,
    affectedRoomIds: out.affectedRoomIds,
    skippedOutside: plan.skippedOutside,
    calcFailed,
    calcErrorMessage,
    missingLuminaireIds,
  };
}
