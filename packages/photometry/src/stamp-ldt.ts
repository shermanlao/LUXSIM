import type { PhotometricFamily } from "./beam-keys";
import { parseFirstNumber } from "./beam-keys";
import { parseEulumdat, writeEulumdat, type EulumdatDocument } from "./eulumdat";
import { formatFixtureSizeMm, parseFixtureSizeMm, type FixtureSizeMm } from "./fixture-size";
import { LINEAR_SAMPLE_SIZE_MM } from "./synthesize-cone";

export type LibraryConeStamp = {
  name?: string | null;
  catalogNumber?: string | null;
  lumens: number;
  watts?: number | null;
  cctK?: number | null;
  cri?: number | null;
  size?: string | FixtureSizeMm | null;
};

export type LibraryConeStampPreview = {
  lumens: number;
  watts: number | null;
  cct: string | null;
  cri: string | null;
  sizeLabel: string | null;
  sizeApplied: boolean;
  downloadName: string;
};

function linearSampleSizeLabel(): string {
  return `L${LINEAR_SAMPLE_SIZE_MM.length} × W${LINEAR_SAMPLE_SIZE_MM.width} × H${LINEAR_SAMPLE_SIZE_MM.height} mm (linear sample)`;
}

function specToken(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return parseFirstNumber(value) != null
    ? String(parseFirstNumber(value))
    : String(value).trim() || null;
}

function sanitizeFileBase(input: string): string {
  return input.replace(/[\\/:*?"<>|]+/g, "-").trim() || "library-cone";
}

export function libraryConeDownloadName(stamp: Pick<LibraryConeStamp, "name" | "catalogNumber">): string {
  const base = sanitizeFileBase(stamp.catalogNumber || stamp.name || "library-cone");
  return `${base}.ldt`;
}

function resolveSize(
  stamp: LibraryConeStamp,
  family: PhotometricFamily
): { size: FixtureSizeMm | null; useProductSize: boolean } {
  const raw = stamp.size;
  const size =
    raw && typeof raw === "object"
      ? raw
      : parseFixtureSizeMm(typeof raw === "string" ? raw : null);
  const useProductSize = size != null && (family !== "linear" || (!size.circular && size.width > 0));
  return { size, useProductSize };
}

export function previewLibraryConeStamp(
  stamp: LibraryConeStamp,
  family: PhotometricFamily = "circular"
): LibraryConeStampPreview {
  if (!Number.isFinite(stamp.lumens) || stamp.lumens <= 0) {
    throw new Error("Lumen output is required to generate an LDT file");
  }
  const { size, useProductSize } = resolveSize(stamp, family);
  const watts =
    stamp.watts != null && Number.isFinite(stamp.watts) && stamp.watts >= 0 ? stamp.watts : null;
  return {
    lumens: stamp.lumens,
    watts,
    cct: specToken(stamp.cctK),
    cri: specToken(stamp.cri),
    sizeLabel:
      useProductSize && size
        ? formatFixtureSizeMm(size)
        : family === "linear"
          ? linearSampleSizeLabel()
          : null,
    sizeApplied: useProductSize || family === "linear",
    downloadName: libraryConeDownloadName(stamp),
  };
}

function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function stampLibraryConeDocument(
  doc: EulumdatDocument,
  stamp: LibraryConeStamp,
  family: PhotometricFamily = "circular"
): EulumdatDocument {
  const preview = previewLibraryConeStamp(stamp, family);
  const displayName = (stamp.name || doc.luminaireName).trim();
  const catalog = (stamp.catalogNumber || stamp.name || doc.luminaireNumber).trim();

  const next: EulumdatDocument = {
    ...doc,
    company: (stamp.name ? "LUXSIM" : doc.company || "LUXSIM").trim(),
    luminaireName: displayName,
    luminaireNumber: catalog,
    fileName: preview.downloadName,
    dateUser: `${localIsoDate()} LUXSIM library cone`,
    lamps: doc.lamps.map((lamp, i) =>
      i === 0
        ? {
            ...lamp,
            flux: preview.lumens,
            colorTemperature: preview.cct ?? lamp.colorTemperature,
            cri: preview.cri ?? lamp.cri,
            wattage: preview.watts ?? lamp.wattage,
          }
        : lamp
    ),
  };

  const { size, useProductSize } = resolveSize(stamp, family);
  if (useProductSize && size) {
    next.luminaireLength = size.length;
    next.luminaireWidth = size.width;
    next.luminaireHeight = size.height;
    next.luminousLength = size.length;
    next.luminousWidth = size.width;
    next.luminousHeightC0 = size.height;
    next.luminousHeightC90 = size.height;
    next.luminousHeightC180 = size.height;
    next.luminousHeightC270 = size.height;
  }

  return next;
}

export function stampEulumdatText(
  ldtText: string,
  stamp: LibraryConeStamp,
  family: PhotometricFamily = "circular"
): string {
  return writeEulumdat(stampLibraryConeDocument(parseEulumdat(ldtText), stamp, family));
}
