"use client";

import { useEffect } from "react";
import {
  BUILD_MODEL_FIRST_BODY_EN,
  BUILD_MODEL_FIRST_BODY_ZH,
  BUILD_MODEL_FIRST_OK_LABEL,
  BUILD_MODEL_FIRST_TITLE_EN,
  BUILD_MODEL_FIRST_TITLE_ZH,
} from "@/lib/official-needs-build-before-3d";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

/** Explains that 3D needs a storey contour or at least one room; does not switch the view. */
export function BuildModelFirstDialog({ open, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className="build-model-first-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="build-model-first-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-model-first-title"
        aria-describedby="build-model-first-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="build-model-first-title" className="display">
          {BUILD_MODEL_FIRST_TITLE_EN}
        </h2>
        <p className="build-model-first-zh">{BUILD_MODEL_FIRST_TITLE_ZH}</p>
        <div id="build-model-first-message">
          <p>{BUILD_MODEL_FIRST_BODY_EN}</p>
          <p className="build-model-first-zh">{BUILD_MODEL_FIRST_BODY_ZH}</p>
        </div>
        <div className="build-model-first-actions">
          <button type="button" className="btn btn-accent" onClick={onDismiss}>
            {BUILD_MODEL_FIRST_OK_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
