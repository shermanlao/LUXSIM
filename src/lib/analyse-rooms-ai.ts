import { createCanvas } from "@napi-rs/canvas";
import type { OfficialRoomAnalysisSummary, Vec2 } from "@luxsim/project-io";
import { officialFilterFromPlanRoomRings } from "@luxsim/project-io";
import { loadRoomAnalysisAiSkill } from "@/lib/ai-room-analysis-skill";
import {
  roomAnalysisAiBaseUrl,
  type ResolvedRoomAnalysisAiConfig,
} from "@/lib/room-analysis-ai-settings";

export type AnalyseRoomsAiResult = {
  configured: boolean;
  failed: boolean;
  rooms: Vec2[][];
};

const IMAGE_MAX_EDGE = 1600;
const REQUEST_TIMEOUT_MS = 60_000;

function renderPlanPng(summary: OfficialRoomAnalysisSummary): {
  buffer: Buffer;
  width: number;
  height: number;
} | null {
  const bounds = summary.bounds;
  if (!bounds) return null;
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  if (!(worldW > 0 && worldH > 0)) return null;
  const scale = IMAGE_MAX_EDGE / Math.max(worldW, worldH);
  const width = Math.max(32, Math.round(worldW * scale));
  const height = Math.max(32, Math.round(worldH * scale));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const toX = (x: number) => ((x - bounds.minX) / worldW) * (width - 1);
  const toY = (y: number) => ((bounds.maxY - y) / worldH) * (height - 1);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [a, b] of summary.linework) {
    ctx.moveTo(toX(a.x), toY(a.y));
    ctx.lineTo(toX(b.x), toY(b.y));
  }
  ctx.stroke();
  if (summary.contour && summary.contour.length >= 3) {
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const first = summary.contour[0]!;
    ctx.moveTo(toX(first.x), toY(first.y));
    for (let i = 1; i < summary.contour.length; i++) {
      const p = summary.contour[i]!;
      ctx.lineTo(toX(p.x), toY(p.y));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return { buffer: canvas.toBuffer("image/png"), width, height };
}

function compactSummary(summary: OfficialRoomAnalysisSummary) {
  return {
    layers: summary.layers,
    bounds: summary.bounds,
    contour: summary.contour,
    candidateRings: summary.candidateRings,
    units: "official scene metres; X right, Y up",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1]! : trimmed).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error("invalid json");
  }
}

function asPoint(value: unknown): Vec2 | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as { x?: unknown; y?: unknown };
  const x = typeof rec.x === "number" ? rec.x : Number(rec.x);
  const y = typeof rec.y === "number" ? rec.y : Number(rec.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function parseRoomPolygons(payload: unknown): Vec2[][] {
  if (!payload || typeof payload !== "object") return [];
  const rooms = (payload as { rooms?: unknown }).rooms;
  if (!Array.isArray(rooms)) return [];
  const out: Vec2[][] = [];
  for (const item of rooms) {
    const raw =
      item && typeof item === "object"
        ? (item as { polygon?: unknown; points?: unknown }).polygon ??
          (item as { points?: unknown }).points
        : item;
    if (!Array.isArray(raw)) continue;
    const ring: Vec2[] = [];
    for (const pt of raw) {
      const p = asPoint(pt);
      if (!p) {
        ring.length = 0;
        break;
      }
      ring.push(p);
    }
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}

function looksLikePixelRing(
  ring: Vec2[],
  image: { width: number; height: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  const inImage = ring.every(
    (p) => p.x >= -1 && p.y >= -1 && p.x <= image.width + 1 && p.y <= image.height + 1
  );
  if (!inImage) return false;
  const padX = (bounds.maxX - bounds.minX) * 0.15;
  const padY = (bounds.maxY - bounds.minY) * 0.15;
  const inWorld = ring.every(
    (p) =>
      p.x >= bounds.minX - padX &&
      p.x <= bounds.maxX + padX &&
      p.y >= bounds.minY - padY &&
      p.y <= bounds.maxY + padY
  );
  return !inWorld;
}

function mapRingFromPixels(
  ring: Vec2[],
  image: { width: number; height: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): Vec2[] {
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const denomX = Math.max(image.width - 1, 1);
  const denomY = Math.max(image.height - 1, 1);
  return ring.map((p) => ({
    x: bounds.minX + (p.x / denomX) * worldW,
    y: bounds.maxY - (p.y / denomY) * worldH,
  }));
}

export function mapAnalysedRoomRingsToMetres(
  rings: Vec2[][],
  summary: OfficialRoomAnalysisSummary,
  image: { width: number; height: number } | null
): Vec2[][] {
  const bounds = summary.bounds;
  if (!bounds || !image) return rings;
  return rings.map((ring) =>
    looksLikePixelRing(ring, image, bounds) ? mapRingFromPixels(ring, image, bounds) : ring
  );
}

export async function analyseRoomsWithConfiguredAi(
  config: ResolvedRoomAnalysisAiConfig,
  summary: OfficialRoomAnalysisSummary,
  outline?: Vec2[] | null
): Promise<AnalyseRoomsAiResult> {
  if (!config.configured || !config.apiKey) {
    return { configured: false, failed: false, rooms: [] };
  }

  const skill = loadRoomAnalysisAiSkill();
  const rendered = renderPlanPng({
    ...summary,
    contour: outline ?? summary.contour,
  });
  const userText = [
    "Identify official room polygons on this plan.",
    "Return JSON only, using official scene metres matching the bounds and contour below.",
    JSON.stringify(compactSummary({ ...summary, contour: outline ?? summary.contour })),
  ].join("\n\n");

  const userContent: unknown[] = [{ type: "text", text: userText }];
  if (rendered) {
    userContent.unshift({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${rendered.buffer.toString("base64")}`,
        detail: "high",
      },
    });
  }

  const url = `${roomAnalysisAiBaseUrl(config.provider)}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: skill },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { configured: true, failed: true, rooms: [] };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    if (!text.trim()) return { configured: true, failed: true, rooms: [] };
    const parsed = parseRoomPolygons(extractJsonObject(text));
    const mapped = mapAnalysedRoomRingsToMetres(parsed, summary, rendered);
    const rooms = officialFilterFromPlanRoomRings(mapped, outline ?? summary.contour);
    return { configured: true, failed: false, rooms };
  } catch {
    return { configured: true, failed: true, rooms: [] };
  } finally {
    clearTimeout(timer);
  }
}
