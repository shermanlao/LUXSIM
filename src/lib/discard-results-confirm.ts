import { clearResultsForRooms } from "@/lib/write-instances";
import type { ResultsV2 } from "@luxsim/project-io";

export const DISCARD_RESULTS_TITLE_EN = "Discard calculation results?";
export const DISCARD_RESULTS_TITLE_ZH = "捨棄計算結果？";
export const DISCARD_RESULTS_BODY_EN =
  "Changing lighting fixtures will discard the current calculation results for the affected room(s). False colour, isolines, value labels, and the results strip will be cleared until you calculate again.";
export const DISCARD_RESULTS_BODY_ZH =
  "變更燈具會捨棄受影響房間的目前計算結果。偽彩、等照度線、數值圖與結果列都會被清除，直到再按 Calculate。";
export const DISCARD_RESULTS_CONFIRM_LABEL = "Confirm";
export const DISCARD_RESULTS_CANCEL_LABEL = "Cancel";

export type FixtureChangeDecision =
  | { action: "apply"; roomIdsToClear: [] }
  | { action: "confirm"; roomIdsToClear: string[] };

export function roomIdsWithResults(results: ResultsV2, roomIds: string[]): string[] {
  const walls = results.wallsByRoomId ?? {};
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of roomIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (results.byRoomId[id] != null || walls[id] != null) out.push(id);
  }
  return out;
}

export function fixtureChangeNeedsConfirm(results: ResultsV2, roomIds: string[]): boolean {
  return roomIdsWithResults(results, roomIds).length > 0;
}

export function decideFixtureChange(results: ResultsV2, roomIds: string[]): FixtureChangeDecision {
  const roomIdsToClear = roomIdsWithResults(results, roomIds);
  if (!roomIdsToClear.length) return { action: "apply", roomIdsToClear: [] };
  return { action: "confirm", roomIdsToClear };
}

export function resultsAfterDiscardConfirm(
  results: ResultsV2,
  roomIdsToClear: string[]
): ResultsV2 {
  return clearResultsForRooms(results, roomIdsToClear);
}
