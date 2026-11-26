import {
  dxfBounds,
  officialMetersPerUnitFromInsUnits,
  parseDxfEntities,
  parseDxfInsUnits,
} from "./dxf";
import { parseDxfTextLabels } from "./official-dxf-text";
import {
  officialCadLayerMetaIncomplete,
  officialEnsureCadLayerTable,
  parseDxfLayers,
} from "./official-dxf-layers";

/** Official error when the stored plan file cannot be re-parsed for layers. */
export class OfficialCadLayerBackfillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialCadLayerBackfillError";
  }
}

export const OFFICIAL_CAD_LAYER_BACKFILL_FAILED =
  "Could not update plan layers from the stored file. / 無法從已儲存的圖則檔更新圖層";

export const OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND =
  "Plan layers can only be updated for a DXF or DWG plan. / 只有 DXF 或 DWG 圖則可以更新圖層";

function officialParseObjectMeta(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return { ...(meta as Record<string, unknown>) };
  }
  return {};
}

/**
 * Re-parse a stored DXF and write layer names onto meta.entities plus meta.layers.
 * Complete meta is returned unchanged (same object). A file that only has layer 0
 * still receives a persisted layer table so the client does not retry.
 */
export function officialBackfillCadLayerMetaFromDxf(
  text: string,
  existingMeta: unknown = {}
): Record<string, unknown> {
  if (!officialCadLayerMetaIncomplete(existingMeta)) {
    // Same object when complete, so callers can skip a rewrite.
    if (existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)) {
      return existingMeta as Record<string, unknown>;
    }
    return {};
  }
  if (typeof text !== "string" || !text.includes("SECTION") || !text.includes("ENTITIES")) {
    throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
  }
  const current = officialParseObjectMeta(existingMeta);
  const entities = parseDxfEntities(text);
  const existingEntities = current.entities;
  if (
    entities.length === 0 &&
    Array.isArray(existingEntities) &&
    existingEntities.length > 0
  ) {
    throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
  }
  const insunits = parseDxfInsUnits(text);
  const layers = officialEnsureCadLayerTable(parseDxfLayers(text), entities);
  return {
    ...current,
    entities,
    bounds: dxfBounds(entities),
    insunits,
    metersPerUnit: officialMetersPerUnitFromInsUnits(insunits),
    layers,
    textLabels: parseDxfTextLabels(text),
  };
}
