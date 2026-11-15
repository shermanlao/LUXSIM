"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomV2 } from "@luxsim/project-io";
import {
  clampUtilance,
  DEFAULT_UTILANCE,
  previewTargetEmArrange,
  type TargetEmArrangeEstimate,
} from "@/lib/arrange-by-em";
import { defaultCircleRadiusM, planFixtureArray, type ArrayMode, type ArrayParams, type ArrayPoint } from "@/lib/arrange-array";
import {
  filterPointsOccupiedInRoom,
  type OccupiedFixtureRef,
} from "@/lib/array-occupied";
import { HelpTip } from "@/components/HelpTip";
import {
  EMPTY_LINE_PICK,
  LINE_ARRAY_PICK_HINT,
  LINE_ARRAY_SPACING_Y_REASON,
  isLinePickComplete,
  lineArrayDerivedSpacingM,
  type LinePickState,
} from "@/lib/line-array-pick";
import {
  CIRCLE_ARRAY_PICK_HINT,
  CIRCLE_ARRAY_ROTATION_REASON,
  CIRCLE_ARRAY_UNUSED_FIELDS_REASON,
  EMPTY_CIRCLE_PICK,
  isCircleCentrePicked,
  type CirclePickState,
} from "@/lib/circle-array-pick";
import {
  POLYGON_ARRAY_HINT,
  POLYGON_ARRAY_ROTATION_REASON,
  POLYGON_ARRAY_UNUSED_FIELDS_REASON,
} from "@/lib/polygon-array";
import { clampMf, resolveMaintenanceFactor } from "@luxsim/project-io";

type LumOption = { id: string; name: string; fluxLm: number | null };

type PanelMode = ArrayMode | "targetEm";

type Props = {
  room: RoomV2 | null;
  /** Scene instances used to omit already-occupied XY from Preview (same room, 1 mm). */
  existingInstances: OccupiedFixtureRef[];
  luminaires: LumOption[];
  preview: ArrayPoint[] | null;
  onPreviewChange: (points: ArrayPoint[] | null) => void;
  calcAfterPlace: boolean;
  onCalcAfterPlaceChange: (v: boolean) => void;
  applying: boolean;
  onApply: (params: ArrayParams, luminaireId: string) => void;
  onCancel: () => void;
  linePick: LinePickState;
  onLinePickChange: (next: LinePickState) => void;
  onLinePickActiveChange: (active: boolean) => void;
  circlePick: CirclePickState;
  onCirclePickChange: (next: CirclePickState) => void;
  onCirclePickActiveChange: (active: boolean) => void;
};

