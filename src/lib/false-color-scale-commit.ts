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
