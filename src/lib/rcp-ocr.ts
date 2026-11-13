import { createCanvas } from "@napi-rs/canvas";
import { createWorker, type Worker, PSM } from "tesseract.js";
import type { RcpDetectionProposal, Underlay } from "@luxsim/project-io";
import { initialMetersPerPixel } from "@luxsim/project-io";
import { normalizeFixtureCode } from "@/lib/fixture-code-map";
import { randomId } from "@/lib/random-id";

export type OcrWordBox = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type RcpDetectOptions = {
  confidenceMin?: number;
  underlay?: Underlay;
  underlayId?: string;
  /** Must stay false — cloud vision is blocked in F2.2. */
  allowCloud?: boolean;
};

export type RcpDetectResult = {
  proposals: RcpDetectionProposal[];
  warnings: string[];
};

const CLOUD_OPT_IN_ENV = "LUXSIM_ALLOW_CLOUD_RCP_VISION";

/** Fixture-like schedule token (deterministic, not fuzzy). */
export function looksLikeFixtureCode(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 16) return false;
  if (!/[A-Za-z]/.test(trimmed) || !/\d/.test(trimmed)) return false;
  const norm = normalizeFixtureCode(trimmed);
  return /^[A-Z]{1,6}\d{1,4}[A-Z]{0,2}$/.test(norm);
}

export function underlayPixelToWorldM(
  underlay: Pick<
    Underlay,
    "offsetX" | "offsetY" | "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit" | "flipX" | "flipY"
  >,
  px: number,
  py: number
): { x: number; y: number } | null {
  const w = underlay.sourceWidthPx;
  const h = underlay.sourceHeightPx;
  if (!(w && h && w > 0 && h > 0)) return null;
  const mpu = underlay.metersPerUnit > 0 ? underlay.metersPerUnit : 1;
  let ix = px;
  let iy = py;
  if (underlay.flipX) ix = w - px;
  if (underlay.flipY) iy = h - py;
  const x = underlay.offsetX + ix * mpu;
  const y = underlay.offsetY + (h - iy) * mpu;
  return { x, y };
}

export function isLikelyUnscaledUnderlay(
  underlay: Pick<Underlay, "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit">
): boolean {
  const w = underlay.sourceWidthPx;
  const h = underlay.sourceHeightPx;
  if (!(w && h && w > 0 && h > 0)) return true;
  const expected = initialMetersPerPixel(w, h);
  const ratio = underlay.metersPerUnit / expected;
  return ratio > 0.98 && ratio < 1.02;
}

