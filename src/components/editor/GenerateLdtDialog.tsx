"use client";

import { useEffect } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import {
  GenerateLdtForm,
  type GeneratedLuminaireRow,
} from "@/components/GenerateLdtForm";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (luminaire: GeneratedLuminaireRow, photometric: PhotometricData) => void | Promise<void>;
};

/** Modal hosting the Generate LDT form in the editor Fixture library. */
export function GenerateLdtDialog({ open, onClose, onCreated }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleId = "generate-ldt-dialog-title";

  return (
    <div className="generate-ldt-backdrop" role="presentation" onClick={onClose}>
      <div
        className="generate-ldt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="generate-ldt-dialog-header">
          <h2 id={titleId} className="display">
            Generate LDT
          </h2>
          <button type="button" className="btn btn-secondary !text-xs" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="generate-ldt-dialog-body">
          <GenerateLdtForm
            compact
            tone="cad"
            hideHeading
            onCreated={async (lum, photometric) => {
              await onCreated(lum, photometric);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
