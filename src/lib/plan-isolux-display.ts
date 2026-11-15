import type { IsoluxMode, ResultsV2 } from "@luxsim/project-io";
import { hasCalcGrid } from "@luxsim/project-io";

export const DEFAULT_PLAN_ISOLUX_MODE: IsoluxMode = "falsecolor";

export const PLAN_ISOLUX_NO_ROOM =
  "Select a room with calculation results to show isolines or value labels.";

export const PLAN_ISOLUX_NO_RESULTS =
  "Run Calculate to show isolines and value labels — this room has no results.";

export const PLAN_ISOLUX_HINT =
  "On the Top or Bottom plan, switch between false colour and Isolines for a room that has calculation results. In the 3D view, Isolines is an additional display mode beside Greyscale and False colour, drawn on the workplane at the room's workplane height from the same isolux model. Value labels can be shown or hidden on the workplane grid in both the plan and 3D isolines views. Rooms without results do not invent numbers. The Full PDF report includes isolines and value labels on the working-plane isolux diagram.";

export function normalizePlanIsoluxMode(raw: unknown): IsoluxMode {
  return raw === "isolines" ? "isolines" : "falsecolor";
}

export function planIsoluxHasResults(
  results: ResultsV2 | null | undefined,
  roomId: string | null | undefined
): boolean {
  if (!roomId || !results) return false;
  return hasCalcGrid(results.byRoomId[roomId]);
}

export function planIsoluxControlState(
  results: ResultsV2 | null | undefined,
  roomId: string | null | undefined
): { enabled: boolean; reason: string | null } {
  if (!roomId) return { enabled: false, reason: PLAN_ISOLUX_NO_ROOM };
  if (!planIsoluxHasResults(results, roomId)) {
    return { enabled: false, reason: PLAN_ISOLUX_NO_RESULTS };
  }
  return { enabled: true, reason: null };
}
