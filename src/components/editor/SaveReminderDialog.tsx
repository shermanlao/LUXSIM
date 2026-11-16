"use client";

import { useEffect } from "react";
import {
  SAVE_REMINDER_BODY_EN,
  SAVE_REMINDER_BODY_ZH,
  SAVE_REMINDER_LATER_LABEL,
  SAVE_REMINDER_SAVE_LABEL,
  SAVE_REMINDER_TITLE_EN,
  SAVE_REMINDER_TITLE_ZH,
} from "@/lib/save-reminder";

type Props = {
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  onLater: () => void;
};

/** Dismissible reminder to save unsaved persistable edits after the account interval. */
export function SaveReminderDialog({ open, saving = false, onSave, onLater }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onLater();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onLater]);

  if (!open) return null;

  return (
    <div className="save-reminder-backdrop" role="presentation" onClick={onLater}>
      <div
        className="save-reminder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-reminder-title"
        aria-describedby="save-reminder-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="save-reminder-title" className="display">
          {SAVE_REMINDER_TITLE_EN}
        </h2>
        <p className="save-reminder-zh">{SAVE_REMINDER_TITLE_ZH}</p>
        <div id="save-reminder-message">
          <p>{SAVE_REMINDER_BODY_EN}</p>
          <p className="save-reminder-zh">{SAVE_REMINDER_BODY_ZH}</p>
        </div>
        <div className="save-reminder-actions">
          <button type="button" className="btn btn-secondary" onClick={onLater} disabled={saving}>
            {SAVE_REMINDER_LATER_LABEL}
          </button>
          <button type="button" className="btn btn-accent" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : SAVE_REMINDER_SAVE_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
