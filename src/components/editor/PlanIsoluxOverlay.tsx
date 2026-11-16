"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type {
  FalseColorScale,
  IsoluxMode,
  IsoluxModel,
  ProjectSceneV2,
  ResultsV2,
  RoomV2,
} from "@luxsim/project-io";
import {
  isoluxFieldScreenRect,
  isoluxPxToWorld,
  officialIsoluxModelForRoom,
} from "@luxsim/project-io";

type ScreenPt = { x: number; y: number };

function pointsAttr(pts: ScreenPt[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function fieldCanvasFor(model: IsoluxModel): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (model.field.length < model.width * model.height * 4) return null;
  const canvas = document.createElement("canvas");
  canvas.width = model.width;
  canvas.height = model.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = new ImageData(model.width, model.height);
  image.data.set(model.field);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function PlanIsoluxOverlay({
  scene,
  rooms,
  results,
  mode,
  showValueLabels,
  toScreen,
  viewW,
  viewH,
  viewOx,
  viewOy,
  viewScale,
  colorScale,
}: {
  scene: ProjectSceneV2;
  rooms: RoomV2[];
  results: ResultsV2;
  mode: IsoluxMode;
  showValueLabels: boolean;
  toScreen: (x: number, y: number) => ScreenPt;
  viewW: number;
  viewH: number;
  viewOx: number;
  viewOy: number;
  viewScale: number;
  colorScale?: FalseColorScale;
}) {
  const models = useMemo(() => {
    const out: { room: RoomV2; model: IsoluxModel }[] = [];
    for (const room of rooms) {
      const model = officialIsoluxModelForRoom(room, results.byRoomId[room.id], {
        mode,
        fixtures: scene.instances.filter((i) => i.roomId === room.id),
        targetLongSide: 800,
        colorScale,
        includeContours: mode === "isolines",
        includeValueLabels: showValueLabels,
      });
      if (model) out.push({ room, model });
    }
    return out;
  }, [rooms, results, mode, scene.instances, colorScale, showValueLabels]);

  const fieldCanvases = useMemo(() => {
    if (mode !== "falsecolor") return [] as { model: IsoluxModel; canvas: HTMLCanvasElement }[];
    const out: { model: IsoluxModel; canvas: HTMLCanvasElement }[] = [];
    for (const { model } of models) {
      const canvas = fieldCanvasFor(model);
      if (canvas) out.push({ model, canvas });
    }
    return out;
  }, [models, mode]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || mode !== "falsecolor") return;
    if (cvs.width !== viewW) cvs.width = viewW;
    if (cvs.height !== viewH) cvs.height = viewH;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.92;
    for (const { model, canvas } of fieldCanvases) {
      const rect = isoluxFieldScreenRect(model.world, model.width, model.height, toScreen);
      if (!rect) continue;
      ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height);
    }
    // Only repaint when the committed plan view or field bitmaps change — not on cursor moves.
  }, [mode, viewW, viewH, viewOx, viewOy, viewScale, fieldCanvases]);

  if (models.length === 0 && fieldCanvases.length === 0) return null;

  return (
    <g data-plan-isolux-overlay="" pointerEvents="none">
      {mode === "falsecolor" && viewW > 0 && viewH > 0 && (
        <foreignObject
          x={0}
          y={0}
          width={viewW}
          height={viewH}
          pointerEvents="none"
          data-plan-falsecolor-layer=""
        >
          <canvas
            ref={canvasRef}
            width={viewW}
            height={viewH}
            data-plan-falsecolor-canvas=""
            style={{ display: "block", width: "100%", height: "100%" }}
          />
        </foreignObject>
      )}
      {models.map(({ room, model }) => {
        const toS = (px: { x: number; y: number }) => {
          const w = isoluxPxToWorld(model.world, px);
          return toScreen(w.x, w.y);
        };
        const topLeft = toS({ x: 0, y: 0 });
        const topRight = toS({ x: model.width, y: 0 });
        const imgW = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        const contourColor = mode === "falsecolor" ? "#3a2a12" : "#e8eef2";
        const labelFill = mode === "falsecolor" ? "#1a1a1a" : "#f5f7f8";
        const valueFill = mode === "falsecolor" ? "#1a3370" : "#dce8ff";
        const fontScreen = Math.max(8, Math.min(18, model.fontPx * (imgW / Math.max(model.width, 1))));

        return (
          <g key={room.id} data-plan-isolux-room={room.id}>
            {mode === "isolines" &&
              model.contours.flatMap((c, ci) =>
                c.polylines
                  .filter((line) => line.length >= 2)
                  .map((line, li) => (
                    <polyline
                      key={`${room.id}-c${ci}-${li}`}
                      points={pointsAttr(line.map(toS))}
                      fill="none"
                      stroke={contourColor}
                      strokeWidth={1.2}
                    />
                  ))
              )}
            {mode === "isolines" &&
              model.contourLabels.map((label, i) => {
                const p = toS(label);
                return (
                  <text
                    key={`${room.id}-cl${i}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fontScreen}
                    fill={labelFill}
                    stroke="#0a1218"
                    strokeWidth={2}
                    paintOrder="stroke"
                  >
                    {label.text}
                  </text>
                );
              })}
            {showValueLabels &&
              model.valueLabels.map((label, i) => {
                const p = toS(label);
                return (
                  <text
                    key={`${room.id}-vl${i}`}
                    x={p.x}
                    y={p.y - 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(7, fontScreen - 2)}
                    fill={valueFill}
                    stroke="#0a1218"
                    strokeWidth={2}
                    paintOrder="stroke"
                  >
                    {label.text}
                  </text>
                );
              })}
          </g>
        );
      })}
    </g>
  );
}
