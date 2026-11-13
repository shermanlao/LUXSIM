"use client";

import { useMemo, useState } from "react";
import { planRcpCommit } from "@/lib/rcp-commit";
import {
  acceptAllMappedProposals,
  acceptProposals,
  getProposalMapDisplay,
  normalizeProposalCode,
  rejectProposals,
  setProposalStatus,
  summarizeRcpConfirm,
  updateProposalPointM,
} from "@/lib/rcp-confirm";
import type { FixtureCodeMapRule, ProjectSceneV2, RcpDetectionProposal } from "@luxsim/project-io";

type Props = {
  disabled?: boolean;
  detecting: boolean;
  proposals: RcpDetectionProposal[];
  codeMapRules: FixtureCodeMapRule[];
  luminaireNames: Record<string, string>;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onProposalsChange: (next: RcpDetectionProposal[]) => void;
  showOverlay: boolean;
  onShowOverlayChange: (v: boolean) => void;
  onDetect: () => void;
  lastWarnings: string[];
  scene: ProjectSceneV2;
  committing?: boolean;
  onCommit: (options: {
    replaceExistingFromDetect: boolean;
    calcAfterCommit: boolean;
  }) => void | Promise<void>;
};

export function RcpDetectPanel({
  disabled,
  detecting,
  proposals,
  codeMapRules,
  luminaireNames,
  selectedId,
  onSelectId,
  onProposalsChange,
  showOverlay,
  onShowOverlayChange,
  onDetect,
  lastWarnings,
  scene,
  committing = false,
  onCommit,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [replaceDetect, setReplaceDetect] = useState(false);
  const [calcAfterCommit, setCalcAfterCommit] = useState(false);

  const summary = useMemo(
    () => summarizeRcpConfirm(proposals, codeMapRules),
    [proposals, codeMapRules]
  );

  function patchOne(id: string, patch: (p: RcpDetectionProposal) => RcpDetectionProposal) {
    onProposalsChange(proposals.map((p) => (p.id === id ? patch(p) : p)));
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function acceptChecked() {
    if (!checked.size) return;
    onProposalsChange(acceptProposals(proposals, checked));
  }

  function handleCommitClick() {
    const plan = planRcpCommit({
      proposals,
      rules: codeMapRules,
      rooms: scene.rooms,
      storeyId: scene.ui.activeStoreyId,
      luminaireNames,
      scene,
    });
    if (!plan.drafts.length) {
      window.alert(
        plan.skippedOutside.length
          ? `No fixtures inside a room. ${plan.skippedOutside.length} point(s) outside room outline. / 沒有在房間內的點。`
          : "No accepted+mapped proposals to commit. / 沒有可提交的已接受項目。"
      );
      return;
    }

    let msg = `Place ${plan.drafts.length} fixture(s) from accepted RCP rows? / 從已接受的圖則列建立 ${plan.drafts.length} 個燈具？`;
    if (plan.skippedOutside.length) {
      msg += `\n\nSkip ${plan.skippedOutside.length} point(s) outside all rooms:\n${plan.skippedOutside
        .slice(0, 8)
        .map((s) => `· ${s.codeRaw} @ (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) m`)
        .join("\n")}${plan.skippedOutside.length > 8 ? "\n…" : ""}`;
    }
    if (!window.confirm(msg)) return;

    if (replaceDetect && plan.detectSourcedOnStorey > 0) {
      const ok = window.confirm(
        `Replace ${plan.detectSourcedOnStorey} existing detect-placed fixture(s) on this storey? / 取代本層 ${plan.detectSourcedOnStorey} 個先前由偵測放置的燈具？`
      );
      if (!ok) return;
    }

    void onCommit({ replaceExistingFromDetect: replaceDetect, calcAfterCommit });
  }

  function rejectChecked() {
    if (!checked.size) return;
    onProposalsChange(rejectProposals(proposals, checked));
  }

  const canCommit = summary.readyForCommit > 0 && !committing;

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
          <p className="text-[11px] text-[#c5d4dc]">
            Accept {summary.accepted + summary.edited} · Reject {summary.rejected} · Blocked{" "}
            {summary.unmappedBlocked} unmapped/ambiguous · Ready {summary.readyForCommit}
          </p>

          <label className="flex items-center gap-2 text-xs text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => onShowOverlayChange(e.target.checked)}
            />
            Show markers on Top / 顯示 Top 標記
          </label>

          <div className="max-h-52 overflow-auto border border-[#3d5563] rounded-sm">
            <table className="cad-fixtures-table text-[10px]">
              <thead>
                <tr>
                  <th />
                  <th>Code</th>
                  <th>Map</th>
                  <th>X m</th>
                  <th>Y m</th>
                  <th>Conf.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const map = getProposalMapDisplay(p, codeMapRules, luminaireNames);
                  const rowSelected = selectedId === p.id;
                  const dim = p.status === "rejected";
                  return (
                    <tr
                      key={p.id}
                      className={`${rowSelected ? "is-selected" : ""} ${dim ? "opacity-50" : ""}`}
                      onClick={() => onSelectId(p.id)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(p.id)}
                          onChange={() => toggleCheck(p.id)}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          className="input !text-[10px] !py-0.5 w-16"
                          value={p.codeRaw}
                          onChange={(e) =>
                            patchOne(p.id, (row) => normalizeProposalCode(row, e.target.value))
                          }
                        />
                        <span className="text-[#8fa3ad] ml-1">{p.status}</span>
                      </td>
                      <td
                        className={
                          map.display === "mapped"
                            ? "text-[#7dcea0]"
                            : map.display === "ambiguous"
                              ? "text-[#ffb088]"
                              : "text-[#f5a5a5]"
                        }
                      >
                        {map.label}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          className="input !text-[10px] !py-0.5 w-14 tabular-nums"
                          value={p.pointM?.x.toFixed(2) ?? ""}
                          onChange={(e) => {
                            const x = Number(e.target.value);
                            const y = p.pointM?.y ?? 0;
                            if (!Number.isFinite(x)) return;
                            patchOne(p.id, (row) => updateProposalPointM(row, { x, y }));
                          }}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          className="input !text-[10px] !py-0.5 w-14 tabular-nums"
                          value={p.pointM?.y.toFixed(2) ?? ""}
                          onChange={(e) => {
                            const y = Number(e.target.value);
                            const x = p.pointM?.x ?? 0;
                            if (!Number.isFinite(y)) return;
                            patchOne(p.id, (row) => updateProposalPointM(row, { x, y }));
                          }}
                        />
                      </td>
                      <td className="tabular-nums">{(p.confidence * 100).toFixed(0)}%</td>
                      <td onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                        <button
                          type="button"
                          className="text-[10px] text-[#7dcea0] mr-1"
                          onClick={() => patchOne(p.id, (row) => setProposalStatus(row, "accepted"))}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-[#f5a5a5]"
                          onClick={() => patchOne(p.id, (row) => setProposalStatus(row, "rejected"))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary !text-[10px]"
              onClick={() => onProposalsChange(acceptAllMappedProposals(proposals, codeMapRules))}
            >
              Accept all mapped / 接受已對應
            </button>
            <button type="button" className="btn btn-secondary !text-[10px]" onClick={acceptChecked}>
              Accept selected
            </button>
            <button type="button" className="btn btn-secondary !text-[10px]" onClick={rejectChecked}>
              Reject selected
            </button>
          </div>

          <label className="flex items-center gap-2 text-[10px] text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={replaceDetect}
              onChange={(e) => setReplaceDetect(e.target.checked)}
            />
            Replace prior detect fixtures / 取代先前偵測燈具
          </label>
          <label className="flex items-center gap-2 text-[10px] text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={calcAfterCommit}
              onChange={(e) => setCalcAfterCommit(e.target.checked)}
            />
            Calc after commit / 提交後計算
          </label>

          <button
            type="button"
            className="btn btn-accent w-full !text-xs"
            disabled={!canCommit}
            title={
              summary.readyForCommit === 0
                ? "Accept mapped rows first / 請先接受已對應列"
                : undefined
            }
            onClick={handleCommitClick}
          >
            {committing
              ? "Committing… / 提交中…"
              : `Commit accepted (${summary.readyForCommit}) / 提交已接受 (${summary.readyForCommit})`}
          </button>
          {summary.unmappedBlocked > 0 && (
            <p className="text-[10px] text-[#ffb088]">
              {summary.unmappedBlocked} accepted/edited row(s) blocked — fix code map or edit code
              before commit.
            </p>
          )}
        </>
      )}
    </div>
  );
}
