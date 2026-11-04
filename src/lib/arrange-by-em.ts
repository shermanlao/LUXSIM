import { roomAreaM2, roomBounds, type RoomV2 } from "@luxsim/project-io";
import { type ArrayParams, planFixtureArray } from "@/lib/arrange-array";

export const DEFAULT_UTILANCE = 0.6;
export const UTILANCE_MIN = 0.5;
export const UTILANCE_MAX = 0.85;

export type TargetEmArrangeInput = {
  targetEmMaintainedLx: number;
  luminousFluxLm: number;
  utilance: number;
  maintenanceFactor: number;
  wallOffset: number;
  rotationDeg: number;
  /** True when UI used default η without user override */
  utilanceIsDefault?: boolean;
};

export type TargetEmArrangeEstimate = {
  fixtureCount: number;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  wallOffset: number;
  rotationDeg: number;
  areaM2: number;
  totalLmRequired: number;
  estimatedMaintainedEmLx: number;
  arrayParams: ArrayParams;
  utilanceWarning: boolean;
};

/** n ≈ ceil((Ēm × A) / (Φ × η × MF)) — maintained target illuminance. */
export function estimateFixtureCountForTargetEm(input: {
  areaM2: number;
  targetEmMaintainedLx: number;
  luminousFluxLm: number;
  utilance: number;
  maintenanceFactor: number;
}): number {
  const { areaM2, targetEmMaintainedLx, luminousFluxLm, utilance, maintenanceFactor } = input;
  if (
    areaM2 <= 0 ||
    targetEmMaintainedLx <= 0 ||
    luminousFluxLm <= 0 ||
    utilance <= 0 ||
    maintenanceFactor <= 0
  ) {
    return 0;
  }
  const totalLm = (targetEmMaintainedLx * areaM2) / (utilance * maintenanceFactor);
  return Math.max(1, Math.ceil(totalLm / luminousFluxLm));
}

export function totalLmRequiredForTargetEm(
  areaM2: number,
  targetEmMaintainedLx: number,
  utilance: number,
  maintenanceFactor: number
): number {
  if (areaM2 <= 0 || targetEmMaintainedLx <= 0 || utilance <= 0 || maintenanceFactor <= 0) return 0;
  return (targetEmMaintainedLx * areaM2) / (utilance * maintenanceFactor);
}

export function estimatedMaintainedEmFromFixtureCount(input: {
  fixtureCount: number;
  areaM2: number;
  luminousFluxLm: number;
  utilance: number;
  maintenanceFactor: number;
}): number {
  const { fixtureCount, areaM2, luminousFluxLm, utilance, maintenanceFactor } = input;
  if (areaM2 <= 0 || fixtureCount <= 0) return 0;
  return (fixtureCount * luminousFluxLm * utilance * maintenanceFactor) / areaM2;
}

/** Prefer near-square rows×cols with rows×cols ≥ n and minimal waste. */
export function pickSquareishGrid(fixtureCount: number): { rows: number; cols: number } {
  const n = Math.max(1, Math.ceil(fixtureCount));
  let bestRows = 1;
  let bestCols = n;
  let bestScore = Infinity;

  for (let rows = 1; rows <= n; rows += 1) {
    const cols = Math.ceil(n / rows);
    const total = rows * cols;
    const aspectPenalty = Math.abs(cols / rows - 1);
    const waste = total - n;
    const score = aspectPenalty + waste * 0.05;
    if (score < bestScore) {
      bestScore = score;
      bestRows = rows;
      bestCols = cols;
    }
  }

  return { rows: bestRows, cols: bestCols };
}

export function computeRectSpacingFromBounds(
  room: RoomV2,
  rows: number,
  cols: number,
  wallOffset: number
): { spacingX: number; spacingY: number } {
  const b = roomBounds(room);
  const wo = Math.max(0, wallOffset);
  const usableW = Math.max(0.01, b.width - 2 * wo);
  const usableH = Math.max(0.01, b.depth - 2 * wo);
  const spacingX = cols > 1 ? usableW / (cols - 1) : usableW;
  const spacingY = rows > 1 ? usableH / (rows - 1) : usableH;
  return { spacingX, spacingY };
}

export function planTargetEmArrange(
  room: RoomV2,
  input: TargetEmArrangeInput
): TargetEmArrangeEstimate | null {
  const areaM2 = roomAreaM2(room);
  const mf = input.maintenanceFactor;
  const n = estimateFixtureCountForTargetEm({
    areaM2,
    targetEmMaintainedLx: input.targetEmMaintainedLx,
    luminousFluxLm: input.luminousFluxLm,
    utilance: input.utilance,
    maintenanceFactor: mf,
  });
  if (!n) return null;

  const { rows, cols } = pickSquareishGrid(n);
  const wallOffset = Math.max(0, input.wallOffset);
  const { spacingX, spacingY } = computeRectSpacingFromBounds(room, rows, cols, wallOffset);
  const totalLmRequired = totalLmRequiredForTargetEm(
    areaM2,
    input.targetEmMaintainedLx,
    input.utilance,
    mf
  );
  const estimatedMaintainedEmLx = estimatedMaintainedEmFromFixtureCount({
    fixtureCount: rows * cols,
    areaM2,
    luminousFluxLm: input.luminousFluxLm,
    utilance: input.utilance,
    maintenanceFactor: mf,
  });

  const arrayParams: ArrayParams = {
    mode: "rect",
    rows,
    cols,
    count: n,
    spacingX,
    spacingY,
    wallOffset,
    rotationDeg: input.rotationDeg,
    estimateByTargetEm: true,
  };

  return {
    fixtureCount: n,
    rows,
    cols,
    spacingX,
    spacingY,
    wallOffset,
    rotationDeg: input.rotationDeg,
    areaM2,
    totalLmRequired,
    estimatedMaintainedEmLx,
    arrayParams,
    utilanceWarning: input.utilanceIsDefault === true,
  };
}

export function previewTargetEmArrange(room: RoomV2, input: TargetEmArrangeInput) {
  const estimate = planTargetEmArrange(room, input);
  if (!estimate) return null;
  const plan = planFixtureArray(room, estimate.arrayParams);
  return { estimate, plan };
}

export function clampUtilance(eta: number): number {
  if (!Number.isFinite(eta)) return DEFAULT_UTILANCE;
  return Math.min(UTILANCE_MAX, Math.max(UTILANCE_MIN, eta));
}
