"use client";

import { officialDxfLayerName } from "@luxsim/project-io";

type Props = {
  layerNames: string[];
  hiddenLayers: string[];
  disabled?: boolean;
  readOnlyList?: boolean;
  onHiddenLayersChange?: (hidden: string[]) => void;
  onApply?: () => void;
};

export function PlanLayerPanel({
  layerNames,
  hiddenLayers,
  disabled = false,
  readOnlyList = false,
  onHiddenLayersChange,
  onApply,
}: Props) {
  const hidden = new Set(hiddenLayers.map((name) => officialDxfLayerName(name)));
  const names = layerNames.length ? layerNames : ["0"];

  function setHidden(next: string[]) {
    onHiddenLayersChange?.(next.map((name) => officialDxfLayerName(name)));
  }

  return (
    <div className="space-y-1" data-plan-layers="">
      <p className="label mb-0">Plan layers</p>
      {!readOnlyList && (
        <div className="flex gap-1">
          <button
            type="button"
            className="btn btn-secondary !text-[10px] !px-2 !py-1"
            disabled={disabled}
            onClick={() => setHidden([])}
          >
            Select all
          </button>
          <button
            type="button"
            className="btn btn-secondary !text-[10px] !px-2 !py-1"
            disabled={disabled}
            onClick={() => setHidden(names)}
          >
            Select none
          </button>
        </div>
      )}
      <ul className="max-h-40 overflow-y-auto border border-[#3d5563] rounded px-1 py-1 space-y-0.5">
        {names.map((name) => {
          const on = !hidden.has(officialDxfLayerName(name));
          return (
            <li key={name} className="flex items-center gap-1 text-[10px] text-[#d5e2e8]">
              <input
                type="checkbox"
                className="shrink-0"
                checked={on}
                disabled={disabled || readOnlyList}
                onChange={() => {
                  const next = new Set(hidden);
                  const key = officialDxfLayerName(name);
                  if (on) next.add(key);
                  else next.delete(key);
                  setHidden([...next]);
                }}
              />
              <span className="truncate" title={name}>
                {name}
              </span>
            </li>
          );
        })}
      </ul>
      {!readOnlyList && (
        <button
          type="button"
          className="btn btn-secondary w-full !text-xs"
          disabled={disabled}
          onClick={() => onApply?.()}
        >
          Apply
        </button>
      )}
    </div>
  );
}
