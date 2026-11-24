"use client";

import { useEffect, useMemo } from "react";
import type {
  FalseColorScale,
  IsoluxModel,
  ProjectSceneV2,
  ResultsV2,
  RoomV2,
} from "@luxsim/project-io";
import { isolineSettingsFromUi } from "@luxsim/project-io";
import {
  isoluxFieldScreenRect,
  isoluxPxToWorld,
  officialIsoluxModelForRoom,
} from "@luxsim/project-io";
import { officialPlanIsoluxModels } from "@/lib/plan-falsecolor-layer";

type ScreenPt = { x: number; y: number };

function pointsAttr(pts: ScreenPt[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function canvasPngToBlobUrl(canvas: HTMLCanvasElement): string | null {
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
}

/**
 * Short blob URL for a workplane bitmap. A data URL must not be placed in the
 * live SVG — those strings are huge and make pan snapshots / DOM updates lag.
 */
function fieldImageHref(model: IsoluxModel): string | null {
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
  return canvasPngToBlobUrl(canvas);
}

export function PlanIsoluxOverlay({
  scene,
  rooms,
  results,
  showFalseColor = true,
  showIsolines = false,
  showValueLabels,
  toScreen,
  colorScale,
}: {
  scene: ProjectSceneV2;
  rooms: RoomV2[];
  results: ResultsV2;
  showFalseColor?: boolean;
  showIsolines?: boolean;
  showValueLabels: boolean;
  toScreen: (x: number, y: number) => ScreenPt;
  /** @deprecated Kept so existing call sites can pass the committed view; not used to rebuild or re-rasterize. */
  viewW?: number;
  viewH?: number;
  viewOx?: number;
  viewOy?: number;
  viewScale?: number;
  colorScale?: FalseColorScale;
}) {
  const isolineSettings = isolineSettingsFromUi(scene.ui);
  const models = useMemo(
    () =>
      officialPlanIsoluxModels({
        rooms,
        results,
        fixtures: scene.instances,
        showFalseColor,
        showIsolines,
        showValueLabels,
        colorScale,
        isolineSettings,
      }),
    [
      rooms,
      results,
      showFalseColor,
      showIsolines,
      scene.instances,
      colorScale,
      showValueLabels,
      isolineSettings.mode,
      isolineSettings.levels,
    ]
  );

  const fieldImages = useMemo(() => {
    if (!showFalseColor) return [] as { room: RoomV2; model: IsoluxModel; href: string }[];
    const out: { room: RoomV2; model: IsoluxModel; href: string }[] = [];
    for (const { room, model } of models) {
      const href = fieldImageHref(model);
      if (href) out.push({ room, model, href });
    }
    return out;
    // Field bitmaps are baked once per isolux model — not when the committed view pan/zoom changes.
  }, [models, showFalseColor]);

  useEffect(() => {
    const urls = fieldImages.map((item) => item.href).filter((href) => href.startsWith("blob:"));
    return () => {
      for (const href of urls) URL.revokeObjectURL(href);
    };
  }, [fieldImages]);

  if (models.length === 0 && fieldImages.length === 0) return null;

  return (
    <g data-plan-isolux-overlay="" pointerEvents="none">
      {showFalseColor &&
        fieldImages.map(({ room, model, href }) => {
          const rect = isoluxFieldScreenRect(model.world, model.width, model.height, toScreen);
          if (!rect) return null;
          return (
            <image
              key={`${room.id}-falsecolor`}
              href={href}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              preserveAspectRatio="none"
              opacity={0.92}
              pointerEvents="none"
              data-plan-falsecolor-image={room.id}
              data-plan-falsecolor-canvas=""
            />
          );
        })}
      {models.map(({ room, model }) => {
        const toS = (px: { x: number; y: number }) => {
          const w = isoluxPxToWorld(model.world, px);
          return toScreen(w.x, w.y);
        };
        const topLeft = toS({ x: 0, y: 0 });
        const topRight = toS({ x: model.width, y: 0 });
        const imgW = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        const contourColor = showFalseColor ? "#3a2a12" : "#e8eef2";
        const labelFill = showFalseColor ? "#1a1a1a" : "#f5f7f8";
        const valueFill = showFalseColor ? "#1a3370" : "#dce8ff";
        const fontScreen = Math.max(8, Math.min(18, model.fontPx * (imgW / Math.max(model.width, 1))));

        return (
          <g key={room.id} data-plan-isolux-room={room.id}>
            {showIsolines &&
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
            {showIsolines &&
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

// Re-export so source-wiring tests and callers can find the model builder.
export { officialIsoluxModelForRoom, officialPlanIsoluxModels };
