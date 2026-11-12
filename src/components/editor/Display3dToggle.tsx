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
        value === mode ? "btn-accent" : "btn-secondary !bg-white/90"
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
