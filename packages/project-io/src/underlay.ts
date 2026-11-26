import type { DxfEntity, OfficialDxfLayer, Underlay } from "./types";

/** Preview longest-side span (meters) so a new raster is visible before calibrate. */
export const DEFAULT_PLAN_SPAN_M = 12;

export const PROJECT_ASSET_KIND_EXT: Record<string, string[]> = {
  image: [".png", ".jpg", ".jpeg", ".webp"],
  pdf: [".pdf"],
  dxf: [".dxf"],
  dwg: [".dwg"],
  ifc: [".ifc"],
};

export type UnderlayKind = Underlay["kind"];

export function inferProjectAssetKind(fileName: string, kindHint = ""): string {
  const lower = fileName.toLowerCase();
  let kind = kindHint;
  if (!kind) {
    if (lower.endsWith(".pdf")) kind = "pdf";
    else if (lower.endsWith(".dxf")) kind = "dxf";
    else if (lower.endsWith(".dwg")) kind = "dwg";
    else if (lower.endsWith(".ifc")) kind = "ifc";
    else kind = "image";
  }
  return kind;
}

export function projectAssetKindAllowed(
  fileName: string,
  kindHint = ""
): { ok: boolean; kind: string; error?: string } {
  const kind = inferProjectAssetKind(fileName, kindHint);
  const allowed = PROJECT_ASSET_KIND_EXT[kind];
  const lower = fileName.toLowerCase();
  if (!allowed || !allowed.some((ext) => lower.endsWith(ext))) {
    return { ok: false, kind, error: `Unexpected extension for kind ${kind}` };
  }
  return { ok: true, kind };
}

/** Map an uploaded asset kind onto the underlay kind. DWG is not a raster image. */
export function underlayKindFromAssetKind(assetKind: string): UnderlayKind {
  if (
    assetKind === "dxf" ||
    assetKind === "pdf" ||
    assetKind === "dwg" ||
    assetKind === "ifc"
  ) {
    return assetKind;
  }
  return "image";
}

/** Image or PDF page raster that can be drawn as a plan texture. */
export function isDisplayableRasterUnderlay(
  underlay: Pick<Underlay, "kind">
): boolean {
  return underlay.kind === "image" || underlay.kind === "pdf";
}

/** A DWG underlay that has already been converted to official DXF entities. */
export function officialDwgHasConvertedLinework(
  underlay: {
    kind?: string;
    dxfEntities?: DxfEntity[];
    hiddenLayers?: string[] | null;
    dxfLayers?: OfficialDxfLayer[] | null;
  } | null | undefined
): boolean {
  if (underlay?.kind !== "dwg") return false;
  if (Array.isArray(underlay.dxfEntities) && underlay.dxfEntities.length > 0) return true;
  // Apply + Select none leaves an empty visible list; the conversion still stands.
  if (Array.isArray(underlay.hiddenLayers) && underlay.hiddenLayers.length > 0) return true;
  if (Array.isArray(underlay.dxfLayers) && underlay.dxfLayers.length > 0) return true;
  return false;
}

/**
 * Official parsed CAD linework: a DXF underlay, or a DWG underlay that has
 * been converted (including when every layer is currently hidden). Image,
 * PDF, IFC, and unparsed DWG are not.
 */
export function officialHasParsedCadLinework<
  T extends { kind?: string; dxfEntities?: DxfEntity[] },
>(underlay: T | null | undefined): underlay is T {
  if (!underlay) return false;
  if (underlay.kind === "dxf") return true;
  return officialDwgHasConvertedLinework(underlay);
}

export const OFFICIAL_DWG_IMPORTED_STATUS = "Plan imported from DWG.";

export function underlayFlipX(underlay: Pick<Underlay, "flipX">): boolean {
  return Boolean(underlay.flipX);
}

export function underlayFlipY(underlay: Pick<Underlay, "flipY">): boolean {
  return Boolean(underlay.flipY);
}

/**
 * Display / preview world size from pixels × metersPerUnit.
 * This may be the uncalibrated preview span — use
 * `underlayCalibratedWorldSize` when a real-world size is required.
 */
