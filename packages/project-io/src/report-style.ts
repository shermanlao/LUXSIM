/** Official Full PDF typography and colour — one typeface, fixed sizes per role. */

import type { jsPDF } from "jspdf";

export const REPORT_FONT = "SourceSans3";
export const REPORT_FONT_FILE_REGULAR = "SourceSans3-Regular.ttf";
export const REPORT_FONT_FILE_BOLD = "SourceSans3-Bold.ttf";

/** Point sizes. Same role always uses the same size across the report. */
export const TYPE = {
  coverKicker: 10,
  coverTitle: 22,
  coverProject: 18,
  section: 16,
  subhead: 12,
  body: 10,
  table: 8,
  caption: 8,
  headerMeta: 8,
  footer: 8,
} as const;

export const INK = { r: 18, g: 32, b: 42 };
export const ACCENT = { r: 196, g: 92, b: 38 };
export const ACCENT2 = { r: 31, g: 111, b: 139 };
export const MUTED = { r: 90, g: 104, b: 112 };
export const RULE = { r: 190, g: 200, b: 206 };
export const TABLE_HEAD = { r: 226, g: 236, b: 240 };
export const TABLE_ALT = { r: 247, g: 250, b: 251 };
export const HEADER_LINE = { r: 196, g: 92, b: 38 };

export type ReportFontBinaries = { regular: string; bold: string };

let cached: ReportFontBinaries | null = null;

function bytesToVfs(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return s;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readFontPairFromDisk(): ReportFontBinaries | null {
  if (isBrowser()) return null;
  try {
    // Loaded only in Node (tests / sync PDF). Avoid a static import so the
    // editor bundle does not pull in `fs`.
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const dirs: string[] = [];
    if (typeof __dirname !== "undefined") {
      dirs.push(path.resolve(__dirname, "../fonts"));
    }
    try {
      dirs.push(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../fonts"));
    } catch {
      /* import.meta may be unavailable */
    }
    if (typeof process !== "undefined" && process.cwd) {
      dirs.push(path.resolve(process.cwd(), "packages/project-io/fonts"));
      dirs.push(path.resolve(process.cwd(), "public/fonts"));
    }
    for (const dir of dirs) {
      const regularPath = path.join(dir, REPORT_FONT_FILE_REGULAR);
      const boldPath = path.join(dir, REPORT_FONT_FILE_BOLD);
      if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) continue;
      return {
        regular: bytesToVfs(new Uint8Array(fs.readFileSync(regularPath))),
        bold: bytesToVfs(new Uint8Array(fs.readFileSync(boldPath))),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Node / tests: load Source Sans 3 from the repo fonts folder. */
export function loadReportFontsSync(): ReportFontBinaries | null {
  if (cached) return cached;
  const fromDisk = readFontPairFromDisk();
  if (fromDisk) cached = fromDisk;
  return cached;
}

/** Browser export fetches /fonts; Node falls back to the repo copies. */
export async function loadReportFonts(): Promise<ReportFontBinaries | null> {
  if (cached) return cached;
  if (isBrowser() && typeof fetch === "function") {
    try {
      const [regularRes, boldRes] = await Promise.all([
        fetch(`/fonts/${REPORT_FONT_FILE_REGULAR}`),
        fetch(`/fonts/${REPORT_FONT_FILE_BOLD}`),
      ]);
      if (regularRes.ok && boldRes.ok) {
        cached = {
          regular: bytesToVfs(new Uint8Array(await regularRes.arrayBuffer())),
          bold: bytesToVfs(new Uint8Array(await boldRes.arrayBuffer())),
        };
        return cached;
      }
    } catch {
      /* fall through */
    }
  }
  return loadReportFontsSync();
}

export function registerReportFonts(doc: jsPDF, fonts: ReportFontBinaries | null): boolean {
  if (!fonts) {
    doc.setFont("helvetica", "normal");
    return false;
  }
  try {
    doc.addFileToVFS(REPORT_FONT_FILE_REGULAR, fonts.regular);
    doc.addFont(REPORT_FONT_FILE_REGULAR, REPORT_FONT, "normal");
    doc.addFileToVFS(REPORT_FONT_FILE_BOLD, fonts.bold);
    doc.addFont(REPORT_FONT_FILE_BOLD, REPORT_FONT, "bold");
    doc.setFont(REPORT_FONT, "normal");
    return true;
  } catch {
    doc.setFont("helvetica", "normal");
    return false;
  }
}

export function reportFontFamily(registered: boolean): string {
  return registered ? REPORT_FONT : "helvetica";
}

export function setReportRgb(
  doc: jsPDF,
  which: "text" | "draw" | "fill",
  color: { r: number; g: number; b: number }
) {
  if (which === "text") doc.setTextColor(color.r, color.g, color.b);
  else if (which === "draw") doc.setDrawColor(color.r, color.g, color.b);
  else doc.setFillColor(color.r, color.g, color.b);
}
