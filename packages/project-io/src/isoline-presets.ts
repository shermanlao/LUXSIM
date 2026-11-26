/**
 * Official custom isoline levels and named presets.
 * Auto still uses isoluxLevels(emin, emax). Custom uses a validated lux list.
 * Built-in starter presets are distinct from user presets and are not overwritten.
 */

import { isoluxLevels } from "./isolux-map";
import type { IsolineLevelsMode, IsolinePreset, ProjectSceneV2 } from "./types";

export type IsolineLevelSettings = {
  mode: IsolineLevelsMode;
  levels: number[];
  presets: IsolinePreset[];
};

export const BUILTIN_ISOLINE_PRESET_OFFICE: IsolinePreset = {
  id: "builtin:100-200-300-500",
  name: "100 / 200 / 300 / 500",
  levels: [100, 200, 300, 500],
};

export const BUILTIN_ISOLINE_PRESET_TASK: IsolinePreset = {
  id: "builtin:300-500-750",
  name: "300 / 500 / 750",
  levels: [300, 500, 750],
};

/** Built-in starter isoline presets. These are not stored on the project. */
export const BUILTIN_ISOLINE_PRESETS: readonly IsolinePreset[] = [
  BUILTIN_ISOLINE_PRESET_OFFICE,
  BUILTIN_ISOLINE_PRESET_TASK,
];

export const DEFAULT_ISOLINE_LEVEL_SETTINGS: IsolineLevelSettings = {
  mode: "auto",
  levels: [],
  presets: [],
};

export const ISOLINE_LEVELS_INVALID_STATUS =
  "Isoline levels must be finite numbers greater than 0 lx. The last valid settings were kept. / 等照度線數值必須為大於 0 lx 的有效數字，已保留上次有效設定。";

export const ISOLINE_LEVELS_EMPTY_STATUS =
  "Enter at least one isoline level greater than 0 lx. The last valid settings were kept. / 請輸入至少一個大於 0 lx 的等照度線數值，已保留上次有效設定。";

export const ISOLINE_PRESET_NAME_INVALID_STATUS =
  "Enter a preset name. Built-in presets cannot be overwritten. / 請輸入預設名稱。內建預設不可被覆蓋。";

export const ISOLINE_PRESET_MISSING_STATUS =
  "Choose a user preset to rename or delete. Built-in presets cannot be changed. / 請選擇一個使用者預設以重新命名或刪除。內建預設不可更改。";

export const ISOLINE_PRESET_LEVELS_REQUIRED_STATUS =
  "Save a preset from a valid custom isoline level list. / 請先有一份有效的自訂等照度線數值，才能儲存預設。";

const LEVEL_EPS = 1e-9;

function isolineId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Sort and de-duplicate finite lux values greater than 0. Returns null when the list is empty or invalid. */
export function normalizeIsolineLevels(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const values: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : typeof item === "string" ? Number(item.trim()) : Number.NaN;
    if (!Number.isFinite(n) || n <= 0) return null;
    values.push(n);
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const v of values) {
    if (!uniq.some((u) => Math.abs(u - v) < LEVEL_EPS)) uniq.push(v);
  }
  return uniq.length > 0 ? uniq : null;
}

export function isolineLevelsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - (b[i] ?? Number.NaN)) < LEVEL_EPS);
}

export function normalizeIsolineLevelsMode(raw: unknown): IsolineLevelsMode {
  return raw === "custom" ? "custom" : "auto";
}

function normalizePresetName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length > 0 ? name : null;
}

export function isBuiltinIsolinePresetId(id: string): boolean {
  return BUILTIN_ISOLINE_PRESETS.some((preset) => preset.id === id);
}

export function isBuiltinIsolinePresetName(name: string): boolean {
  const key = name.trim().toLowerCase();
  return BUILTIN_ISOLINE_PRESETS.some((preset) => preset.name.toLowerCase() === key);
}

export function normalizeIsolinePresets(raw: unknown): IsolinePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: IsolinePreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; name?: unknown; levels?: unknown };
    const name = normalizePresetName(rec.name);
    const levels = normalizeIsolineLevels(rec.levels);
    if (!name || !levels) continue;
    if (isBuiltinIsolinePresetId(typeof rec.id === "string" ? rec.id : "") || isBuiltinIsolinePresetName(name)) {
      continue;
    }
    let id = typeof rec.id === "string" ? rec.id.trim() : "";
    if (!id || seen.has(id) || isBuiltinIsolinePresetId(id)) {
      id = isolineId("isoline");
    }
    seen.add(id);
    out.push({ id, name, levels });
  }
  return out;
}

export function isolineSettingsFromUi(
  ui: ProjectSceneV2["ui"] | null | undefined
): IsolineLevelSettings {
  const levels = normalizeIsolineLevels(ui?.isolineLevels) ?? [];
  const mode = normalizeIsolineLevelsMode(ui?.isolineLevelsMode);
  return {
    mode: mode === "custom" && levels.length > 0 ? "custom" : "auto",
    levels,
    presets: normalizeIsolinePresets(ui?.isolinePresets),
  };
}

export function isolineSettingsEqual(a: IsolineLevelSettings, b: IsolineLevelSettings): boolean {
  if (a.mode !== b.mode) return false;
  if (!isolineLevelsEqual(a.levels, b.levels)) return false;
  if (a.presets.length !== b.presets.length) return false;
  return a.presets.every((preset, i) => {
    const other = b.presets[i]!;
    return preset.id === other.id && preset.name === other.name && isolineLevelsEqual(preset.levels, other.levels);
  });
}

