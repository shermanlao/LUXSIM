import { describe, expect, it } from "vitest";
import {
  buildIsoluxModel,
  isoluxLevels,
  officialIsoluxModelForRoom,
  officialIsoluxModelsByRoom,
} from "./index";
import { defaultSceneV2, normalizeScene } from "./migrate";
import { rectPolygon } from "./geometry";
import {
  BUILTIN_ISOLINE_PRESETS,
  ISOLINE_LEVELS_EMPTY_STATUS,
  ISOLINE_LEVELS_INVALID_STATUS,
  ISOLINE_PRESET_NAME_INVALID_STATUS,
  applyIsolinePreset,
  commitCustomIsolineLevels,
  commitIsolineLevelsMode,
  deleteIsolinePreset,
  isolineSettingsFromUi,
  listIsolinePresets,
  normalizeIsolineLevels,
  renameIsolinePreset,
  resolveIsolineLevels,
  saveIsolinePreset,
} from "./isoline-presets";
import type { CalcResults, ProjectSceneV2, RoomV2 } from "./types";

function room(): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 6, 5),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
  };
}

function calc(): CalcResults {
  const lux = [300, 400, 400, 500];
  return {
    version: 1,
    summary: {
      eave: 400,
      emin: 300,
      emax: 500,
      uo: 0.75,
      ugr: 16,
      lpd: 2,
      totalWatts: 30,
      areaM2: 30,
    },
    grid: {
      originX: 0.25,
      originY: 0.25,
      spacing: 0.5,
      nx: 2,
      ny: 2,
      z: 0.75,
      lux,
    },
    meta: {
      interreflection: true,
      bounces: 2,
      calculatedAt: "2026-11-15T04:00:00.000Z",
      disclaimer: "assist",
    },
  };
}

function sceneWithUi(ui: Partial<ProjectSceneV2["ui"]>): ProjectSceneV2 {
  const base = defaultSceneV2();
  const r = room();
  return {
    ...base,
    storeys: [{ id: "s1", name: "GF", elevationM: 0, heightM: 3 }],
    rooms: [r],
    ui: { ...base.ui, activeStoreyId: "s1", activeRoomId: "r1", ...ui },
  };
}