function bboxCenter(b: { x0: number; y0: number; x1: number; y1: number }) {
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

function bboxDistance(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number }
) {
  const ca = bboxCenter(a);
  const cb = bboxCenter(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

/** Dedupe by codeNorm; keep highest confidence; collapse near-duplicates. */
export function dedupeRcpProposals(
  items: RcpDetectionProposal[],
  minCenterPx = 28
): RcpDetectionProposal[] {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
  const kept: RcpDetectionProposal[] = [];
  for (const p of sorted) {
    const norm = p.codeNorm ?? normalizeFixtureCode(p.codeRaw);
    const dup = kept.some((k) => {
      const kNorm = k.codeNorm ?? normalizeFixtureCode(k.codeRaw);
      if (kNorm !== norm) return false;
      if (p.bboxPx && k.bboxPx) {
        return bboxDistance(p.bboxPx, k.bboxPx) < minCenterPx;
      }
      return true;
    });
    if (!dup) kept.push(p);
  }
  return kept;
}

export function proposalsFromOcrWords(
  words: OcrWordBox[],
  options: RcpDetectOptions = {}
): RcpDetectResult {
  const confidenceMin = options.confidenceMin ?? 0.45;
  const warnings: string[] = [];
  const raw: RcpDetectionProposal[] = [];

  for (const w of words) {
    const text = w.text.trim();
    if (!text || !looksLikeFixtureCode(text)) continue;
    const conf = w.confidence > 1 ? w.confidence / 100 : w.confidence;
    if (conf < confidenceMin) continue;
    const codeNorm = normalizeFixtureCode(text);
    const pointPx = bboxCenter(w.bbox);
    let pointM: { x: number; y: number } | undefined;
    if (options.underlay) {
      const m = underlayPixelToWorldM(options.underlay, pointPx.x, pointPx.y);
      if (m) pointM = m;
    }
    raw.push({
      id: `rcp_${randomId().slice(0, 8)}`,
      underlayId: options.underlayId,
      codeRaw: text,
      codeNorm,
      bboxPx: w.bbox,
      pointPx,
      pointM,
      confidence: conf,
      status: "pending",
    });
  }

  const proposals = dedupeRcpProposals(raw);
  if (!proposals.length) {
    warnings.push(
      "No fixture codes detected — try higher DPI raster, stronger contrast, or calibrate scale first."
    );
  }
  if (options.underlay && isLikelyUnscaledUnderlay(options.underlay)) {
    warnings.unshift("Underlay looks unscaled — positions are approximate until you calibrate.");
  }
  return { proposals, warnings };
}

let workerPromise: Promise<Worker> | null = null;

async function getLocalOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function ocrWordsFromImageBuffer(
  image: Buffer,
  options?: { upscale?: number }
): Promise<OcrWordBox[]> {
  const upscale = options?.upscale ?? 2;
  const scaled = await upscaleImageForOcr(image, upscale);
  const inv = upscale > 1 ? 1 / upscale : 1;
  const worker = await getLocalOcrWorker();
  const { data } = await worker.recognize(scaled);
  const words = wordsFromOcrPage(data).map((w) => ({
    ...w,
    bbox: scaleBbox(w.bbox, inv),
  }));
  return words;
}

export async function detectRcpFromImageBuffer(
  image: Buffer,
  options: RcpDetectOptions = {}
): Promise<RcpDetectResult> {
  if (options.allowCloud) {
    if (process.env[CLOUD_OPT_IN_ENV] !== "true") {
      throw new Error("Cloud vision is disabled — local OCR only (privacy mode).");
    }
    throw new Error("Cloud RCP vision is not implemented.");
  }
  const words = await ocrWordsFromImageBuffer(image);
  return proposalsFromOcrWords(words, options);
}

/** Synthetic plan raster for tests (known code positions). */
export function buildSyntheticRcpTestPng(codes: { text: string; x: number; y: number }[]): Buffer {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 48px sans-serif";
  for (const c of codes) {
    ctx.fillText(c.text, c.x, c.y);
  }
  return canvas.toBuffer("image/png");
}

async function upscaleImageForOcr(image: Buffer, factor: number): Promise<Buffer> {
  if (factor <= 1) return image;
  const { loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(image);
  const canvas = createCanvas(Math.ceil(img.width * factor), Math.ceil(img.height * factor));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toBuffer("image/png");
}

function scaleBbox(
  b: { x0: number; y0: number; x1: number; y1: number },
  factor: number
) {
  return { x0: b.x0 * factor, y0: b.y0 * factor, x1: b.x1 * factor, y1: b.y1 * factor };
}

const CODE_IN_TEXT_RE = /\b([A-Z]{1,4}[-_\s]?\d{1,3}[A-Z]?)\b/gi;

function codesFromLineText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(CODE_IN_TEXT_RE)) {
    const raw = m[1]?.replace(/\s+/g, "-");
    if (raw && looksLikeFixtureCode(raw)) out.push(raw);
  }
  return out;
}

export function wordsFromOcrPage(data: import("tesseract.js").Page): OcrWordBox[] {
  const words: OcrWordBox[] = [];
  const seen = new Set<string>();

  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const code of codesFromLineText(line.text ?? "")) {
          const key = `${code}:${line.bbox.x0}:${line.bbox.y0}`;
          if (seen.has(key)) continue;
          seen.add(key);
          words.push({
            text: code,
            confidence: line.confidence ?? 0,
            bbox: line.bbox,
          });
        }
        for (const w of line.words ?? []) {
          const bbox = w.bbox;
          if (!bbox || !w.text?.trim()) continue;
          const cleaned = w.text.trim().replace(/\s+/g, "-");
          if (!looksLikeFixtureCode(cleaned)) continue;
          words.push({
            text: cleaned,
            confidence: w.confidence ?? 0,
            bbox: { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 },
          });
        }
      }
    }
  }
  return words;
}
