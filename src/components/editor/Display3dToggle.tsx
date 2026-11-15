"use client";

import type { Display3dMode } from "@luxsim/project-io";
import { HelpTip } from "@/components/HelpTip";

export function Display3dToggle({
  value,
  onChange,
  showIsolines = false,
  isolinesEnabled = true,
  isolinesReason = null,
  showValueLabels = false,
  onShowValueLabelsChange,
  className = "",
}: {
  value: Display3dMode;
  onChange: (mode: Display3dMode) => void;
  /** Official editor 3D view offers Isolines alongside greyscale / false colour. */
  showIsolines?: boolean;
  isolinesEnabled?: boolean;
  isolinesReason?: string | null;
  showValueLabels?: boolean;
  onShowValueLabelsChange?: (show: boolean) => void;
  className?: string;
}) {
  const btn = (mode: Display3dMode, label: string, enabled = true) => (
    <button
      type="button"
      className={`!py-1.5 !px-3 !text-xs btn ${
        value === mode
          ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
          : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
      } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-pressed={value === mode}
      disabled={!enabled}
      onClick={() => enabled && onChange(mode)}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-display-3d-toggle="">
      <div className="inline-flex items-center gap-1" role="group" aria-label="3D display mode">
        {btn("greyscale", "Greyscale")}
        {btn("falsecolor", "False colour")}
        {showIsolines && btn("isolines", "Isolines", isolinesEnabled)}
        {showIsolines && onShowValueLabelsChange && (
          <label
            className={`ml-1 inline-flex items-center gap-1 text-[11px] ${
              isolinesEnabled ? "text-[#e8eef2]" : "text-[#8fa3ad] opacity-70"
            }`}
          >
            <input
              type="checkbox"
              className="accent-[#c45c26]"
              checked={showValueLabels}
              disabled={!isolinesEnabled}
              onChange={(e) => isolinesEnabled && onShowValueLabelsChange(e.target.checked)}
              aria-label="Value labels"
            />
            Value labels
          </label>
        )}
        {showIsolines && <HelpTip helpKey="view.planIsolux" />}
      </div>
      {showIsolines && isolinesReason && (
        <p className="text-[10px] text-[#c5d0d6] max-w-[22rem] leading-snug" data-display-3d-isolux-reason="">
          {isolinesReason}
        </p>
      )}
    </div>
  );
}
