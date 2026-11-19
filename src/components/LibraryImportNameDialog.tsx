"use client";

import { useEffect } from "react";
import type { PendingPhotometryFile } from "@/lib/library-photometry-upload";

type Props = {
  open: boolean;
  items: PendingPhotometryFile[];
  onChangeName: (index: number, displayName: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Cancellable display-name prompt shown after IES, LDT, or GLDF files are chosen or dropped. */
export function LibraryImportNameDialog({
  open,
  items,
  onChangeName,
  onCancel,
  onConfirm,
}: Props) {
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

  if (!open || items.length === 0) return null;

  const multi = items.length > 1;
  const titleId = "library-import-name-title";
  const messageId = "library-import-name-message";

  return (
    <div className="library-import-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="library-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="display">
          {multi ? "Display names" : "Display name"}
        </h2>
        <p id={messageId}>
          {multi
            ? "Optionally name each IES, LDT, or GLDF file. Leave a field empty to use the product name, photometry description, catalog number, or file name."
            : "Optionally name this luminaire. Leave the field empty to use the photometry description, catalog number, or file name."}
        </p>
        <div className="library-import-list">
          {items.map((item, index) => (
            <div key={`${item.fileName}-${index}`}>
              <p className="library-import-filename">{item.fileName}</p>
              <label className="label" htmlFor={`library-import-name-${index}`}>
                Display name (optional)
              </label>
              <input
                className="input"
                id={`library-import-name-${index}`}
                value={item.displayName}
                onChange={(event) => onChangeName(index, event.target.value)}
                placeholder="Office downlight 30W"
                autoFocus={index === 0}
              />
            </div>
          ))}
        </div>
        <div className="library-import-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onConfirm}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
