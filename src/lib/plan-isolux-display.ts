import type { IsoluxMode, ResultsV2 } from "@luxsim/project-io";
import { hasCalcGrid } from "@luxsim/project-io";

export const DEFAULT_PLAN_ISOLUX_MODE: IsoluxMode = "falsecolor";

export const PLAN_ISOLUX_NO_RESULTS =
  "Run Calculate to show isolines and value labels — no rooms on this storey have results.";

export const PLAN_ISOLUX_HINT =
  "On the Top plan, turn False colour, Isolines, and Value labels on or off independently for rooms on the current storey that have calculation results, without first selecting a room. Isolines and Value labels can overlay False colour. In the 3D view, Greyscale and False colour are the only exclusive display modes and share the same interactive illuminance scale bar; Isolines and Value labels use the same button style and can overlay either mode, drawn on the workplane at the room's workplane height from the same isolux model. The workplane follows Workplane (m) immediately and can be shown or hidden without hiding the floor, walls, or fixtures. Rooms without results do not invent numbers. The Full PDF report includes isolines and value labels on the working-plane isolux diagram.";

export function normalizePlanIsoluxMode(raw: unknown): IsoluxMode {
  return raw === "isolines" ? "isolines" : "falsecolor";
}

/** False colour on the plan defaults to on, and stays on when migrating from the old exclusive Isolines mode. */
export function planShowFalseColorFromUi(ui: {
  planShowFalseColor?: boolean;
  planShowIsolines?: boolean;
  planIsoluxMode?: unknown;
  display3d?: unknown;
} | null | undefined): boolean {
  if (ui?.planShowFalseColor === false) return false;
  return true;
}

/** Isolines overlay, including migration from the old exclusive Isolines mode. */
export function planShowIsolinesFromUi(ui: {
  planShowFalseColor?: boolean;
  planShowIsolines?: boolean;
  planIsoluxMode?: unknown;
  display3d?: unknown;
} | null | undefined): boolean {
  if (ui?.planShowIsolines === true) return true;
  if (ui?.planShowIsolines === false) return false;
  return ui?.planIsoluxMode === "isolines" || ui?.display3d === "isolines";
}

export function planIsoluxHasResults(
  results: ResultsV2 | null | undefined,
  roomId: string | null | undefined
): boolean {
  if (!roomId || !results) return false;
  return hasCalcGrid(results.byRoomId[roomId]);
}

export function planIsoluxRoomIds(
  roomIds: readonly string[] | string | null | undefined
): string[] {
  if (roomIds == null) return [];
  return typeof roomIds === "string" ? [roomIds] : [...roomIds];
}

export function planIsoluxStoreyHasResults(
  results: ResultsV2 | null | undefined,
  roomIds: readonly string[] | string | null | undefined
): boolean {
  return planIsoluxRoomIds(roomIds).some((id) => planIsoluxHasResults(results, id));
}

export function planIsoluxControlState(
  results: ResultsV2 | null | undefined,
  roomIds: readonly string[] | string | null | undefined
): { enabled: boolean; reason: string | null } {
  if (!planIsoluxStoreyHasResults(results, roomIds)) {
    return { enabled: false, reason: PLAN_ISOLUX_NO_RESULTS };
  }
  return { enabled: true, reason: null };
}
