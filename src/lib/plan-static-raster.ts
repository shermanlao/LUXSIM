/** Viewport raster of static plan CAD, underlay, false colour, and isolines. */

import type { IsoluxModel } from "@luxsim/project-io";
import { isoluxFieldScreenRect, isoluxPxToWorld } from "@luxsim/project-io";
import { PLAN_SNAPSHOT_DPR_CAP, sizePlanCanvas } from "@/lib/plan-nav-snapshot";

export const PLAN_DXF_STROKE = "#6a8a9a";
export const PLAN_DXF_STROKE_WIDTH = 1;

export type PlanWorldPoint = { x: number; y: number };

export type PlanStaticUnderlay = {
  image: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  flipImageX?: boolean;
  flipImageY?: boolean;
  opacity?: number;
};

const fieldCanvasCache = new WeakMap<IsoluxModel, HTMLCanvasElement>();

function canvasForFalseColorField(model: IsoluxModel): HTMLCanvasElement | null {
  const cached = fieldCanvasCache.get(model);
  if (cached) return cached;
  if (model.field.length < model.width * model.height * 4) return null;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = model.width;
  canvas.height = model.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = new ImageData(model.width, model.height);
  image.data.set(model.field);
  ctx.putImageData(image, 0, 0);
  fieldCanvasCache.set(model, canvas);
  return canvas;
}

function polylineHitsView(
  pts: ReadonlyArray<PlanWorldPoint>,
  toScreen: (x: number, y: number) => PlanWorldPoint,
  viewW: number,
  viewH: number,
  pad: number
): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const s = toScreen(p.x, p.y);
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  return maxX >= -pad && minX <= viewW + pad && maxY >= -pad && minY <= viewH + pad;
}

