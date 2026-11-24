import type { FalseColorScale } from "@luxsim/project-io";
import { normalizeFalseColorScale } from "@luxsim/project-io";

export function falseColorScalesEqual(a: FalseColorScale, b: FalseColorScale): boolean {
  const left = normalizeFalseColorScale(a.minLux, a.maxLux);
  const right = normalizeFalseColorScale(b.minLux, b.maxLux);
  return left.minLux === right.minLux && left.maxLux === right.maxLux;
}

/**
 * Whether a committed legend scale should rebuild Top / 3D illuminance fields.
 * Intermediate drag ticks and uncommitted typing must not apply the view scale.
 */
export function shouldApplyViewFalseColorScale(
  viewScale: FalseColorScale,
  nextScale: FalseColorScale
): boolean {
  return !falseColorScalesEqual(viewScale, nextScale);
}

/** Viewport prompt and scale-bar Apply labels. Do not name competitor software. */
export const FALSE_COLOR_SCALE_APPLY_PROMPT = {
  titleEnFalseColour: "Apply to change false colour",
  titleZhFalseColour: "套用以更改偽色",
  titleEnGreyscale: "Apply to change greyscale",
  titleZhGreyscale: "套用以更改灰階",
  applyEn: "Apply",
  applyZh: "套用",
} as const;
