"use client";

import type { IsoluxMode } from "@luxsim/project-io";
import { HelpTip } from "@/components/HelpTip";

export function PlanIsoluxToggle({
  mode,
  onModeChange,
  showValueLabels,
  onShowValueLabelsChange,
  enabled,
  reason,
  className = "",
}: {
  mode: IsoluxMode;
  onModeChange: (mode: IsoluxMode) => void;
  showValueLabels: boolean;
  onShowValueLabelsChange: (show: boolean) => void;
  enabled: boolean;
  reason: string | null;
  className?: string;
}) {
  const btn = (value: IsoluxMode, label: string) => (
    <button
      type="button"
      className={`!py-1.5 !px-3 !text-xs btn ${
        mode === value
          ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
          : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
      } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-pressed={mode === value}
      disabled={!enabled}
      onClick={() => enabled && onModeChange(value)}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-plan-isolux-toggle="">
      <div className="inline-flex items-center gap-1" role="group" aria-label="Plan results display">
        {btn("falsecolor", "False colour")}
        {btn("isolines", "Isolines")}
        <label
          className={`ml-1 inline-flex items-center gap-1 text-[11px] ${
            enabled ? "text-[#e8eef2]" : "text-[#8fa3ad] opacity-70"
          }`}
        >
          <input
            type="checkbox"
            className="accent-[#c45c26]"
            checked={showValueLabels}
            disabled={!enabled}
            onChange={(e) => enabled && onShowValueLabelsChange(e.target.checked)}
            aria-label="Value labels"
          />
          Value labels
        </label>
        <HelpTip helpKey="view.planIsolux" />
      </div>
      {reason && (
        <p className="text-[10px] text-[#c5d0d6] max-w-[22rem] leading-snug" data-plan-isolux-reason="">
          {reason}
        </p>
      )}
    </div>
  );
}
