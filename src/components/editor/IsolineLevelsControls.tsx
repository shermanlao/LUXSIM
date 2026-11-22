"use client";

import { useEffect, useMemo, useState } from "react";
import type { IsolineLevelSettings, IsolinePreset } from "@luxsim/project-io";
import {
  applyIsolinePreset,
  commitCustomIsolineLevels,
  commitIsolineLevelsMode,
  deleteIsolinePreset,
  listIsolinePresets,
  renameIsolinePreset,
  saveIsolinePreset,
} from "@luxsim/project-io";

function formatLevel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

export function IsolineLevelsControls({
  settings,
  enabled,
  readOnly = false,
  onCommit,
  onInvalid,
  className = "",
}: {
  settings: IsolineLevelSettings;
  enabled: boolean;
  readOnly?: boolean;
  onCommit: (next: IsolineLevelSettings) => void;
  onInvalid: (status: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string[]>(() => settings.levels.map(formatLevel));
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const levelsKey = settings.levels.map(formatLevel).join(",");
  useEffect(() => {
    setDraft(levelsKey ? levelsKey.split(",") : []);
  }, [levelsKey]);

  const presets = useMemo(() => listIsolinePresets(settings.presets), [settings.presets]);
  const selectedPreset: IsolinePreset | undefined = presets.find((preset) => preset.id === selectedPresetId);
  const canEdit = enabled && !readOnly;
  const custom = settings.mode === "custom";

  function commitResult(result: { ok: true; settings: IsolineLevelSettings } | { ok: false; status: string; settings: IsolineLevelSettings }) {
    if (!result.ok) {
      setDraft(settings.levels.map(formatLevel));
      onInvalid(result.status);
      return;
    }
    onCommit(result.settings);
  }

  function setMode(mode: "auto" | "custom") {
    if (!canEdit) return;
    commitResult(commitIsolineLevelsMode(mode, settings));
  }

  function commitDraft(nextDraft = draft) {
    if (!canEdit) return;
    commitResult(commitCustomIsolineLevels(nextDraft, settings));
  }

  function addLevel() {
    if (!canEdit) return;
    setDraft((rows) => [...rows, ""]);
  }

  function removeLevel(index: number) {
    if (!canEdit) return;
    const next = draft.filter((_, i) => i !== index);
    setDraft(next);
    commitResult(commitCustomIsolineLevels(next, settings));
  }

  return (
    <div
      className={`isoline-levels-controls ${className}`}
      data-isoline-levels-controls=""
      data-isoline-mode={settings.mode}
    >
      <div className="isoline-levels-controls__label">Isoline levels / 等照度線數值</div>
      <div className="inline-flex items-center gap-1 flex-wrap" role="group" aria-label="Isoline levels / 等照度線數值">
        <button
          type="button"
          className={modeButtonClass(settings.mode === "auto", canEdit)}
          aria-pressed={settings.mode === "auto"}
          disabled={!canEdit}
          onClick={() => setMode("auto")}
        >
          Auto / 自動
        </button>
        <button
          type="button"
          className={modeButtonClass(custom, canEdit)}
          aria-pressed={custom}
          disabled={!canEdit}
          onClick={() => setMode("custom")}
        >
          Custom / 自訂
        </button>
      </div>

      {custom && (
        <div className="isoline-levels-controls__list" data-isoline-custom-list="">
          {readOnly ? (
            <p className="isoline-levels-controls__readonly">
              {settings.levels.map(formatLevel).join(" / ") || "—"} lx
            </p>
          ) : (
            <>
              {draft.map((value, index) => (
                <div key={`level-${index}`} className="isoline-levels-controls__row">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Isoline level ${index + 1} (lx)`}
                    className="isoline-levels-controls__input"
                    value={value}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const next = [...draft];
                      next[index] = e.target.value;
                      setDraft(next);
                    }}
                    onBlur={() => commitDraft()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="isoline-levels-controls__unit">lx</span>
                  <button
                    type="button"
                    className="isoline-levels-controls__icon"
                    disabled={!canEdit}
                    onClick={() => removeLevel(index)}
                  >
                    Remove / 移除
                  </button>
                </div>
              ))}
              <button type="button" className="isoline-levels-controls__text-btn" disabled={!canEdit} onClick={addLevel}>
                Add / 新增
              </button>
            </>
          )}
        </div>
      )}

      <div className="isoline-levels-controls__presets" data-isoline-presets="">
        <div className="isoline-levels-controls__label">Presets / 預設</div>
        <div className="isoline-levels-controls__row isoline-levels-controls__row--wrap">
          <select
            className="isoline-levels-controls__select"
            aria-label="Presets / 預設"
            value={selectedPresetId}
            disabled={!canEdit}
            onChange={(e) => setSelectedPresetId(e.target.value)}
          >
            <option value="">Select / 選擇</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.id.startsWith("builtin:") ? " (built-in / 內建)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="isoline-levels-controls__text-btn"
            disabled={!canEdit || !selectedPresetId}
            onClick={() => selectedPresetId && commitResult(applyIsolinePreset(settings, selectedPresetId))}
          >
            Apply / 套用
          </button>
        </div>
        {!readOnly && (
          <div className="isoline-levels-controls__row isoline-levels-controls__row--wrap">
            <input
              type="text"
              className="isoline-levels-controls__input isoline-levels-controls__input--name"
              aria-label="Preset name / 預設名稱"
              placeholder="Name / 名稱"
              value={presetName}
              disabled={!canEdit}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button
              type="button"
              className="isoline-levels-controls__text-btn"
              disabled={!canEdit}
              onClick={() => {
                const fromDraft = custom ? commitCustomIsolineLevels(draft, settings) : { ok: true as const, settings };
                if (!fromDraft.ok) {
                  commitResult(fromDraft);
                  return;
                }
                const result = saveIsolinePreset(fromDraft.settings, presetName);
                commitResult(result);
                if (result.ok) setPresetName("");
              }}
            >
              Save / 儲存
            </button>
            <button
              type="button"
              className="isoline-levels-controls__text-btn"
              disabled={!canEdit || !selectedPreset || selectedPreset.id.startsWith("builtin:")}
              onClick={() => {
                if (!selectedPreset) return;
                commitResult(renameIsolinePreset(settings, selectedPreset.id, presetName));
              }}
            >
              Rename / 重新命名
            </button>
            <button
              type="button"
              className="isoline-levels-controls__text-btn"
              disabled={!canEdit || !selectedPreset || selectedPreset.id.startsWith("builtin:")}
              onClick={() => {
                if (!selectedPreset) return;
                const result = deleteIsolinePreset(settings, selectedPreset.id);
                commitResult(result);
                if (result.ok) setSelectedPresetId("");
              }}
            >
              Delete / 刪除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function modeButtonClass(on: boolean, enabled: boolean) {
  return `!py-1.5 !px-3 !text-xs btn ${
    on
      ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
      : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
  } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`;
}
