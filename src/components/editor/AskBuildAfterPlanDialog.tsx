"use client";

import { useEffect } from "react";
import {
  ASK_BUILD_AFTER_PLAN_AUTO_EN,
  ASK_BUILD_AFTER_PLAN_AUTO_ZH,
  ASK_BUILD_AFTER_PLAN_BODY_EN,
  ASK_BUILD_AFTER_PLAN_BODY_ZH,
  ASK_BUILD_AFTER_PLAN_SELF_EN,
  ASK_BUILD_AFTER_PLAN_SELF_ZH,
  ASK_BUILD_AFTER_PLAN_TITLE_EN,
  ASK_BUILD_AFTER_PLAN_TITLE_ZH,
} from "@/lib/official-ask-build-after-plan";

type Props = {
  open: boolean;
  /** Self-build: close without creating rooms or a storey contour. */
  onSelfBuild: () => void;
  /** Auto-build from the plan (primary). */
  onCreateFromPlan: () => void;
};

/**
 * After Import plan of a DXF/DWG with no rooms on the active storey, asks
 * whether the user will build themselves or create from the plan.
 * Esc or backdrop click = self-build.
 */
export function AskBuildAfterPlanDialog({ open, onSelfBuild, onCreateFromPlan }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onSelfBuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSelfBuild]);

  if (!open) return null;

  return (
    <div className="build-model-first-backdrop" role="presentation" onClick={onSelfBuild}>
      <div
        className="build-model-first-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-build-after-plan-title"
        aria-describedby="ask-build-after-plan-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="ask-build-after-plan-title" className="display">
          {ASK_BUILD_AFTER_PLAN_TITLE_EN}
        </h2>
        <p className="build-model-first-zh">{ASK_BUILD_AFTER_PLAN_TITLE_ZH}</p>
        <div id="ask-build-after-plan-message">
          <p>{ASK_BUILD_AFTER_PLAN_BODY_EN}</p>
          <p className="build-model-first-zh">{ASK_BUILD_AFTER_PLAN_BODY_ZH}</p>
        </div>
        <div className="build-model-first-actions">
          <button type="button" className="btn btn-secondary" onClick={onSelfBuild}>
            <span className="block leading-tight">
              {ASK_BUILD_AFTER_PLAN_SELF_EN}
              <span className="block text-[0.7rem] opacity-80">{ASK_BUILD_AFTER_PLAN_SELF_ZH}</span>
            </span>
          </button>
          <button type="button" className="btn btn-accent" onClick={onCreateFromPlan}>
            <span className="block leading-tight">
              {ASK_BUILD_AFTER_PLAN_AUTO_EN}
              <span className="block text-[0.7rem] opacity-80">{ASK_BUILD_AFTER_PLAN_AUTO_ZH}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
