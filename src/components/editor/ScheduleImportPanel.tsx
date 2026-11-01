"use client";

import { useMemo, useRef, useState } from "react";
import type { FixtureCodeMapRule } from "@luxsim/project-io";
import { lookupFixtureCode } from "@/lib/fixture-code-map";
import {
  acceptAllMappedScheduleRows,
  enrichScheduleRows,
  parseScheduleCsv,
  setScheduleRowStatus,
  summarizeScheduleImport,
  type ScheduleImportRow,
} from "@/lib/schedule-csv";
import type { RoomV2 } from "@luxsim/project-io";

type Props = {
  room: RoomV2 | null;
  rooms: RoomV2[];
  storeyId: string;
  codeMapRules: FixtureCodeMapRule[];
  luminaireNames: Record<string, string>;
  rows: ScheduleImportRow[];
  onRowsChange: (rows: ScheduleImportRow[]) => void;
  parseErrors: string[];
  onParseErrorsChange: (errors: string[]) => void;
  calcAfterCommit: boolean;
  onCalcAfterCommitChange: (v: boolean) => void;
  committing: boolean;
  onCommit: (options: { calcAfterCommit: boolean }) => void;
};

export function ScheduleImportPanel({
  room,
  rooms,
  storeyId,
  codeMapRules,
  luminaireNames,
  rows,
  onRowsChange,
  parseErrors,
  onParseErrorsChange,
  calcAfterCommit,
  onCalcAfterCommitChange,
  committing,
  onCommit,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const summary = useMemo(
    () => summarizeScheduleImport(rows),
    [rows]
  );

  function mapLabel(row: ScheduleImportRow): string {
    if (row.parseError) return row.parseError;
    const lookup = lookupFixtureCode(row.codeRaw, codeMapRules);
    if (lookup.status === "mapped" && lookup.luminaireId) {
      return luminaireNames[lookup.luminaireId] ?? lookup.luminaireId;
    }
    if (lookup.status === "ambiguous") return "Ambiguous / 多項匹配";
    return "Unmapped / 未對應";
  }

  function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows: parsed, errors } = parseScheduleCsv(text);
      onParseErrorsChange(errors);
      onRowsChange(enrichScheduleRows(parsed, codeMapRules, rooms, storeyId));
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function patchRow(id: string, patch: (r: ScheduleImportRow) => ScheduleImportRow) {
    onRowsChange(rows.map((r) => (r.id === id ? patch(r) : r)));
  }

  const canCommit = summary.readyForCommit > 0 && summary.unmappedBlocked === 0 && !committing;

  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0">Import schedule / 匯入 schedule</p>
      <p className="text-[10px] text-[#8fa3ad]">
        CSV columns: code, x, y [, z, rotationDeg] — coordinates in metres / 座標單位：米
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="input text-xs"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {fileName && (
        <p className="text-[10px] text-[#8fa3ad]">
          Loaded {fileName} · {rows.length} row(s)
        </p>
      )}
      {parseErrors.length > 0 && (
        <ul className="text-[10px] text-[#ffb088] list-disc pl-4">
          {parseErrors.slice(0, 6).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

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
                      <td className="tabular-nums">{Number.isFinite(row.x) ? row.x.toFixed(2) : "—"}</td>
                      <td className="tabular-nums">{Number.isFinite(row.y) ? row.y.toFixed(2) : "—"}</td>
                      <td className="text-[#8fa3ad]">
                        {row.outsideRoom ? "Outside / 房外" : row.roomId ? "OK" : "—"}
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          className="text-[10px] text-[#7dcea0] mr-1"
                          disabled={!!row.parseError}
                          onClick={() => patchRow(row.id, (r) => setScheduleRowStatus(r, "accepted"))}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-[#f5a5a5]"
                          onClick={() => patchRow(row.id, (r) => setScheduleRowStatus(r, "rejected"))}
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
              onClick={() => onRowsChange(acceptAllMappedScheduleRows(rows))}
            >
              Accept all mapped / 接受已對應
            </button>
          </div>

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
              summary.unmappedBlocked
                ? "Resolve unmapped accepted rows / 請處理未對應的已接受列"
                : undefined
            }
            onClick={() => onCommit({ calcAfterCommit })}
          >
            {committing
              ? "Committing… / 提交中…"
              : `Commit schedule (${summary.readyForCommit}) / 提交 (${summary.readyForCommit})`}
          </button>

          {summary.unmappedBlocked > 0 && (
            <p className="text-[10px] text-[#ffb088]">
              Unmapped accepted rows block commit — update code map or reject. / 已接受但未對應會阻止提交。
            </p>
          )}
        </>
      )}

      {!room && rows.length === 0 && (
        <p className="text-[10px] text-[#8fa3ad]">Select active storey rooms for placement. / 請確認樓層與房間。</p>
      )}
    </div>
  );
}