export function underlayWorldSize(
  underlay: Pick<Underlay, "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit">
): { widthM: number; heightM: number } | null {
  const w = underlay.sourceWidthPx;
  const h = underlay.sourceHeightPx;
  if (!(typeof w === "number" && typeof h === "number" && w > 0 && h > 0)) {
    return null;
  }
  const mpu = underlay.metersPerUnit > 0 ? underlay.metersPerUnit : 1;
  return {
    widthM: w * mpu,
    heightM: h * mpu,
  };
}

/** Uniform meters-per-pixel so the longest image side maps to `spanM`. */
export function initialMetersPerPixel(
  widthPx: number,
  heightPx: number,
  spanM = DEFAULT_PLAN_SPAN_M
): number {
  const longest = Math.max(widthPx, heightPx);
  if (!(longest > 0)) return 1;
  return spanM / longest;
}

/**
 * Convert legacy underlay scale (multiplier on a ~12 m default width) to
 * meters-per-pixel once native pixel size is known.
 */
export function legacyScaleToMetersPerPixel(
  legacyScale: number,
  widthPx: number,
  spanM = DEFAULT_PLAN_SPAN_M
): number {
  if (!(widthPx > 0)) return legacyScale;
  const scale = legacyScale > 0 ? legacyScale : 1;
  return (spanM * scale) / widthPx;
}

function isDefaultPreviewMetersPerUnit(
  widthPx: number,
  heightPx: number,
  metersPerUnit: number
): boolean {
  const expected = initialMetersPerPixel(widthPx, heightPx);
  if (!(metersPerUnit > 0) || !(expected > 0)) return true;
  const ratio = metersPerUnit / expected;
  return ratio > 0.98 && ratio < 1.02;
}

/**
 * Official import scale: raster/PDF start uncalibrated (preview mpu only).
 * DXF entities, and a DWG converted to those entities, use $INSUNITS when present (`metersPerUnit = 1` if the header is missing, unitless, or already metres).
 */
export function initialUnderlayScale(input: {
  kind: UnderlayKind;
  sourceWidthPx?: number;
  sourceHeightPx?: number;
  dxfEntities?: DxfEntity[];
  /** When set (from DXF/DWG $INSUNITS), used instead of the 1 m / drawing-unit default. */
  metersPerUnit?: number;
}): { metersPerUnit: number; scaleCalibrated: boolean } {
  const fromUnits =
    typeof input.metersPerUnit === "number" &&
    Number.isFinite(input.metersPerUnit) &&
    input.metersPerUnit > 0
      ? input.metersPerUnit
      : null;
  if (input.kind === "dxf" || input.kind === "ifc") {
    return { metersPerUnit: fromUnits ?? 1, scaleCalibrated: true };
  }
  if (input.kind === "dwg") {
    return {
      metersPerUnit: fromUnits ?? 1,
      scaleCalibrated: officialDwgHasConvertedLinework({
        kind: "dwg",
        dxfEntities: input.dxfEntities,
      }),
    };
  }
  const w = input.sourceWidthPx;
  const h = input.sourceHeightPx;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return {
      metersPerUnit: initialMetersPerPixel(w, h),
      scaleCalibrated: false,
    };
  }
  return { metersPerUnit: 1, scaleCalibrated: false };
}

export function isUnderlayScaleCalibrated(
  underlay: Pick<
    Underlay,
    "kind" | "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit" | "scaleCalibrated"
  > & { kind?: UnderlayKind; dxfEntities?: DxfEntity[] }
): boolean {
  if (underlay.scaleCalibrated === true) return true;
  if (underlay.kind === "dxf" || underlay.kind === "ifc") return true;
  if (officialDwgHasConvertedLinework(underlay)) return true;
  if (underlay.scaleCalibrated === false) return false;
  if (underlay.kind === "dwg") return false;
  const w = underlay.sourceWidthPx;
  const h = underlay.sourceHeightPx;
  if (!(typeof w === "number" && typeof h === "number" && w > 0 && h > 0)) {
    return false;
  }
  return !isDefaultPreviewMetersPerUnit(w, h, underlay.metersPerUnit);
}

