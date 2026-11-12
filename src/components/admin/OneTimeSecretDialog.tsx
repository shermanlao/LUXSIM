"use client";

import { useState } from "react";

export function OneTimeSecretDialog({
  title,
  message,
  secret,
  onClose,
}: {
  title: string;
  message: string;
  secret: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal panel p-5"
        role="dialog"
        aria-labelledby="one-time-secret-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="one-time-secret-title" className="display text-2xl mb-2">
          {title}
        </h2>
        <p className="mb-3">{message}</p>
        <p className="admin-one-time-secret">{secret}</p>
        <p className="text-sm text-[var(--muted)] mb-4">
          This is shown only once. Copy it now and share it securely.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-accent !py-1.5 !px-3 !text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(secret).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn-secondary !py-1.5 !px-3 !text-xs" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