/** Resolved contour levels for a room's result range. Auto uses isoluxLevels; Custom uses the saved list. */
export function resolveIsolineLevels(
  emin: number,
  emax: number,
  settings?: Pick<IsolineLevelSettings, "mode" | "levels"> | null
): number[] {
  if (settings?.mode === "custom") {
    const levels = normalizeIsolineLevels(settings.levels);
    if (levels) return levels;
  }
  return isoluxLevels(emin, emax);
}

export type IsolineCommitResult =
  | { ok: true; settings: IsolineLevelSettings }
  | { ok: false; status: string; settings: IsolineLevelSettings };

/**
 * Parse a UI draft list. Blank entries are ignored. Returns null for an empty
 * draft and false for any non-blank value that is not a finite number > 0.
 */
export function parseIsolineLevelDraft(raw: unknown): number[] | null | false {
  if (!Array.isArray(raw)) return false;
  const present: unknown[] = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string" && item.trim() === "") continue;
    present.push(item);
  }
  if (present.length === 0) return null;
  return normalizeIsolineLevels(present) ?? false;
}

export function commitCustomIsolineLevels(
  raw: unknown,
  current: IsolineLevelSettings
): IsolineCommitResult {
  const parsed = parseIsolineLevelDraft(raw);
  if (parsed == null) {
    return { ok: false, status: ISOLINE_LEVELS_EMPTY_STATUS, settings: current };
  }
  if (parsed === false) {
    return { ok: false, status: ISOLINE_LEVELS_INVALID_STATUS, settings: current };
  }
  return { ok: true, settings: { ...current, mode: "custom", levels: parsed } };
}

export function commitIsolineLevelsMode(
  mode: IsolineLevelsMode,
  current: IsolineLevelSettings
): IsolineCommitResult {
  if (mode === "auto") {
    return { ok: true, settings: { ...current, mode: "auto" } };
  }
  const levels = normalizeIsolineLevels(current.levels);
  if (!levels) {
    return { ok: false, status: ISOLINE_LEVELS_EMPTY_STATUS, settings: current };
  }
  return { ok: true, settings: { ...current, mode: "custom", levels } };
}

export function listIsolinePresets(userPresets: readonly IsolinePreset[]): IsolinePreset[] {
  return [...BUILTIN_ISOLINE_PRESETS, ...userPresets];
}

export function findIsolinePreset(
  userPresets: readonly IsolinePreset[],
  id: string
): IsolinePreset | null {
  return listIsolinePresets(userPresets).find((preset) => preset.id === id) ?? null;
}

export function applyIsolinePreset(current: IsolineLevelSettings, presetId: string): IsolineCommitResult {
  const preset = findIsolinePreset(current.presets, presetId);
  if (!preset) {
    return { ok: false, status: ISOLINE_PRESET_MISSING_STATUS, settings: current };
  }
  return { ok: true, settings: { ...current, mode: "custom", levels: [...preset.levels] } };
}

export function saveIsolinePreset(current: IsolineLevelSettings, name: unknown): IsolineCommitResult {
  const trimmed = normalizePresetName(name);
  if (!trimmed || isBuiltinIsolinePresetName(trimmed)) {
    return { ok: false, status: ISOLINE_PRESET_NAME_INVALID_STATUS, settings: current };
  }
  const levels = normalizeIsolineLevels(current.levels);
  if (!levels) {
    return { ok: false, status: ISOLINE_PRESET_LEVELS_REQUIRED_STATUS, settings: current };
  }
  const existing = current.presets.find((preset) => preset.name.toLowerCase() === trimmed.toLowerCase());
  const presets = existing
    ? current.presets.map((preset) => (preset.id === existing.id ? { ...preset, name: trimmed, levels } : preset))
    : [...current.presets, { id: isolineId("isoline"), name: trimmed, levels }];
  return { ok: true, settings: { ...current, mode: "custom", levels, presets } };
}

export function renameIsolinePreset(
  current: IsolineLevelSettings,
  presetId: string,
  name: unknown
): IsolineCommitResult {
  const trimmed = normalizePresetName(name);
  if (!trimmed || isBuiltinIsolinePresetName(trimmed) || isBuiltinIsolinePresetId(presetId)) {
    return { ok: false, status: ISOLINE_PRESET_NAME_INVALID_STATUS, settings: current };
  }
  const existing = current.presets.find((preset) => preset.id === presetId);
  if (!existing) {
    return { ok: false, status: ISOLINE_PRESET_MISSING_STATUS, settings: current };
  }
  const clash = current.presets.find(
    (preset) => preset.id !== presetId && preset.name.toLowerCase() === trimmed.toLowerCase()
  );
  const presets = current.presets.map((preset) => {
    if (preset.id === presetId) return { ...preset, name: trimmed };
    if (clash && preset.id === clash.id) return preset;
    return preset;
  });
  if (clash) {
    return { ok: false, status: ISOLINE_PRESET_NAME_INVALID_STATUS, settings: current };
  }
  return { ok: true, settings: { ...current, presets } };
}

export function deleteIsolinePreset(current: IsolineLevelSettings, presetId: string): IsolineCommitResult {
  if (isBuiltinIsolinePresetId(presetId)) {
    return { ok: false, status: ISOLINE_PRESET_NAME_INVALID_STATUS, settings: current };
  }
  if (!current.presets.some((preset) => preset.id === presetId)) {
    return { ok: false, status: ISOLINE_PRESET_MISSING_STATUS, settings: current };
  }
  return {
    ok: true,
    settings: { ...current, presets: current.presets.filter((preset) => preset.id !== presetId) },
  };
}

export function isolineSettingsToUi(settings: IsolineLevelSettings): Pick<
  ProjectSceneV2["ui"],
  "isolineLevelsMode" | "isolineLevels" | "isolinePresets"
> {
  return {
    isolineLevelsMode: settings.mode,
    isolineLevels: settings.levels,
    isolinePresets: settings.presets,
  };
}
