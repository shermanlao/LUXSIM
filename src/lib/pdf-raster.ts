import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  workerConfigured = true;
}

export class PdfEncryptedError extends Error {
  constructor(message = "PDF is password-protected or encrypted") {
    super(message);
    this.name = "PdfEncryptedError";
  }
}

export class PdfInvalidError extends Error {
  constructor(message = "Could not read PDF") {
    super(message);
    this.name = "PdfInvalidError";
  }
}

export type PdfRasterResult = {
  png: Buffer;
  widthPx: number;
  heightPx: number;
  rasterDpi: number;
  pageCount: number;
  pageIndex: number;
  warnings: string[];
};

/** Pick raster DPI so the page fits within maxPixelDim (deterministic). */
export function resolveRasterDpi(
  pageWidthPt: number,
  pageHeightPt: number,
  preferredDpi: number,
  maxPixelDim: number,
  warnings: string[] = []
): number {
  const dpi = Math.max(36, Math.min(300, preferredDpi));
  const pxW = (pageWidthPt * dpi) / 72;
  const pxH = (pageHeightPt * dpi) / 72;
  const maxPx = Math.max(pxW, pxH);
  if (maxPx <= maxPixelDim) return dpi;
  const scaled = Math.floor((dpi * maxPixelDim) / maxPx);
  const next = Math.max(36, scaled);
  warnings.push(
    `Large PDF page — raster DPI lowered to ${next} (max dimension ${maxPixelDim}px)`
  );
  return next;
}

function mapPdfLoadError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  if (/password/i.test(msg) || name.includes("Password")) {
    throw new PdfEncryptedError();
  }
  throw new PdfInvalidError(msg || undefined);
}

export async function rasterizePdfPage(
  pdfBuffer: Buffer,
  pageIndex = 0,
  options?: { preferredDpi?: number; maxPixelDim?: number }
): Promise<PdfRasterResult> {
  ensurePdfWorker();
  const preferredDpi = options?.preferredDpi ?? 150;
  const maxPixelDim = options?.maxPixelDim ?? 4096;
  const warnings: string[] = [];

  let pdf;
  try {
    const task = getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    pdf = await task.promise;
  } catch (e) {
    mapPdfLoadError(e);
  }

  const pageCount = pdf.numPages;
  if (pageIndex < 0 || pageIndex >= pageCount) {
    throw new PdfInvalidError(`Page index ${pageIndex} out of range (0–${pageCount - 1})`);
  }

  const page = await pdf.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const rasterDpi = resolveRasterDpi(
    baseViewport.width,
    baseViewport.height,
    preferredDpi,
    maxPixelDim,
    warnings
  );
  const scale = rasterDpi / 72;
  const viewport = page.getViewport({ scale });

  const widthPx = Math.ceil(viewport.width);
  const heightPx = Math.ceil(viewport.height);
  const canvas = createCanvas(widthPx, heightPx);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfInvalidError("Canvas context unavailable");

  try {
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;
  } catch (e) {
    mapPdfLoadError(e);
  }

  const png = canvas.toBuffer("image/png");
  return {
    png,
    widthPx,
    heightPx,
    rasterDpi,
    pageCount,
    pageIndex,
    warnings,
  };
}

export async function readPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  ensurePdfWorker();
  try {
    const pdf = await getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    }).promise;
    return pdf.numPages;
  } catch (e) {
    mapPdfLoadError(e);
  }
}