/** Real-world size only after calibrate (or for DXF already in metres). */
export function underlayCalibratedWorldSize(
  underlay: Pick<
    Underlay,
    | "kind"
    | "sourceWidthPx"
    | "sourceHeightPx"
    | "metersPerUnit"
    | "scaleCalibrated"
  > & { kind?: UnderlayKind; dxfEntities?: DxfEntity[] }
): { widthM: number; heightM: number } | null {
  if (!isUnderlayScaleCalibrated(underlay)) return null;
  return underlayWorldSize(underlay);
}

export function officialImportedUnderlay(input: {
  id: string;
  storeyId: string;
  assetId: string;
  assetKind: string;
  sourceWidthPx?: number;
  sourceHeightPx?: number;
  dxfEntities?: DxfEntity[];
  metersPerUnit?: number;
  hiddenLayers?: string[];
  dxfLayers?: Underlay["dxfLayers"];
  pageIndex?: number;
  pageRasterAssetId?: string;
  rasterDpi?: number;
  pdfPageCount?: number;
  opacity?: number;
}): Underlay {
  const kind = underlayKindFromAssetKind(input.assetKind);
  const { metersPerUnit, scaleCalibrated } = initialUnderlayScale({
    kind,
    sourceWidthPx: input.sourceWidthPx,
    sourceHeightPx: input.sourceHeightPx,
    dxfEntities: input.dxfEntities,
    metersPerUnit: input.metersPerUnit,
  });
  return {
    id: input.id,
    storeyId: input.storeyId,
    assetId: input.assetId,
    kind,
    opacity: input.opacity ?? 0.85,
    metersPerUnit,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    sourceWidthPx: input.sourceWidthPx,
    sourceHeightPx: input.sourceHeightPx,
    orientationMigrated: true,
    dxfEntities: input.dxfEntities,
    hiddenLayers: input.hiddenLayers,
    dxfLayers: input.dxfLayers,
    pageIndex: input.pageIndex,
    pageRasterAssetId: input.pageRasterAssetId,
    rasterDpi: input.rasterDpi,
    pdfPageCount: input.pdfPageCount,
    scaleCalibrated,
  };
}

/** Official Calibrate scale: uniform factor on both axes, then marked calibrated. */
export function applyUnderlayCalibration<
  T extends Pick<Underlay, "metersPerUnit">,
>(
  underlay: T,
  a: { x: number; y: number },
  b: { x: number; y: number },
  realM: number
): (T & { scaleCalibrated: true }) | null {
  const distM = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(realM > 0) || !(distM > 1e-6)) return null;
  return {
    ...underlay,
    metersPerUnit: underlay.metersPerUnit * (realM / distM),
    scaleCalibrated: true,
  };
}

export type OfficialUnderlayScaleFields = Pick<
  Underlay,
  "kind" | "sourceWidthPx" | "sourceHeightPx" | "metersPerUnit" | "scaleCalibrated"
> & { kind?: UnderlayKind; dxfEntities?: DxfEntity[] };

/**
 * Official editor may create rooms unless the active underlay is a
 * displayable image/PDF that has not been officially calibrated.
 * No underlay, DXF (already metres), DWG (converted linework or not a tracing raster), and
 * already-calibrated rasters are allowed. Uses isUnderlayScaleCalibrated
 * — do not invent a second notion of “calibrated”.
 */
export function officialDrawRoomAllowed(
  underlay: OfficialUnderlayScaleFields | null | undefined
): boolean {
  if (!underlay) return true;
  if (!isDisplayableRasterUnderlay(underlay)) return true;
  return isUnderlayScaleCalibrated(underlay);
}

/** Status shown when official draw-room / rectangle-create is blocked. */
export const UNCALIBRATED_DRAW_ROOM_STATUS =
  "Calibrate scale first — the plan underlay is a preview size until you set a real distance.";

export function officialDrawRoomBlockedReason(
  underlay: OfficialUnderlayScaleFields | null | undefined
): string | null {
  return officialDrawRoomAllowed(underlay) ? null : UNCALIBRATED_DRAW_ROOM_STATUS;
}