describe("custom isoline levels and presets", () => {
  it("keeps Auto on isoluxLevels and honours Custom levels in buildIsoluxModel", () => {
    const results = calc();
    const autoLevels = isoluxLevels(results.summary.emin, results.summary.emax);
    expect(resolveIsolineLevels(results.summary.emin, results.summary.emax, { mode: "auto", levels: [] })).toEqual(
      autoLevels
    );
    const auto = buildIsoluxModel(room(), results, { mode: "isolines", targetLongSide: 200 });
    expect(auto).not.toBeNull();
    expect(auto!.contours.map((c) => c.level)).toEqual(autoLevels);

    const customLevels = [400];
    const custom = buildIsoluxModel(room(), results, {
      mode: "isolines",
      contourLevels: customLevels,
      targetLongSide: 200,
    });
    expect(custom).not.toBeNull();
    expect(custom!.contours.map((c) => c.level)).toEqual(customLevels);
    expect(custom!.contours[0]!.polylines.some((line) => line.length >= 2)).toBe(true);
    expect(officialIsoluxModelForRoom(room(), results, {
      mode: "isolines",
      isolineSettings: { mode: "custom", levels: customLevels },
      targetLongSide: 200,
    })!.contours.map((c) => c.level)).toEqual(customLevels);
  });

  it("does not invent a field for custom levels outside emin–emax or rooms without results", () => {
    const results = calc();
    const model = buildIsoluxModel(room(), results, {
      mode: "isolines",
      contourLevels: [50, 400, 2000],
      targetLongSide: 200,
    });
    expect(model).not.toBeNull();
    const byLevel = Object.fromEntries(model!.contours.map((c) => [c.level, c.polylines]));
    expect(byLevel[50]!.every((line) => line.length < 2)).toBe(true);
    expect(byLevel[2000]!.every((line) => line.length < 2)).toBe(true);
    expect(byLevel[400]!.some((line) => line.length >= 2)).toBe(true);
    const auto = buildIsoluxModel(room(), results, { mode: "isolines", targetLongSide: 200 });
    expect(model!.width).toBe(auto!.width);
    expect(model!.height).toBe(auto!.height);
    expect(model!.field.length).toBe(auto!.field.length);
    // Custom levels only change contours; the illuminance field stays the calculated one.
    expect(model!.field[0]).toBe(auto!.field[0]);
    expect(Array.from(model!.field.subarray(0, 64))).toEqual(Array.from(auto!.field.subarray(0, 64)));
    expect(officialIsoluxModelForRoom(room(), undefined, {
      isolineSettings: { mode: "custom", levels: [100, 200] },
    })).toBeNull();
  });

  it("refuses empty or invalid custom lists and keeps the last valid settings", () => {
    const current = { mode: "custom" as const, levels: [100, 200, 300, 500], presets: [] };
    expect(normalizeIsolineLevels([500, 100, 100, 200])).toEqual([100, 200, 500]);
    expect(normalizeIsolineLevels([0, 100])).toBeNull();
    expect(normalizeIsolineLevels([-10])).toBeNull();
    expect(normalizeIsolineLevels(["abc"])).toBeNull();
    expect(normalizeIsolineLevels([])).toBeNull();
    expect(commitCustomIsolineLevels([], current)).toEqual({
      ok: false,
      status: ISOLINE_LEVELS_EMPTY_STATUS,
      settings: current,
    });
    expect(commitCustomIsolineLevels(["", "  "], current)).toEqual({
      ok: false,
      status: ISOLINE_LEVELS_EMPTY_STATUS,
      settings: current,
    });
    expect(commitCustomIsolineLevels(["abc"], current)).toEqual({
      ok: false,
      status: ISOLINE_LEVELS_INVALID_STATUS,
      settings: current,
    });
    expect(commitCustomIsolineLevels([0, 200], current)).toEqual({
      ok: false,
      status: ISOLINE_LEVELS_INVALID_STATUS,
      settings: current,
    });
    const ok = commitCustomIsolineLevels([" 300 ", "100", "100"], current);
    expect(ok).toEqual({
      ok: true,
      settings: { mode: "custom", levels: [100, 300], presets: [] },
    });
    expect(commitIsolineLevelsMode("custom", { mode: "auto", levels: [], presets: [] }).ok).toBe(false);
    expect(commitIsolineLevelsMode("auto", current).settings.mode).toBe("auto");
    expect(commitIsolineLevelsMode("auto", current).settings.levels).toEqual([100, 200, 300, 500]);
  });

  it("migrates old projects to Auto with no invented custom levels", () => {
    const base = defaultSceneV2();
    const old = normalizeScene({
      ...base,
      ui: { ...base.ui },
    });
    expect(old.ui.isolineLevelsMode).toBe("auto");
    expect(old.ui.isolineLevels).toEqual([]);
    expect(old.ui.isolinePresets).toEqual([]);
    expect(isolineSettingsFromUi(undefined)).toEqual({ mode: "auto", levels: [], presets: [] });

    const invalid = normalizeScene({
      ...base,
      ui: {
        ...base.ui,
        isolineLevelsMode: "custom",
        isolineLevels: [0, -8, Number.NaN],
      },
    });
    expect(invalid.ui.isolineLevelsMode).toBe("auto");
    expect(invalid.ui.isolineLevels).toEqual([]);

    const kept = normalizeScene({
      ...base,
      ui: {
        ...base.ui,
        isolineLevelsMode: "custom",
        isolineLevels: [500, 300, 300],
        isolinePresets: [{ id: "user1", name: "Task", levels: [300, 500, 750] }],
      },
    });
    expect(kept.ui.isolineLevelsMode).toBe("custom");
    expect(kept.ui.isolineLevels).toEqual([300, 500]);
    expect(kept.ui.isolinePresets).toEqual([{ id: "user1", name: "Task", levels: [300, 500, 750] }]);
  });

  it("applies, saves, renames, and deletes named presets without overwriting built-in starters", () => {
    expect(BUILTIN_ISOLINE_PRESETS.map((p) => p.levels)).toEqual([
      [100, 200, 300, 500],
      [300, 500, 750],
    ]);
    const empty = { mode: "auto" as const, levels: [], presets: [] };
    const applied = applyIsolinePreset(empty, "builtin:100-200-300-500");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.settings.mode).toBe("custom");
    expect(applied.settings.levels).toEqual([100, 200, 300, 500]);
    expect(listIsolinePresets(applied.settings.presets).map((p) => p.id)).toEqual([
      "builtin:100-200-300-500",
      "builtin:300-500-750",
    ]);

    const saved = saveIsolinePreset(applied.settings, "  My office  ");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.settings.presets).toHaveLength(1);
    expect(saved.settings.presets[0]!.name).toBe("My office");
    expect(saved.settings.presets[0]!.levels).toEqual([100, 200, 300, 500]);
    expect(saveIsolinePreset(saved.settings, "100 / 200 / 300 / 500")).toEqual({
      ok: false,
      status: ISOLINE_PRESET_NAME_INVALID_STATUS,
      settings: saved.settings,
    });

    const renamed = renameIsolinePreset(saved.settings, saved.settings.presets[0]!.id, "Office A");
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.settings.presets[0]!.name).toBe("Office A");
    expect(renameIsolinePreset(renamed.settings, "builtin:300-500-750", "Mine").ok).toBe(false);

    const deleted = deleteIsolinePreset(renamed.settings, renamed.settings.presets[0]!.id);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.settings.presets).toEqual([]);
    expect(deleted.settings.levels).toEqual([100, 200, 300, 500]);
    expect(deleteIsolinePreset(deleted.settings, "builtin:100-200-300-500").ok).toBe(false);
  });

  it("uses the project's custom isoline settings in official Full PDF 2D snapshots", () => {
    const results = { version: 2 as const, byRoomId: { r1: calc() } };
    const customScene = sceneWithUi({
      isolineLevelsMode: "custom",
      isolineLevels: [400],
    });
    const models = officialIsoluxModelsByRoom(customScene, results, { mode: "isolines", targetLongSide: 200 });
    expect(models.r1!.contours.map((c) => c.level)).toEqual([400]);
  });
});
