"use client";

import type { IsolineLevelSettings } from "@luxsim/project-io";
import { HelpTip } from "@/components/HelpTip";
import { IsolineLevelsControls } from "./IsolineLevelsControls";

function overlayButtonClass(on: boolean, enabled: boolean) {
  return `!py-1.5 !px-3 !text-xs btn ${
    on
      ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
      : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
  } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`;
}

export function PlanIsoluxToggle({
  showFalseColor,
  onShowFalseColorChange,
  showIsolines,
  onShowIsolinesChange,
  showValueLabels,
  onShowValueLabelsChange,
  enabled,
  reason,
  isolineSettings,
  isolineReadOnly = false,
  onIsolineSettingsCommit,
  onIsolineSettingsInvalid,
  className = "",
}: {
  showFalseColor: boolean;
  onShowFalseColorChange: (show: boolean) => void;
  showIsolines: boolean;
  onShowIsolinesChange: (show: boolean) => void;
  showValueLabels: boolean;
  onShowValueLabelsChange: (show: boolean) => void;
  enabled: boolean;
  reason: string | null;
  isolineSettings: IsolineLevelSettings;
  isolineReadOnly?: boolean;
  onIsolineSettingsCommit: (next: IsolineLevelSettings) => void;
  onIsolineSettingsInvalid: (status: string) => void;
  className?: string;
}) {
  const btn = (on: boolean, label: string, onToggle: (next: boolean) => void) => (
    <button
      type="button"
      className={overlayButtonClass(on, enabled)}
      aria-pressed={on}
      disabled={!enabled}
      onClick={() => enabled && onToggle(!on)}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-plan-isolux-toggle="">
      <div className="inline-flex items-center gap-1" role="group" aria-label="Plan results display">
        {btn(showFalseColor, "False colour", onShowFalseColorChange)}
        {btn(showIsolines, "Isolines", onShowIsolinesChange)}
        {btn(showValueLabels, "Value labels", onShowValueLabelsChange)}
        <HelpTip helpKey="view.planIsolux" />
      </div>
      {reason && (
        <p className="text-[10px] text-[#c5d0d6] max-w-[22rem] leading-snug" data-plan-isolux-reason="">
          {reason}
        </p>
      )}
      <IsolineLevelsControls
        settings={isolineSettings}
        enabled={enabled}
        readOnly={isolineReadOnly}
        onCommit={onIsolineSettingsCommit}
        onInvalid={onIsolineSettingsInvalid}
      />
    </div>
  );
}
