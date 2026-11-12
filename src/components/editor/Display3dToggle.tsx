"use client";

import type { Display3dMode } from "@luxsim/project-io";

export function Display3dToggle({
  value,
  onChange,
  className = "",
}: {
  value: Display3dMode;
  onChange: (mode: Display3dMode) => void;
  className?: string;
}) {
  const btn = (mode: Display3dMode, label: string) => (
    <button
      type="button"
      className={`!py-1.5 !px-3 !text-xs btn ${
        value === mode
          ? "btn-accent !text-[#f5f7f8] !border-[#c45c26]"
          : "!bg-[#162630]/90 !text-[#e8eef2] !border-[#4a6270] hover:!bg-[#1f3542]"
      }`}
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex gap-1 ${className}`} role="group" aria-label="3D display mode">
      {btn("greyscale", "Greyscale")}
      {btn("falsecolor", "False colour")}
    </div>
  );
}
