"use client";

import { useMemo } from "react";
import type { IsoluxMode, IsoluxModel, ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import { isoluxFieldPngDataUrl, isoluxPxToWorld, officialIsoluxModelForRoom } from "@luxsim/project-io";

type ScreenPt = { x: number; y: number };

function pointsAttr(pts: ScreenPt[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function PlanIsoluxOverlay({
  scene,
  rooms,
  results,
  mode,
  showValueLabels,
  toScreen,
}: {
  scene: ProjectSceneV2;
  rooms: RoomV2[];
  results: ResultsV2;
  mode: IsoluxMode;
  showValueLabels: boolean;
  toScreen: (x: number, y: number) => ScreenPt;
}) {
  const models = useMemo(() => {
    const out: { room: RoomV2; model: IsoluxModel }[] = [];
    for (const room of rooms) {
      const model = officialIsoluxModelForRoom(room, results.byRoomId[room.id], {
        mode,
        fixtures: scene.instances.filter((i) => i.roomId === room.id),
        targetLongSide: 800,
      });
      if (model) out.push({ room, model });
    }
    return out;
  }, [rooms, results, mode, scene.instances]);

  const fieldUrls = useMemo(() => {
    if (mode !== "falsecolor") return {} as Record<string, string>;
    const urls: Record<string, string> = {};
    for (const { room, model } of models) {
      const url = isoluxFieldPngDataUrl(model);
      if (url) urls[room.id] = url;
    }
    return urls;
  }, [models, mode]);

  if (models.length === 0) return null;

  return (
    <g data-plan-isolux-overlay="" pointerEvents="none">
      {models.map(({ room, model }) => {
        const toS = (px: { x: number; y: number }) => {
          const w = isoluxPxToWorld(model.world, px);
          return toScreen(w.x, w.y);
        };
        const fieldUrl = fieldUrls[room.id];
        const topLeft = toS({ x: 0, y: 0 });
        const topRight = toS({ x: model.width, y: 0 });
        const bottomLeft = toS({ x: 0, y: model.height });
        const imgW = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        const imgH = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
        const contourColor = mode === "falsecolor" ? "#3a2a12" : "#e8eef2";
        const labelFill = mode === "falsecolor" ? "#1a1a1a" : "#f5f7f8";
        const valueFill = mode === "falsecolor" ? "#1a3370" : "#dce8ff";
        const fontScreen = Math.max(8, Math.min(18, model.fontPx * (imgW / Math.max(model.width, 1))));

        return (
          <g key={room.id} data-plan-isolux-room={room.id}>
            {mode === "falsecolor" && fieldUrl && imgW > 0 && imgH > 0 && (
              <image
                href={fieldUrl}
                x={topLeft.x}
                y={topLeft.y}
                width={imgW}
                height={imgH}
                opacity={0.92}
                preserveAspectRatio="none"
              />
            )}
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
