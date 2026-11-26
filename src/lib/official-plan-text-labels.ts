import {
  officialIsDxfTextLabelList,
  parseDxfTextLabels,
  type OfficialDxfTextLabel,
} from "@luxsim/project-io";
import { convertDwgToDxfText } from "@/lib/official-dwg-convert";

export class OfficialPlanTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialPlanTextError";
  }
}

export function officialCachedPlanTextLabels(meta: unknown): OfficialDxfTextLabel[] | null {
  if (!meta || typeof meta !== "object") return null;
  const labels = (meta as { textLabels?: unknown }).textLabels;
  return officialIsDxfTextLabelList(labels) ? labels : null;
}

export function officialParseMetaJson(metaJson?: string | null): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metaJson || "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Load lighting-code labels from a stored official plan asset.
 * Prefers `meta.textLabels` when that cache is a valid list (including empty).
 * Otherwise parses the DXF, or converts a DWG and then parses TEXT/MTEXT.
 */
export async function officialLoadPlanTextLabels(input: {
  kind: string;
  data: Buffer;
  metaJson?: string | null;
}): Promise<{ labels: OfficialDxfTextLabel[]; cached: boolean }> {
  const meta = officialParseMetaJson(input.metaJson);
  const cached = officialCachedPlanTextLabels(meta);
  if (cached) return { labels: cached, cached: true };

  const kind = String(input.kind || "").toLowerCase();
  if (kind === "dxf") {
    return { labels: parseDxfTextLabels(input.data.toString("utf8")), cached: false };
  }
  if (kind === "dwg") {
    const dxfText = await convertDwgToDxfText(input.data);
    return { labels: parseDxfTextLabels(dxfText), cached: false };
  }
  throw new OfficialPlanTextError(
    "Import a DXF or converted DWG plan first / 請先匯入 DXF 或已轉換的 DWG 圖則"
  );
}
