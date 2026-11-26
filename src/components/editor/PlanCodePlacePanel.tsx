"use client";

import { useMemo } from "react";
import type { FixtureCodeMapRule, RoomV2 } from "@luxsim/project-io";
import { lookupFixtureCode } from "@/lib/fixture-code-map";
import {
  acceptAllMappedPlanCodeRows,
  planCodeCommitBlockedReason,
  planCodeImportCanCommit,
  setPlanCodeRowStatus,
  summarizePlanCodeImport,
  type PlanCodePlaceRow,
} from "@/lib/plan-code-place";

type Props = {
  disabled?: boolean;
  rooms: RoomV2[];
  storeyId: string;
  codeMapRules: FixtureCodeMapRule[];
  luminaireNames: Record<string, string>;
  rows: PlanCodePlaceRow[];
  onRowsChange: (rows: PlanCodePlaceRow[]) => void;
  scanning: boolean;
  onScan: () => void;
  calcAfterCommit: boolean;
  onCalcAfterCommitChange: (v: boolean) => void;
  replaceExisting: boolean;
  onReplaceExistingChange: (v: boolean) => void;
  committing: boolean;
  onCommit: (options: { calcAfterCommit: boolean; replaceExistingFromPlanCodes: boolean }) => void;
};

export function PlanCodePlacePanel({
  disabled,
  rooms,
  codeMapRules,
  luminaireNames,
  rows,
  onRowsChange,
  scanning,
  onScan,
  calcAfterCommit,
  onCalcAfterCommitChange,
  replaceExisting,
  onReplaceExistingChange,
  committing,
  onCommit,
}: Props) {
  const summary = useMemo(() => summarizePlanCodeImport(rows), [rows]);
  const blockedReason = useMemo(() => planCodeCommitBlockedReason(rows), [rows]);
  const canCommit = planCodeImportCanCommit(summary, committing || scanning, blockedReason);

  function mapLabel(row: PlanCodePlaceRow): string {
    const lookup = lookupFixtureCode(row.codeRaw, codeMapRules);
    if (lookup.status === "mapped" && lookup.luminaireId) {
      return luminaireNames[lookup.luminaireId] ?? lookup.luminaireId;
    }
    if (lookup.status === "ambiguous") return "Ambiguous / 多項匹配";
    return "Unmapped / 未對應";
  }

  function patchRow(id: string, patch: (r: PlanCodePlaceRow) => PlanCodePlaceRow) {
    onRowsChange(rows.map((r) => (r.id === id ? patch(r) : r)));
  }

  const roomNames = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, r.name]));
    return map;
  }, [rooms]);

  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0">Place from plan codes / 按圖則燈碼佈燈</p>
      <p className="text-[10px] text-[#8fa3ad]">
        Reads lighting-code text from the imported DXF or converted DWG on this storey
        and places fixtures with the project code map. Rooms are not changed. /
        從本層已匯入的 DXF 或已轉換 DWG 讀取燈碼文字，並以專案代碼對應表佈燈。房間不會被改動。
      </p>
      <button
        type="button"
        className="btn btn-secondary w-full !text-xs"
        disabled={disabled || scanning || committing}
        onClick={onScan}
      >
        {scanning ? "Scanning… / 掃描中…" : "Scan plan codes / 掃描圖則燈碼"}
      </button>

      {rows.length > 0 && (
        <>
          <p className="text-[11px] text-[#c5d4dc]">
            Ready {summary.readyForCommit} · Blocked {summary.unmappedBlocked} · Outside{" "}
            {summary.outsideSkipped}
          </p>

          <div className="max-h-48 overflow-auto border border-[#3d5563] rounded-sm">
            <table className="cad-fixtures-table text-[10px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Map</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Room</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dim = row.reviewStatus === "rejected";
                  const mapClass =
                    row.mapStatus === "mapped"
                      ? "text-[#7dcea0]"
                      : row.mapStatus === "ambiguous"
                        ? "text-[#ffb088]"
                        : "text-[#f5a5a5]";
                  return (
                    <tr key={row.id} className={dim ? "opacity-50" : ""}>
                      <td>{row.codeRaw || "—"}</td>
                      <td className={mapClass}>{mapLabel(row)}</td>
                      <td className="tabular-nums">
                        {Number.isFinite(row.x) ? row.x.toFixed(2) : "—"}
                      </td>
                      <td className="tabular-nums">
                        {Number.isFinite(row.y) ? row.y.toFixed(2) : "—"}
                      </td>
                      <td className="text-[#8fa3ad]">
                        {row.outsideRoom
                          ? "Outside / 房外"
                          : row.roomId
                            ? roomNames.get(row.roomId) ?? "OK"
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          className="text-[10px] text-[#7dcea0] mr-1"
                          onClick={() =>
                            patchRow(row.id, (r) => setPlanCodeRowStatus(r, "accepted"))
                          }
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-[#f5a5a5]"
                          onClick={() =>
                            patchRow(row.id, (r) => setPlanCodeRowStatus(r, "rejected"))
                          }
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
              onClick={() => onRowsChange(acceptAllMappedPlanCodeRows(rows))}
            >
              Accept all mapped / 接受已對應
            </button>
          </div>

          <label className="flex items-center gap-2 text-[10px] text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => onReplaceExistingChange(e.target.checked)}
            />
            Replace prior plan-code fixtures / 取代先前按燈碼佈置的燈具
          </label>
          <label className="flex items-center gap-2 text-[10px] text-[#c5d4dc] cursor-pointer">
            <input
              type="checkbox"
              checked={calcAfterCommit}
              onChange={(e) => onCalcAfterCommitChange(e.target.checked)}
            />
            Calc after commit / 提交後計算
          </label>

          <button
            type="button"
            className="btn btn-accent w-full !text-xs"
            disabled={!canCommit}
            title={
              blockedReason
                ? blockedReason
                : summary.readyForCommit === 0
                  ? "Accept mapped rows first / 請先接受已對應列"
                  : undefined
            }
            onClick={() =>
              onCommit({
                calcAfterCommit,
                replaceExistingFromPlanCodes: replaceExisting,
              })
            }
          >
            {committing
              ? "Committing… / 提交中…"
              : `Commit plan codes (${summary.readyForCommit}) / 提交燈碼 (${summary.readyForCommit})`}
          </button>

          {summary.unmappedBlocked > 0 && (
            <p className="text-[10px] text-[#ffb088]">
              {summary.unmappedBlocked} accepted row(s) unmapped or ambiguous — map codes or
              reject before commit. / 已接受但未對應的列會阻止提交。
            </p>
          )}
        </>
      )}
    </div>
  );
}
