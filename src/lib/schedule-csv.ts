import {
  findRoomAt,
  type FixtureCodeMapRule,
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

export type ScheduleReviewStatus = "pending" | "accepted" | "rejected";

export type ScheduleCsvParsedRow = {
  id: string;
  sourceLine: number;
  codeRaw: string;
  x: number;
  y: number;
  z?: number;
  rotationDeg: number;
  parseError?: string;
};

export type ScheduleImportRow = ScheduleCsvParsedRow & {
  reviewStatus: ScheduleReviewStatus;
  mapStatus: CodeMapStatus;
  luminaireId?: string;
  roomId: string | null;
  outsideRoom: boolean;
};

export type ScheduleImportSummary = {
  accepted: number;
  rejected: number;
  pending: number;
  readyForCommit: number;
  unmappedBlocked: number;
  outsideSkipped: number;
};

export type ScheduleCommitPlan = {
  drafts: FixtureInstanceDraft[];
  readyRowIds: string[];
  skippedOutside: { codeRaw: string; x: number; y: number }[];
};

export type ScheduleCommitResult = {
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

function splitCsvLine(line: string): string[] {
  return line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
}

function headerIndex(headers: string[], names: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const i = norm.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

/** Parse schedule CSV — coordinates in metres. Columns: code,x,y[,z,rotationDeg]. */
export function parseScheduleCsv(text: string): {
  rows: ScheduleCsvParsedRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: ScheduleCsvParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  let codeIdx = 0;
  let xIdx = 1;
  let yIdx = 2;
  let zIdx = -1;
  let rotIdx = -1;
  let headerDone = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = splitCsvLine(line);

    if (!headerDone) {
      const maybeCode = headerIndex(parts, ["code", "fixturecode", "type"]);
      const maybeX = headerIndex(parts, ["x", "xm", "x_m"]);
      const maybeY = headerIndex(parts, ["y", "ym", "y_m"]);
      if (maybeCode >= 0 && maybeX >= 0 && maybeY >= 0) {
        codeIdx = maybeCode;
        xIdx = maybeX;
        yIdx = maybeY;
        zIdx = headerIndex(parts, ["z", "zm", "z_m"]);
        rotIdx = headerIndex(parts, ["rotationdeg", "rotation", "rot", "rotdeg"]);
        headerDone = true;
        continue;
      }
      headerDone = true;
    }

    const id = `sched_${i}_${rows.length}`;
    const codeRaw = parts[codeIdx]?.trim() ?? "";
    const x = Number(parts[xIdx]);
    const y = Number(parts[yIdx]);
    const zPart = zIdx >= 0 ? parts[zIdx] : undefined;
    const z = zPart !== undefined && zPart !== "" ? Number(zPart) : undefined;
    const rotPart = rotIdx >= 0 ? parts[rotIdx] : undefined;
    const rotationDeg =
      rotPart !== undefined && rotPart !== "" ? Number(rotPart) : 0;

    if (!codeRaw) {
      errors.push(`Line ${i + 1}: missing code`);
      rows.push({
        id,
        sourceLine: i + 1,
        codeRaw: "",
        x: NaN,
        y: NaN,
        rotationDeg: 0,
        parseError: "missing code",
      });
      continue;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`Line ${i + 1}: invalid x/y (metres required)`);
      rows.push({
        id,
        sourceLine: i + 1,
        codeRaw,
        x,
        y,
        rotationDeg,
        parseError: "invalid coordinates",
      });
      continue;
    }
    if (z !== undefined && !Number.isFinite(z)) {
      errors.push(`Line ${i + 1}: invalid z`);
      rows.push({
        id,
        sourceLine: i + 1,
        codeRaw,
        x,
        y,
        rotationDeg,
        parseError: "invalid z",
      });
      continue;
    }
    if (!Number.isFinite(rotationDeg)) {
      errors.push(`Line ${i + 1}: invalid rotationDeg`);
      rows.push({
        id,
        sourceLine: i + 1,
        codeRaw,
        x,
        y,
        z,
        rotationDeg: 0,
        parseError: "invalid rotation",
      });
      continue;
    }

    rows.push({
      id,
      sourceLine: i + 1,
      codeRaw,
      x,
      y,
      z,
      rotationDeg,
    });
  }

  return { rows, errors };
}

export function enrichScheduleRows(
  parsed: ScheduleCsvParsedRow[],
  rules: FixtureCodeMapRule[],
  rooms: RoomV2[],
  storeyId: string
): ScheduleImportRow[] {
  return parsed.map((row) => {
    if (row.parseError) {
      return {
        ...row,
        reviewStatus: "rejected" as const,
        mapStatus: "unmapped" as const,
        roomId: null,
        outsideRoom: false,
      };
    }
    const lookup = lookupFixtureCode(row.codeRaw, rules);
    const room = findRoomAt(rooms, storeyId, { x: row.x, y: row.y });
    const mapped = lookup.status === "mapped" && lookup.luminaireId;
    return {
      ...row,
      reviewStatus: mapped ? ("accepted" as const) : ("pending" as const),
      mapStatus: lookup.status,
      luminaireId: lookup.luminaireId,
      roomId: room?.id ?? null,
      outsideRoom: !room,
    };
  });
}

export function isSchedulePositiveReview(status: ScheduleReviewStatus): boolean {
  return status === "accepted";
}

export function scheduleRowReady(row: ScheduleImportRow): boolean {
  if (row.parseError) return false;
  if (!isSchedulePositiveReview(row.reviewStatus)) return false;
  if (row.mapStatus !== "mapped" || !row.luminaireId) return false;
  if (!row.roomId || row.outsideRoom) return false;
  return true;
}

export function summarizeScheduleImport(rows: ScheduleImportRow[]): ScheduleImportSummary {
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

    if (scheduleRowReady(row)) readyForCommit += 1;
    else if (
      isSchedulePositiveReview(row.reviewStatus) &&
      (row.mapStatus !== "mapped" || row.outsideRoom || !row.roomId)
    ) {
      if (row.mapStatus !== "mapped") unmappedBlocked += 1;
      if (row.outsideRoom || !row.roomId) outsideSkipped += 1;
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

export function scheduleCommitBlockedReason(rows: ScheduleImportRow[]): string | null {
  const bad = rows.filter(
    (r) =>
      isSchedulePositiveReview(r.reviewStatus) &&
      r.mapStatus !== "mapped" &&
      !r.parseError
  );
  if (bad.length) {
    return `${bad.length} accepted row(s) unmapped or ambiguous — map codes or reject / 已接受但未對應`;
  }
  return null;
}

export function acceptAllMappedScheduleRows(rows: ScheduleImportRow[]): ScheduleImportRow[] {
  return rows.map((r) => {
    if (r.parseError || r.reviewStatus === "rejected") return r;
    if (r.mapStatus === "mapped" && r.luminaireId) {
      return { ...r, reviewStatus: "accepted" };
    }
    return r;
  });
}

export function setScheduleRowStatus(
  row: ScheduleImportRow,
  reviewStatus: ScheduleReviewStatus
): ScheduleImportRow {
  return { ...row, reviewStatus };
}

export function planScheduleCommit(
  rows: ScheduleImportRow[],
  scene: ProjectSceneV2,
  luminaireNames: Record<string, string>
): ScheduleCommitPlan {
  const blocked = scheduleCommitBlockedReason(rows);
  if (blocked) {
    return { drafts: [], readyRowIds: [], skippedOutside: [] };
  }

  const drafts: FixtureInstanceDraft[] = [];
  const readyRowIds: string[] = [];
  const skippedOutside: { codeRaw: string; x: number; y: number }[] = [];
  const storeyId = scene.ui.activeStoreyId;

  for (const row of rows) {
    if (!isSchedulePositiveReview(row.reviewStatus)) continue;
    if (row.mapStatus !== "mapped" || !row.luminaireId) continue;
    if (row.parseError) continue;

    const room = row.roomId
      ? scene.rooms.find((r) => r.id === row.roomId)
      : findRoomAt(scene.rooms, storeyId, { x: row.x, y: row.y });

    if (!room) {
      skippedOutside.push({ codeRaw: row.codeRaw, x: row.x, y: row.y });
      continue;
    }

    const mountZ = row.z ?? room.heightM - 0.1;
    const name = row.codeRaw.trim() || luminaireNames[row.luminaireId] || "Fixture";
    drafts.push({
      luminaireId: row.luminaireId,
      storeyId,
      roomId: room.id,
      name,
      position: { x: row.x, y: row.y, z: mountZ },
      rotationDeg: row.rotationDeg,
    });
    readyRowIds.push(row.id);
  }

  return { drafts, readyRowIds, skippedOutside };
}

export async function commitScheduleImport(
  input: {
    scene: ProjectSceneV2;
    results: ResultsV2;
    rows: ScheduleImportRow[];
    luminaireNames: Record<string, string>;
    runCalc?: boolean;
  },
  deps: WriteInstancesCalcDeps
): Promise<ScheduleCommitResult> {
  const blockedReason = scheduleCommitBlockedReason(input.rows);
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

  const plan = planScheduleCommit(input.rows, input.scene, input.luminaireNames);
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

  const out = await writeFixtureInstances(
    {
      scene: input.scene,
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

  if (input.runCalc) {
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
