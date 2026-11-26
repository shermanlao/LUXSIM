"use client";

import { useEffect } from "react";
import {
  DISCARD_RESULTS_BODY_EN,
  DISCARD_RESULTS_BODY_ZH,
  DISCARD_RESULTS_CANCEL_LABEL,
  DISCARD_RESULTS_CONFIRM_LABEL,
  DISCARD_RESULTS_TITLE_EN,
  DISCARD_RESULTS_TITLE_ZH,
} from "@/lib/discard-results-confirm";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Cancellable warning shown before a fixture change discards calculation results. */
export function DiscardResultsDialog({ open, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="discard-results-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="discard-results-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-results-title"
        aria-describedby="discard-results-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="discard-results-title" className="display">
          {DISCARD_RESULTS_TITLE_EN}
        </h2>
        <p className="discard-results-zh">{DISCARD_RESULTS_TITLE_ZH}</p>
        <div id="discard-results-message">
          <p>{DISCARD_RESULTS_BODY_EN}</p>
          <p className="discard-results-zh">{DISCARD_RESULTS_BODY_ZH}</p>
        </div>
        <div className="discard-results-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {DISCARD_RESULTS_CANCEL_LABEL}
          </button>
          <button type="button" className="btn btn-accent" onClick={onConfirm}>
            {DISCARD_RESULTS_CONFIRM_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
