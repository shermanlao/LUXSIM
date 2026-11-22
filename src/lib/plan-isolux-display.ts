import type { IsoluxMode, ResultsV2 } from "@luxsim/project-io";
import { hasCalcGrid } from "@luxsim/project-io";

export const DEFAULT_PLAN_ISOLUX_MODE: IsoluxMode = "falsecolor";

export const PLAN_ISOLUX_NO_RESULTS =
  "Run Calculate to show isolines and value labels — no rooms on this storey have results.";

export const PLAN_ISOLUX_HINT =
  "On the Top plan, turn False colour, Isolines, and Value labels on or off independently for rooms on the current storey that have calculation results, without first selecting a room. Isolines and Value labels can overlay False colour. In the 3D view, Greyscale and False colour are the only exclusive display modes and share the same interactive illuminance scale bar; Isolines and Value labels use the same button style and can overlay either mode, drawn on the workplane at the room's workplane height from the same isolux model, or on the floor when the workplane is hidden. The workplane follows Workplane (m) immediately and can be shown or hidden without hiding the floor, walls, or fixtures, and without hiding Greyscale, False colour, Isolines, or Value labels. Next to Isolines, Isoline levels / 等照度線數值 can stay on Auto / 自動 (stepped from the result range) or switch to Custom / 自訂 values in lux. Presets / 預設 include built-in starters 100 / 200 / 300 / 500 and 300 / 500 / 750; you can apply a preset, and save, rename, or delete your own named presets on the project. Built-in starters are not overwritten. Empty or invalid custom lists are refused and the last valid settings are kept. View-only projects still show the saved Auto or Custom isolines; editing levels or presets is hidden. Top, 3D, the existing Full PDF 2D isolux figures, and the Full PDF 3D Isolines / 3D 等照度線 chapter use the same levels. The illuminance scale bar is unchanged. A committed change may show Updating isolines… / 正在更新等照度線…; pan, zoom, and mid-edit typing do not rebuild isolux models. Rooms without results do not invent numbers. The Full PDF report includes isolines and value labels on the working-plane isolux diagram, and a separate 3D Isolines chapter with project-wide and per-room stills from the same official viewpoints; existing 2D isolux snapshots and 3D greyscale / false-colour chapters are kept.";

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
