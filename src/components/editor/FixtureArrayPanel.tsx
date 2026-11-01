"use client";

import { useEffect, useState } from "react";
import type { RoomV2 } from "@luxsim/project-io";
import type { ArrayMode, ArrayParams, ArrayPoint } from "@/lib/arrange-array";
import { planFixtureArray } from "@/lib/arrange-array";

type LumOption = { id: string; name: string };

type Props = {
  room: RoomV2 | null;
  luminaires: LumOption[];
  preview: ArrayPoint[] | null;
  onPreviewChange: (points: ArrayPoint[] | null) => void;
  calcAfterPlace: boolean;
  onCalcAfterPlaceChange: (v: boolean) => void;
  applying: boolean;
  onApply: (params: ArrayParams, luminaireId: string) => void;
  onCancel: () => void;
};

export function FixtureArrayPanel({
  room,
  luminaires,
  preview,
  onPreviewChange,
  calcAfterPlace,
  onCalcAfterPlaceChange,
  applying,
  onApply,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<ArrayMode>("rect");
  const [luminaireId, setLuminaireId] = useState(luminaires[0]?.id ?? "");
  const [rows, setRows] = useState("2");
  const [cols, setCols] = useState("3");
  const [count, setCount] = useState("4");
  const [spacingX, setSpacingX] = useState("1.5");
  const [spacingY, setSpacingY] = useState("1.5");
  const [wallOffset, setWallOffset] = useState("0.5");
  const [rotationDeg, setRotationDeg] = useState("0");

  useEffect(() => {
    if (luminaires.length && !luminaires.some((l) => l.id === luminaireId)) {
      setLuminaireId(luminaires[0]!.id);
    }
  }, [luminaires, luminaireId]);

  function buildParams(): ArrayParams | null {
    if (!room) return null;
    const sx = Number(spacingX);
    const sy = Number(spacingY);
    const wo = Number(wallOffset);
    const rot = Number(rotationDeg);
    if (![sx, sy, wo, rot].every((n) => Number.isFinite(n))) return null;
    return {
      mode,
      rows: Math.max(1, Math.floor(Number(rows) || 1)),
      cols: Math.max(1, Math.floor(Number(cols) || 1)),
      count: Math.max(1, Math.floor(Number(count) || 1)),
      spacingX: sx,
      spacingY: sy,
      wallOffset: wo,
      rotationDeg: rot,
    };
  }

  function handlePreview() {
    const params = buildParams();
    if (!params || !room) {
      onPreviewChange(null);
      return;
    }
    const plan = planFixtureArray(room, params);
    onPreviewChange(plan.inside);
  }

  function handleApplyClick() {
    const params = buildParams();
    if (!params || !luminaireId) return;
    onApply(params, luminaireId);
  }

  const previewCount = preview?.length ?? 0;

  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0">Arrange · array</p>
      {!room && (
        <p className="text-xs text-[#8fa3ad]">Select a room in the building tree first.</p>
      )}

      <div className="flex gap-1">
        {(["rect", "line"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn !text-xs flex-1 ${mode === m ? "btn-accent" : "btn-secondary"}`}
            onClick={() => setMode(m)}
          >
            {m === "rect" ? "Rectangular" : "Line"}
          </button>
        ))}
      </div>

      <label className="label">Fixture</label>
      <select
        className="select"
        value={luminaireId}
        onChange={(e) => setLuminaireId(e.target.value)}
        disabled={!luminaires.length}
      >
        {!luminaires.length && <option value="">Add fixtures to project</option>}
        {luminaires.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      {mode === "rect" ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Rows</label>
            <input className="input" value={rows} onChange={(e) => setRows(e.target.value)} />
          </div>
          <div>
            <label className="label">Cols</label>
            <input className="input" value={cols} onChange={(e) => setCols(e.target.value)} />
          </div>
        </div>
      ) : (
        <div>
          <label className="label">Count</label>
          <input className="input" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Spacing X (m)</label>
          <input className="input" value={spacingX} onChange={(e) => setSpacingX(e.target.value)} />
        </div>
        <div>
          <label className="label">Spacing Y (m)</label>
          <input
            className="input"
            value={spacingY}
            onChange={(e) => setSpacingY(e.target.value)}
            disabled={mode === "line"}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Wall offset (m)</label>
          <input
            className="input"
            value={wallOffset}
            onChange={(e) => setWallOffset(e.target.value)}
            disabled={mode === "line"}
          />
        </div>
        <div>
          <label className="label">Rotation (°)</label>
          <input
            className="input"
            value={rotationDeg}
            onChange={(e) => setRotationDeg(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-[#c5d4dc] cursor-pointer">
        <input
          type="checkbox"
          checked={calcAfterPlace}
          onChange={(e) => onCalcAfterPlaceChange(e.target.checked)}
        />
        Calc after place
      </label>

      {previewCount > 0 && (
        <p className="text-[10px] text-[#8fa3ad]">Preview: {previewCount} fixture(s) inside room</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn btn-secondary !text-xs flex-1" onClick={handlePreview} disabled={!room}>
          Preview
        </button>
        <button
          type="button"
          className="btn btn-accent !text-xs flex-1"
          onClick={handleApplyClick}
          disabled={!room || !luminaireId || applying}
        >
          {applying ? "Applying…" : "Apply"}
        </button>
        <button type="button" className="btn btn-secondary !text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
