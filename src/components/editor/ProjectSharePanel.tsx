"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { qrMatrixForUrl } from "@luxsim/project-io";

type ShareState = {
  enabled: boolean;
  accountEnabled: boolean;
  public: boolean;
  url: string | null;
};

export function ProjectSharePanel({ projectId }: { projectId: string }) {
  const [state, setState] = useState<ShareState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/share`);
    if (!res.ok) {
      setError("Could not load the view-only link.");
      return;
    }
    setError(null);
    setState((await res.json()) as ShareState);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onToggle(enabled: boolean) {
    const res = await fetch(`/api/projects/${projectId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      setError("Could not update the view-only link.");
      return;
    }
    setError(null);
    setState((await res.json()) as ShareState);
  }

  const matrix = useMemo(() => (state?.url ? qrMatrixForUrl(state.url) : null), [state?.url]);

  return (
    <div className="share-link-box border-t border-[#3d5563] pt-2 space-y-2">
      <p className="cad-section-title">View-only link</p>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={state?.enabled ?? true}
          disabled={!state}
          onChange={(e) => void onToggle(e.target.checked)}
        />
        <span>Allow visitors to browse this project</span>
      </label>
      {state && !state.accountEnabled && (
        <p className="text-[10px] text-[var(--muted)]">
          View-only links are turned off in Account settings. Turn them on there to share this project.
        </p>
      )}
      {state?.public && state.url && (
        <>
          <input type="text" readOnly value={state.url} aria-label="View-only project link" onFocus={(e) => e.currentTarget.select()} />
          {matrix && (
            <svg className="share-qr" viewBox={`0 0 ${matrix.length} ${matrix.length}`} aria-label="QR code for the view-only link">
              <rect width={matrix.length} height={matrix.length} fill="white" />
              {matrix.map((row, y) =>
                row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#12202a" /> : null))
              )}
            </svg>
          )}
          <p className="text-[10px] text-[var(--muted)]">
            Anyone with the link or QR code can browse this project, but they cannot edit it.
          </p>
        </>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
