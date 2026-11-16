/**
 * Official isolux / value-chart figures for the editor plan and Full PDF.
 * Built from `buildIsoluxModel` — no new colour scale, contour algorithm,
 * or photometric quantity. Rooms without calculation results are skipped
 * and never invent numbers.
 */

import type { CalcResults } from "../../solver/src/types";
import type { FixtureInstance, ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import {
  buildIsoluxModel,
  type FalseColorScale,
  type IsoluxMode,
  type IsoluxModel,
  type IsoluxPalette,
} from "./isolux-map";

export function hasCalcGrid(results?: CalcResults | null): results is CalcResults {
  const grid = results?.grid;
  return Boolean(grid?.lux?.length && grid.nx >= 1 && grid.ny >= 1);
}

export type OfficialIsoluxRenderOpts = {
  mode: IsoluxMode;
  showValueLabels: boolean;
  includeLegend?: boolean;
  background?: string;
};

const DEFAULT_RENDER: OfficialIsoluxRenderOpts = {
  mode: "isolines",
  showValueLabels: true,
  includeLegend: false,
  background: "#ffffff",
};

/** Official Full PDF isolux diagram: isolines, contour labels, and value labels. */
export const OFFICIAL_PDF_ISOLUX_RENDER: OfficialIsoluxRenderOpts = {
  ...DEFAULT_RENDER,
};

/** Thin display inset so adjacent rooms stay visually separate. Calculation wall zone is unchanged. */
export const ISOLUX_DISPLAY_WALL_ZONE_M = 0.05;

export function officialIsoluxModelForRoom(
  room: RoomV2,
  results: CalcResults | null | undefined,
  opts?: {
    mode?: IsoluxMode;
    fixtures?: FixtureInstance[];
    targetLongSide?: number;
    colorScale?: FalseColorScale;
    includeContours?: boolean;
    includeValueLabels?: boolean;
    palette?: IsoluxPalette;
  }
): IsoluxModel | null {
  if (!hasCalcGrid(results)) return null;
  return buildIsoluxModel(room, results, {
    mode: opts?.mode ?? "isolines",
    wallZoneM: ISOLUX_DISPLAY_WALL_ZONE_M,
    fixtures: opts?.fixtures,
    targetLongSide: opts?.targetLongSide,
    colorScale: opts?.colorScale,
    includeContours: opts?.includeContours,
    includeValueLabels: opts?.includeValueLabels,
    palette: opts?.palette,
  });
}

export function officialIsoluxModelsByRoom(
  scene: ProjectSceneV2,
  results: ResultsV2,
  opts?: { mode?: IsoluxMode; targetLongSide?: number }
): Record<string, IsoluxModel> {
  const out: Record<string, IsoluxModel> = {};
  for (const room of scene.rooms) {
    const model = officialIsoluxModelForRoom(room, results.byRoomId[room.id], {
      mode: opts?.mode,
      fixtures: scene.instances.filter((i) => i.roomId === room.id),
      targetLongSide: opts?.targetLongSide,
    });
    if (model) out[room.id] = model;
  }
  return out;
}

type IsoluxCanvas = {
  width: number;
  height: number;
  getContext: (id: "2d") => CanvasRenderingContext2D | null;
  toDataURL: (type?: string, quality?: number) => string;
};

function browserCanvas(width: number, height: number): IsoluxCanvas | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  line: { x: number; y: number }[],
  stroke: string,
  width: number
) {
  if (line.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(line[0]!.x, line[0]!.y);
  for (let i = 1; i < line.length; i += 1) {
    ctx.lineTo(line[i]!.x, line[i]!.y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function paintLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fontPx: number,
  fill: string,
  baseline: CanvasTextBaseline = "middle"
) {
  ctx.font = `${fontPx}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = baseline;
  ctx.lineWidth = Math.max(3, fontPx / 4);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Rasterise an IsoluxModel to a PNG data URL. Browser-only by default
 * (`document` canvas). Tests may pass `createCanvas`. Returns null when
 * no canvas is available — callers must not invent a substitute image.
 */
export function renderIsoluxModelPngDataUrl(
  model: IsoluxModel,
  opts: OfficialIsoluxRenderOpts = DEFAULT_RENDER,
  createCanvas: (width: number, height: number) => IsoluxCanvas | null = browserCanvas
): string | null {
  const includeLegend = opts.includeLegend ?? opts.mode === "falsecolor";
  const legendH = includeLegend && model.legendStops.length >= 2 ? 38 : 0;
  const width = model.width;
  const height = model.height + legendH;
  const canvas = createCanvas(width, height);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = opts.background ?? "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (opts.mode === "falsecolor") {
    const image = ctx.createImageData(model.width, model.height);
    image.data.set(model.field);
    ctx.putImageData(image, 0, 0);
  }

  const contourColor = opts.mode === "falsecolor" ? "#3a2a12" : "#222222";
  for (const contour of model.contours) {
    for (const line of contour.polylines) {
      drawPolyline(ctx, line, contourColor, 1.1);
    }
  }

  if (model.workplaneOutline.length >= 3) {
    drawPolyline(ctx, [...model.workplaneOutline, model.workplaneOutline[0]!], "#c0007a", 1.4);
  }
  if (model.roomOutline.length >= 3) {
    drawPolyline(ctx, [...model.roomOutline, model.roomOutline[0]!], "#222222", 1.8);
  }

  if (opts.showValueLabels) {
    const fs = Math.max(10, model.fontPx - 4);
    for (const label of model.valueLabels) {
      paintLabel(ctx, label.x, label.y - 6, label.text, fs, "#2a4a8a", "alphabetic");
    }
  }

  for (const label of model.contourLabels) {
    paintLabel(ctx, label.x, label.y, label.text, model.fontPx, "#222222", "middle");
  }

  for (const f of model.fixtures) {
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(f.x - 4, f.y - 4, 8, 8);
  }

  if (legendH && model.legendStops.length >= 2) {
    const stops = model.legendStops;
    const y0 = model.height + 10;
    const barH = 14;
    const barW = Math.min(width * 0.62, 28 * stops.length + 40);
    const x0 = 8;
    const cell = barW / stops.length;
    for (let i = 0; i < stops.length; i += 1) {
      ctx.fillStyle = stops[i]!.color;
      ctx.fillRect(x0 + i * cell, y0, cell, barH);
    }
    ctx.strokeStyle = "#bbbbbb";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x0, y0, barW, barH);
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#333333";
    for (let i = 0; i < stops.length; i += 1) {
      const tx = x0 + (i + 0.5) * cell;
      const last = i === stops.length - 1;
      ctx.fillText(last ? `${stops[i]!.lux} [lx]` : String(stops[i]!.lux), tx, y0 + barH + 13);
    }
  }

  return canvas.toDataURL("image/png");
}

export function isoluxFieldPngDataUrl(
  model: IsoluxModel,
  createCanvas: (width: number, height: number) => IsoluxCanvas | null = browserCanvas
): string | null {
  const canvas = createCanvas(model.width, model.height);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(model.width, model.height);
  image.data.set(model.field);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Per-room isolux PNG data URLs for the official Full PDF path.
 * Independent of WebGL / 3D capture. Rooms without results are omitted.
 */
export function collectOfficialIsoluxSnapshots(
  scene: ProjectSceneV2,
  results: ResultsV2,
  render: (
    model: IsoluxModel,
    opts: OfficialIsoluxRenderOpts
  ) => string | null = (model, opts) => renderIsoluxModelPngDataUrl(model, opts)
): Record<string, string> {
  const out: Record<string, string> = {};
  const models = officialIsoluxModelsByRoom(scene, results, { mode: "isolines" });
  for (const [roomId, model] of Object.entries(models)) {
    const url = render(model, OFFICIAL_PDF_ISOLUX_RENDER);
    if (url) out[roomId] = url;
  }
  return out;
}