function paintLabels(
  ctx: CanvasRenderingContext2D,
  labels: ReadonlyArray<{ x: number; y: number; text: string }>,
  toS: (p: { x: number; y: number }) => PlanWorldPoint,
  fontPx: number,
  fill: string,
  yOffset = 0
) {
  ctx.font = `${fontPx}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0a1218";
  ctx.fillStyle = fill;
  ctx.lineJoin = "round";
  for (const label of labels) {
    const p = toS(label);
    ctx.strokeText(label.text, p.x, p.y + yOffset);
    ctx.fillText(label.text, p.x, p.y + yOffset);
  }
}

/**
 * Paint the static plan into a viewport-sized canvas. Callers must keep this
 * content out of the live SVG tree.
 */
export function paintStaticPlanLayer(
  canvas: HTMLCanvasElement,
  input: {
    cssWidth: number;
    cssHeight: number;
    viewW: number;
    viewH: number;
    background?: string;
    underlay?: PlanStaticUnderlay | null;
    polylines: ReadonlyArray<ReadonlyArray<PlanWorldPoint>>;
    toScreen: (x: number, y: number) => PlanWorldPoint;
    falseColor?: ReadonlyArray<IsoluxModel>;
    falseColorOpacity?: number;
    showIsolines?: boolean;
    showValueLabels?: boolean;
    showFalseColor?: boolean;
    roomFills?: ReadonlyArray<{
      polygon: ReadonlyArray<PlanWorldPoint>;
      fill: string;
    }>;
    stroke?: string;
    strokeWidth?: number;
  }
): boolean {
  const sized = sizePlanCanvas(canvas, input.cssWidth, input.cssHeight);
  if (!sized) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { pixelW, pixelH } = sized;
  const { viewW, viewH } = input;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelW, pixelH);
  ctx.fillStyle = input.background || "#0f1c24";
  ctx.fillRect(0, 0, pixelW, pixelH);
  if (!(viewW > 0) || !(viewH > 0)) return true;

  ctx.setTransform(pixelW / viewW, 0, 0, pixelH / viewH, 0, 0);

  const underlay = input.underlay;
  if (underlay && underlay.width > 0 && underlay.height > 0) {
    const fx = underlay.flipImageX ? -1 : 1;
    const fy = underlay.flipImageY ? -1 : 1;
    const tx = underlay.x + (fx === -1 ? underlay.width : 0);
    const ty = underlay.y + (fy === -1 ? underlay.height : 0);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(fx, fy);
    const opacity = underlay.opacity;
    if (opacity != null && Number.isFinite(opacity)) {
      ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
    }
    try {
      ctx.drawImage(underlay.image, 0, 0, underlay.width, underlay.height);
    } catch {
      /* tainted or not yet decodable */
    }
    ctx.restore();
  }

  const path = new Path2D();
  let any = false;
  for (const pts of input.polylines) {
    if (pts.length < 2) continue;
    if (!polylineHitsView(pts, input.toScreen, viewW, viewH, 8)) continue;
    const first = input.toScreen(pts[0]!.x, pts[0]!.y);
    path.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i += 1) {
      const p = input.toScreen(pts[i]!.x, pts[i]!.y);
      path.lineTo(p.x, p.y);
    }
    any = true;
  }
  if (any) {
    ctx.strokeStyle = input.stroke ?? PLAN_DXF_STROKE;
    ctx.lineWidth = input.strokeWidth ?? PLAN_DXF_STROKE_WIDTH;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.miterLimit = 10;
    ctx.stroke(path);
  }

  const rooms = input.roomFills;
  if (rooms) {
    for (const room of rooms) {
      if (room.polygon.length < 3) continue;
      const first = input.toScreen(room.polygon[0]!.x, room.polygon[0]!.y);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < room.polygon.length; i += 1) {
        const s = input.toScreen(room.polygon[i]!.x, room.polygon[i]!.y);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fillStyle = room.fill;
      ctx.fill();
    }
  }

  const fields = input.falseColor;
  if (input.showFalseColor !== false && fields && fields.length) {
    const opacity = input.falseColorOpacity ?? 0.92;
    for (const model of fields) {
      const source = canvasForFalseColorField(model);
      const rect = isoluxFieldScreenRect(model.world, model.width, model.height, input.toScreen);
      if (!source || !rect) continue;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
      try {
        ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
      } catch {
        /* tainted or not yet decodable */
      }
      ctx.restore();
    }
  }

  if (fields && (input.showIsolines || input.showValueLabels)) {
    for (const model of fields) {
      const toS = (px: { x: number; y: number }) => {
        const w = isoluxPxToWorld(model.world, px);
        return input.toScreen(w.x, w.y);
      };
      const topLeft = toS({ x: 0, y: 0 });
      const topRight = toS({ x: model.width, y: 0 });
      const imgW = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
      const fontScreen = Math.max(8, Math.min(18, model.fontPx * (imgW / Math.max(model.width, 1))));
      const showFc = input.showFalseColor !== false;
      const contourColor = showFc ? "#3a2a12" : "#e8eef2";
      const labelFill = showFc ? "#1a1a1a" : "#f5f7f8";
      const valueFill = showFc ? "#1a3370" : "#dce8ff";
      if (input.showIsolines) {
        ctx.beginPath();
        let anyLine = false;
        for (const c of model.contours) {
          for (const line of c.polylines) {
            if (line.length < 2) continue;
            const first = toS(line[0]!);
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < line.length; i += 1) {
              const p = toS(line[i]!);
              ctx.lineTo(p.x, p.y);
            }
            anyLine = true;
          }
        }
        if (anyLine) {
          ctx.strokeStyle = contourColor;
          ctx.lineWidth = 1.2;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.stroke();
        }
        paintLabels(ctx, model.contourLabels, toS, fontScreen, labelFill);
      }
      if (input.showValueLabels) {
        paintLabels(ctx, model.valueLabels, toS, Math.max(7, fontScreen - 2), valueFill, -1);
      }
    }
  }

  return true;
}

export { PLAN_SNAPSHOT_DPR_CAP };