export function FixtureArrayPanel({
  room,
  existingInstances,
  luminaires,
  preview,
  onPreviewChange,
  calcAfterPlace,
  onCalcAfterPlaceChange,
  applying,
  onApply,
  onCancel,
  linePick,
  onLinePickChange,
  onLinePickActiveChange,
  circlePick,
  onCirclePickChange,
  onCirclePickActiveChange,
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
  const [radius, setRadius] = useState("1");

  const [targetEm, setTargetEm] = useState("500");
  const [utilance, setUtilance] = useState(String(DEFAULT_UTILANCE));
  const [utilanceTouched, setUtilanceTouched] = useState(false);
  const [emEstimate, setEmEstimate] = useState<TargetEmArrangeEstimate | null>(null);
  const [previewSkippedOccupied, setPreviewSkippedOccupied] = useState(0);

  useEffect(() => {
    if (luminaires.length && !luminaires.some((l) => l.id === luminaireId)) {
      setLuminaireId(luminaires[0]!.id);
    }
  }, [luminaires, luminaireId]);

  useEffect(() => {
    if (!preview) setPreviewSkippedOccupied(0);
  }, [preview]);

  useEffect(() => {
    onLinePickActiveChange(mode === "line" && Boolean(room));
    return () => onLinePickActiveChange(false);
  }, [mode, room, onLinePickActiveChange]);

  useEffect(() => {
    onCirclePickActiveChange(mode === "circle" && Boolean(room));
    return () => onCirclePickActiveChange(false);
  }, [mode, room, onCirclePickActiveChange]);

  useEffect(() => {
    if (mode !== "line" && (linePick.start || linePick.end)) {
      onLinePickChange(EMPTY_LINE_PICK);
    }
    if (mode !== "circle" && circlePick.centre) {
      onCirclePickChange(EMPTY_CIRCLE_PICK);
    }
  }, [mode, linePick.start, linePick.end, circlePick.centre, onLinePickChange, onCirclePickChange]);

  useEffect(() => {
    if (!room) return;
    setRadius(defaultCircleRadiusM(room).toFixed(2));
    // Prefill from the selected room only; do not reset when the same room object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

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
    const rad = Number(radius);
    if (![sx, sy, wo, rot, rad].every((n) => Number.isFinite(n))) return null;
    if (mode === "circle" && rad < 0) return null;
    const lineComplete = mode === "line" && isLinePickComplete(linePick);
    const circlePicked = mode === "circle" && isCircleCentrePicked(circlePick);
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
      lineStart: lineComplete ? linePick.start : null,
      lineEnd: lineComplete ? linePick.end : null,
      radius: rad,
      circleCentre: circlePicked ? circlePick.centre : null,
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

  function publishPreview(inside: ArrayPoint[]) {
    if (!room) {
      setPreviewSkippedOccupied(0);
      onPreviewChange(null);
      return;
    }
    const filtered = filterPointsOccupiedInRoom(inside, existingInstances, room.id);
    setPreviewSkippedOccupied(filtered.skippedOccupied.length);
    // Keep an empty array (not null) so an all-skipped preview can still show the skip count.
    onPreviewChange(filtered.placeable);
  }

  function handlePreview() {
    if (!room) {
      onPreviewChange(null);
      setEmEstimate(null);
      setPreviewSkippedOccupied(0);
      return;
    }
    if (mode === "targetEm") {
      const input = buildTargetEmInput();
      if (!input) {
        onPreviewChange(null);
        setEmEstimate(null);
        setPreviewSkippedOccupied(0);
        return;
      }
      const out = previewTargetEmArrange(room, input);
      if (!out) {
        onPreviewChange(null);
        setEmEstimate(null);
        setPreviewSkippedOccupied(0);
        return;
      }
      setEmEstimate(out.estimate);
      publishPreview(out.plan.inside);
      return;
    }
    setEmEstimate(null);
    const params = buildParams();
    if (!params) {
      onPreviewChange(null);
      setPreviewSkippedOccupied(0);
      return;
    }
    const plan = planFixtureArray(room, params);
    publishPreview(plan.inside);
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

  useEffect(() => {
    if (mode !== "line" || !room) return;
    if (isLinePickComplete(linePick)) {
      const params = buildParams();
      if (!params) return;
      const plan = planFixtureArray(room, params);
      publishPreview(plan.inside);
      return;
    }
    if (linePick.start && !linePick.end) {
      setPreviewSkippedOccupied(0);
      onPreviewChange(null);
    }
    // Numeric fallback is previewed only when the user presses Preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room, linePick.start, linePick.end, count, rotationDeg, existingInstances, luminaireId]);

  useEffect(() => {
    if (mode !== "circle" || !room) return;
    if (isCircleCentrePicked(circlePick)) {
      const params = buildParams();
      if (!params) return;
      const plan = planFixtureArray(room, params);
      publishPreview(plan.inside);
    }
    // Numeric room-centre fallback is previewed only when the user presses Preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room, circlePick.centre, count, radius, rotationDeg, existingInstances, luminaireId]);

  const lineComplete = mode === "line" && isLinePickComplete(linePick);
  const derivedLineSpacing =
    lineComplete
      ? lineArrayDerivedSpacingM(linePick.start, linePick.end, Math.max(1, Math.floor(Number(count) || 1)))
      : null;

  const previewCount = preview?.length ?? 0;
  const fluxBlocked = mode === "targetEm" && (!selectedFlux || selectedFlux <= 0);

  return (
    <div className="cad-props-card space-y-2">
      <p className="cad-section-title !mt-0 flex items-center gap-1">
        Arrange · array / 排列
        {mode === "line" && <HelpTip helpKey="tool.lineArray" />}
        {mode === "circle" && <HelpTip helpKey="tool.circleArray" />}
        {mode === "polygon" && <HelpTip helpKey="tool.polygonArray" />}
      </p>
      {!room && (
        <p className="text-xs text-[#8fa3ad]">Select a room in the building tree first. / 請先在左側選房間。</p>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["rect", "Rectangular", "矩形"],
            ["line", "Line", "直線"],
            ["circle", "Circle", "圓形"],
            ["polygon", "Polygon", "多邊形"],
            ["targetEm", "By target Ēm", "目標照度"],
          ] as const
        ).map(([m, en, zh]) => (
          <button
            key={m}
            type="button"
            className={`btn !text-[10px] flex-1 min-w-[18%] ${mode === m ? "btn-accent" : "btn-secondary"}`}
            onClick={() => {
              setMode(m);
              setEmEstimate(null);
              setPreviewSkippedOccupied(0);
              onPreviewChange(null);
              if (m !== "line") onLinePickChange(EMPTY_LINE_PICK);
              if (m !== "circle") onCirclePickChange(EMPTY_CIRCLE_PICK);
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
      ) : mode === "circle" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Count</label>
              <input className="input" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <label className="label">Radius (m) / 半徑</label>
              <input className="input" value={radius} onChange={(e) => setRadius(e.target.value)} />
            </div>
          </div>
          <p className="text-[10px] text-[#8fa3ad]">{CIRCLE_ARRAY_PICK_HINT}</p>
          <p className="text-[10px] text-[#8fa3ad]">{CIRCLE_ARRAY_ROTATION_REASON}</p>
          {!room ? null : !circlePick.centre ? (
            <p className="text-[10px] text-[#c5d4dc]">
              Optional: click once on the Top plan to set the centre / 可在平面圖點一下設定圓心
            </p>
          ) : (
            <p className="text-[10px] text-[#c5d4dc]">
              Centre at ({circlePick.centre.x.toFixed(2)}, {circlePick.centre.y.toFixed(2)}) m / 已設定圓心
            </p>
          )}
          {circlePick.centre && (
            <button
              type="button"
              className="btn btn-secondary !text-[10px]"
              onClick={() => {
                onCirclePickChange(EMPTY_CIRCLE_PICK);
                setPreviewSkippedOccupied(0);
                onPreviewChange(null);
              }}
            >
              Clear centre / 清除圓心
            </button>
          )}
        </div>
      ) : mode === "polygon" ? (
        <div className="space-y-2">
          <div>
            <label className="label">Count</label>
            <input className="input" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <p className="text-[10px] text-[#8fa3ad]">{POLYGON_ARRAY_HINT}</p>
          <p className="text-[10px] text-[#8fa3ad]">{POLYGON_ARRAY_ROTATION_REASON}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="label">Count</label>
            <input className="input" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <p className="text-[10px] text-[#8fa3ad]">{LINE_ARRAY_PICK_HINT}</p>
          {!room ? null : !linePick.start ? (
            <p className="text-[10px] text-[#c5d4dc]">
              Optional: click two points on the Top plan / 可在平面圖點兩下設定線段
            </p>
          ) : !linePick.end ? (
            <p className="text-[10px] text-[#c5d4dc]">
              Click the end point on the Top plan / 請在平面圖點選終點
            </p>
          ) : (
            <p className="text-[10px] text-[#c5d4dc]">
              Line from ({linePick.start.x.toFixed(2)}, {linePick.start.y.toFixed(2)}) to (
              {linePick.end.x.toFixed(2)}, {linePick.end.y.toFixed(2)}) m / 已設定線段
            </p>
          )}
          {(linePick.start || linePick.end) && (
            <button
              type="button"
              className="btn btn-secondary !text-[10px]"
              onClick={() => {
                onLinePickChange(EMPTY_LINE_PICK);
                setPreviewSkippedOccupied(0);
                onPreviewChange(null);
              }}
            >
              Clear line / 清除線段
            </button>
          )}
        </div>
      )}

      {mode !== "targetEm" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">
                {lineComplete ? "Along line (m) / 沿線間距" : "Spacing X (m)"}
              </label>
              <input
                className="input"
                value={
                  lineComplete
                    ? derivedLineSpacing != null
                      ? derivedLineSpacing.toFixed(2)
                      : "—"
                    : spacingX
                }
                onChange={(e) => setSpacingX(e.target.value)}
                disabled={lineComplete || mode === "circle" || mode === "polygon"}
              />
            </div>
            <div>
              <label className="label">Spacing Y (m)</label>
              <input
                className="input"
                value={spacingY}
                onChange={(e) => setSpacingY(e.target.value)}
                disabled={mode === "line" || mode === "circle" || mode === "polygon"}
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
                disabled={mode === "line" || mode === "circle" || mode === "polygon"}
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
          {mode === "line" && (
            <p className="text-[10px] text-[#8fa3ad]">{LINE_ARRAY_SPACING_Y_REASON}</p>
          )}
          {mode === "circle" && (
            <p className="text-[10px] text-[#8fa3ad]">{CIRCLE_ARRAY_UNUSED_FIELDS_REASON}</p>
          )}
          {mode === "polygon" && (
            <p className="text-[10px] text-[#8fa3ad]">{POLYGON_ARRAY_UNUSED_FIELDS_REASON}</p>
          )}
          {lineComplete && derivedLineSpacing == null && (
            <p className="text-[10px] text-[#8fa3ad]">
              One fixture is placed at the midpoint of the line. / 單盞放在線段中點。
            </p>
          )}
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

      {(previewCount > 0 || previewSkippedOccupied > 0) && (
        <p className="text-[10px] text-[#8fa3ad]">
          Preview: {previewCount} fixture(s) inside room
          {previewSkippedOccupied > 0
            ? ` · ${previewSkippedOccupied} skipped (already at that position)`
            : ""}
        </p>
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
