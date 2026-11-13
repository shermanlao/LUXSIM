"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomV2 } from "@luxsim/project-io";
import {
  clampUtilance,
  DEFAULT_UTILANCE,
  previewTargetEmArrange,
  type TargetEmArrangeEstimate,
} from "@/lib/arrange-by-em";
import type { ArrayMode, ArrayParams, ArrayPoint } from "@/lib/arrange-array";
import { planFixtureArray } from "@/lib/arrange-array";
import { clampMf, resolveMaintenanceFactor } from "@luxsim/project-io";

type LumOption = { id: string; name: string; fluxLm: number | null };

type PanelMode = ArrayMode | "targetEm";

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
  const [mode, setMode] = useState<PanelMode>("rect");
  const [luminaireId, setLuminaireId] = useState(luminaires[0]?.id ?? "");
  const [rows, setRows] = useState("2");
  const [cols, setCols] = useState("3");
  const [count, setCount] = useState("4");
  const [spacingX, setSpacingX] = useState("1.5");
  const [spacingY, setSpacingY] = useState("1.5");
  const [wallOffset, setWallOffset] = useState("0.5");
  const [rotationDeg, setRotationDeg] = useState("0");
  const [targetEm, setTargetEm] = useState("500");
  const [utilance, setUtilance] = useState(String(DEFAULT_UTILANCE));
  const [utilanceTouched, setUtilanceTouched] = useState(false);
  const [emEstimate, setEmEstimate] = useState<TargetEmArrangeEstimate | null>(null);

  useEffect(() => {
    if (luminaires.length && !luminaires.some((l) => l.id === luminaireId)) {
      setLuminaireId(luminaires[0]!.id);
    }
  }, [luminaires, luminaireId]);

  const selectedFlux = luminaires.find((l) => l.id === luminaireId)?.fluxLm ?? null;

  const maintenanceFactor = useMemo(() => {
    if (!room) return 0.8;
    return resolveMaintenanceFactor({
      maintenanceFactor: room.calc.maintenanceFactor,
      mfBreakdown: room.calc.mfBreakdown,
    }).mf;
  }, [room]);

  function buildParams(): ArrayParams | null {
    if (!room) return null;
    const sx = Number(spacingX);
    const sy = Number(spacingY);
    const wo = Number(wallOffset);
    const rot = Number(rotationDeg);
    if (![sx, sy, wo, rot].every((n) => Number.isFinite(n))) return null;
    return {
      mode: mode === "targetEm" ? "rect" : mode,
      rows: Math.max(1, Math.floor(Number(rows) || 1)),
      cols: Math.max(1, Math.floor(Number(cols) || 1)),
      count: Math.max(1, Math.floor(Number(count) || 1)),
      spacingX: sx,
      spacingY: sy,
      wallOffset: wo,
      rotationDeg: rot,
      estimateByTargetEm: mode === "targetEm",
    };
  }

  function buildTargetEmInput() {
    if (!room) return null;
    const em = Number(targetEm);
    const eta = clampUtilance(Number(utilance));
    const wo = Number(wallOffset);
    const rot = Number(rotationDeg);
    if (!Number.isFinite(em) || em <= 0 || !Number.isFinite(wo) || !Number.isFinite(rot)) return null;
    if (!selectedFlux || selectedFlux <= 0) return null;
    return {
      targetEmMaintainedLx: em,
      luminousFluxLm: selectedFlux,
      utilance: eta,
      maintenanceFactor: clampMf(maintenanceFactor),
      wallOffset: wo,
      rotationDeg: rot,
      utilanceIsDefault: !utilanceTouched,
    };
  }

  function handlePreview() {
    if (!room) {
      onPreviewChange(null);
      setEmEstimate(null);
      return;
    }
    if (mode === "targetEm") {
      const input = buildTargetEmInput();
      if (!input) {
        onPreviewChange(null);
        setEmEstimate(null);
        return;
      }
      const out = previewTargetEmArrange(room, input);
      if (!out) {
        onPreviewChange(null);
        setEmEstimate(null);
        return;
      }
      setEmEstimate(out.estimate);
      onPreviewChange(out.plan.inside);
      return;
    }
    setEmEstimate(null);
    const params = buildParams();
    if (!params) {
      onPreviewChange(null);
      return;
    }
    const plan = planFixtureArray(room, params);
    onPreviewChange(plan.inside);
  }

  function handleApplyClick() {
    if (mode === "targetEm") {
      const input = buildTargetEmInput();
      if (!input || !luminaireId) return;
      const out = previewTargetEmArrange(room!, input);
      if (!out) return;
      onApply(out.estimate.arrayParams, luminaireId);
      return;
    }
    const params = buildParams();
    if (!params || !luminaireId) return;
    onApply(params, luminaireId);
  }

  const previewCount = preview?.length ?? 0;
  const fluxBlocked = mode === "targetEm" && (!selectedFlux || selectedFlux <= 0);

  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0">Arrange · array / 排列</p>
      {!room && (
        <p className="text-xs text-[#8fa3ad]">Select a room in the building tree first. / 請先在左側選房間。</p>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["rect", "Rectangular", "矩形"],
            ["line", "Line", "直線"],
            ["targetEm", "By target Ēm", "目標照度"],
          ] as const
        ).map(([m, en, zh]) => (
          <button
            key={m}
            type="button"
            className={`btn !text-[10px] flex-1 min-w-[30%] ${mode === m ? "btn-accent" : "btn-secondary"}`}
            onClick={() => {
              setMode(m);
              setEmEstimate(null);
              onPreviewChange(null);
            }}
          >
            {en}
            <span className="block text-[9px] opacity-80">{zh}</span>
          </button>
        ))}
      </div>

      <label className="label">Fixture / 燈具</label>
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
            {l.fluxLm ? ` · ${Math.round(l.fluxLm)} lm` : ""}
          </option>
        ))}
      </select>

      {fluxBlocked && (
        <p className="text-[10px] text-[#ffb088]">
          Luminous flux Φ unknown — upload IES/LDT or set lumens in Library. / 缺少光通量 — 請上載
          IES/LDT。
        </p>
      )}

      {mode === "targetEm" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Target maint. Ēm (lx) / 目標維持照度</label>
              <input className="input" value={targetEm} onChange={(e) => setTargetEm(e.target.value)} />
            </div>
            <div>
              <label className="label">Utilance η / 利用系數</label>
              <input
                className="input"
                value={utilance}
                onChange={(e) => {
                  setUtilance(e.target.value);
                  setUtilanceTouched(true);
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#8fa3ad]">
            n ≈ ceil((Ēm×A)/(Φ×η×MF)) · MF {maintenanceFactor.toFixed(2)} from room settings / 房間設定
          </p>
          {!utilanceTouched && (
            <p className="text-[10px] text-[#ffb088]">
              Default η={DEFAULT_UTILANCE} — adjust for room finishes / 預設利用系數，請按實際修正。
            </p>
          )}
          {emEstimate && (
            <div className="text-[10px] text-[#c5d4dc] border border-[#3d5563] rounded p-2 space-y-0.5">
              <p>
                n={emEstimate.fixtureCount} · grid {emEstimate.rows}×{emEstimate.cols} · spacing{" "}
                {emEstimate.spacingX.toFixed(2)}×{emEstimate.spacingY.toFixed(2)} m
              </p>
              <p>
                Est. avg maint. Ēm ≈ {emEstimate.estimatedMaintainedEmLx.toFixed(0)} lx (not calc) /
                估算平均照度
              </p>
              <p className="text-[#ffb088]">
                Estimate only — run Calc for final Ēm / 僅供估算 — 請用 Calc 確認
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Wall offset (m) / 離牆</label>
              <input className="input" value={wallOffset} onChange={(e) => setWallOffset(e.target.value)} />
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
        </>
      ) : mode === "rect" ? (
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

      {mode !== "targetEm" && (
        <>
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
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-[#c5d4dc] cursor-pointer">
        <input
          type="checkbox"
          checked={calcAfterPlace}
          onChange={(e) => onCalcAfterPlaceChange(e.target.checked)}
        />
        Calc after place / 放置後計算
      </label>

      {previewCount > 0 && (
        <p className="text-[10px] text-[#8fa3ad]">Preview: {previewCount} fixture(s) inside room</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="btn btn-secondary !text-xs flex-1"
          onClick={handlePreview}
          disabled={!room || fluxBlocked}
        >
          Preview / 預覽
        </button>
        <button
          type="button"
          className="btn btn-accent !text-xs flex-1"
          onClick={handleApplyClick}
          disabled={!room || !luminaireId || applying || fluxBlocked}
        >
          {applying ? "Applying… / 套用中…" : "Apply / 套用"}
        </button>
        <button type="button" className="btn btn-secondary !text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
