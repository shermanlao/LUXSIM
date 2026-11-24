"use client";

import type { IsoluxPalette } from "@luxsim/project-io";
import { FALSE_COLOR_SCALE_APPLY_PROMPT } from "@/lib/false-color-scale-commit";

export function FalseColorScaleApplyPrompt({
  palette = "falsecolor",
  onApply,
}: {
  palette?: IsoluxPalette;
  onApply: () => void;
}) {
  const copy = FALSE_COLOR_SCALE_APPLY_PROMPT;
  const titleEn = palette === "greyscale" ? copy.titleEnGreyscale : copy.titleEnFalseColour;
  const titleZh = palette === "greyscale" ? copy.titleZhGreyscale : copy.titleZhFalseColour;

  return (
    <div className="falsecolor-scale-apply-prompt" data-falsecolor-scale-apply-prompt role="status">
      <p className="falsecolor-scale-apply-prompt__title">{titleEn}</p>
      <p className="falsecolor-scale-apply-prompt__title-zh">{titleZh}</p>
      <button
        type="button"
        className="falsecolor-scale-apply-prompt__apply"
        onClick={onApply}
      >
        {copy.applyEn} / {copy.applyZh}
      </button>
    </div>
  );
}
