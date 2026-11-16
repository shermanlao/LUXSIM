"use client";

import type { Display3dMode } from "@luxsim/project-io";
import { HelpTip } from "@/components/HelpTip";

function overlayButtonClass(on: boolean, enabled: boolean) {
  return `!py-1.5 !px-3 !text-xs btn ${
    on
      ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
      : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
  } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`;
}

export function Display3dToggle({
  value,
  onChange,
  showIsolines = false,
  isolinesOn = false,
  isolinesEnabled = true,
  isolinesReason = null,
  showValueLabels = false,
  onShowIsolinesChange,
  onShowValueLabelsChange,
  showWorkplane = true,
  onShowWorkplaneChange,
  className = "",
}: {
  value: Display3dMode;
  onChange: (mode: Display3dMode) => void;
  /** Official editor 3D view offers Isolines as an overlay on greyscale / false colour. */
  showIsolines?: boolean;
  isolinesOn?: boolean;
  isolinesEnabled?: boolean;
  isolinesReason?: string | null;
  showValueLabels?: boolean;
  onShowIsolinesChange?: (show: boolean) => void;
  onShowValueLabelsChange?: (show: boolean) => void;
  showWorkplane?: boolean;
  onShowWorkplaneChange?: (show: boolean) => void;
  className?: string;
}) {
  const surface = value === "greyscale" ? "greyscale" : "falsecolor";
  const btn = (mode: "greyscale" | "falsecolor", label: string) => (
    <button
      type="button"
      className={overlayButtonClass(surface === mode, true)}
      aria-pressed={surface === mode}
      onClick={() => onChange(mode)}
    >
      {label}
    </button>
  );

  const overlayBtn = (on: boolean, label: string, enabled: boolean, onToggle: (next: boolean) => void) => (
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
    <div className={`flex flex-col gap-1 ${className}`} data-display-3d-toggle="">
      <div className="inline-flex items-center gap-1" role="group" aria-label="3D display mode">
        {btn("greyscale", "Greyscale")}
        {btn("falsecolor", "False colour")}
        {showIsolines &&
          onShowIsolinesChange &&
          overlayBtn(isolinesOn, "Isolines", isolinesEnabled, onShowIsolinesChange)}
        {showIsolines &&
          onShowValueLabelsChange &&
          overlayBtn(showValueLabels, "Value labels", isolinesEnabled, onShowValueLabelsChange)}
        {onShowWorkplaneChange &&
          overlayBtn(showWorkplane, "Workplane", true, onShowWorkplaneChange)}
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
