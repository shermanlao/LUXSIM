"use client";

import type { RcpDetectionProposal } from "@luxsim/project-io";

type Props = {
  disabled?: boolean;
  detecting: boolean;
  proposals: RcpDetectionProposal[];
  showOverlay: boolean;
  onShowOverlayChange: (v: boolean) => void;
  onDetect: () => void;
  lastWarnings: string[];
};

export function RcpDetectPanel({
  disabled,
  detecting,
  proposals,
  showOverlay,
  onShowOverlayChange,
  onDetect,
  lastWarnings,
}: Props) {
  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0">Detect from plan · 從圖則偵測</p>
      <p className="text-[10px] text-[#8fa3ad]">
        Local OCR only — plan raster stays on this server (私隱：本機 OCR，不上傳雲端).
      </p>
      <button
        type="button"
        className="btn btn-accent w-full !text-xs"
        disabled={disabled || detecting}
        onClick={onDetect}
      >
        {detecting ? "Detecting… / 偵測中…" : "Detect from plan / 從圖則偵測"}
      </button>
      {lastWarnings.length > 0 && (
        <ul className="text-[10px] text-[#ffb088] list-disc pl-4 space-y-0.5">
          {lastWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {proposals.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-xs text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => onShowOverlayChange(e.target.checked)}
            />
            Show markers on Top / 顯示 Top 標記
          </label>
          <div className="max-h-36 overflow-y-auto border border-[#3d5563] rounded-sm">
            <table className="cad-fixtures-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Conf.</th>
                  <th>x (m)</th>
                  <th>y (m)</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codeRaw}</td>
                    <td>{(p.confidence * 100).toFixed(0)}%</td>
                    <td className="tabular-nums">{p.pointM?.x.toFixed(2) ?? "—"}</td>
                    <td className="tabular-nums">{p.pointM?.y.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#8fa3ad]">
            Proposals only — confirm &amp; place fixtures in a later step (F2.4).
          </p>
        </>
      )}
    </div>
  );
}
