import {
  OfficialCadLayerBackfillError,
  OFFICIAL_CAD_LAYER_BACKFILL_FAILED,
  OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND,
  officialBackfillCadLayerMetaFromDxf,
  officialCadLayerMetaIncomplete,
  officialEnsureCadLayerTable,
  parseDxfEntities,
  parseDxfTextLabels,
  type DxfEntity,
} from "@luxsim/project-io";
import {
  DwgConversionError,
  officialParseDwgPlan,
} from "@/lib/official-dwg-convert";
import { officialParseMetaJson } from "@/lib/official-plan-text-labels";

export {
  OfficialCadLayerBackfillError,
  OFFICIAL_CAD_LAYER_BACKFILL_FAILED,
  OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND,
};

/**
 * Re-parse a stored DXF or DWG plan when asset meta has no layer table and no
 * non-0 entity layers. The binary file is not replaced. Complete meta is
 * returned unchanged.
 */
export async function officialBackfillStoredCadLayerMeta(input: {
  kind: string;
  data: Buffer;
  metaJson?: string | null;
}): Promise<{ meta: Record<string, unknown>; changed: boolean }> {
  const meta = officialParseMetaJson(input.metaJson);
  if (!officialCadLayerMetaIncomplete(meta)) {
    return { meta, changed: false };
  }
  const kind = String(input.kind || "").toLowerCase();
  try {
    if (kind === "dxf") {
      return {
        meta: officialBackfillCadLayerMetaFromDxf(input.data.toString("utf8"), meta),
        changed: true,
      };
    }
    if (kind === "dwg") {
      const parsed = await officialParseDwgPlan(input.data);
      const layers = officialEnsureCadLayerTable(parsed.layers, parsed.entities);
      return {
        meta: {
          ...meta,
          entities: parsed.entities,
          bounds: parsed.bounds,
          insunits: parsed.insunits,
          metersPerUnit: parsed.metersPerUnit,
          layers,
          textLabels: parseDxfTextLabels(parsed.dxfText),
          conversion: meta.conversion ?? "dxf",
        },
        changed: true,
      };
    }
  } catch (error) {
    if (error instanceof OfficialCadLayerBackfillError) throw error;
    if (error instanceof DwgConversionError) {
      throw new OfficialCadLayerBackfillError(error.message);
    }
    throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
  }
  throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND);
}

/**
 * Full CAD source used by a later plan-layer Apply. Prefers leftover
 * `meta.entities` on older rows so a DWG is not converted again; otherwise
 * re-parses the stored DXF or DWG. Does not write the database.
 */
export async function officialLoadStoredCadSourceEntities(input: {
  kind: string;
  data: Buffer;
  metaJson?: string | null;
}): Promise<DxfEntity[]> {
  const meta = officialParseMetaJson(input.metaJson);
  if (Array.isArray(meta.entities) && meta.entities.length > 0) {
    return meta.entities as DxfEntity[];
  }
  const kind = String(input.kind || "").toLowerCase();
  try {
    if (kind === "dxf") {
      const entities = parseDxfEntities(input.data.toString("utf8"));
      if (!entities.length) {
        throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
      }
      return entities;
    }
    if (kind === "dwg") {
      const parsed = await officialParseDwgPlan(input.data);
      if (!parsed.entities.length) {
        throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
      }
      return parsed.entities;
    }
  } catch (error) {
    if (error instanceof OfficialCadLayerBackfillError) throw error;
    if (error instanceof DwgConversionError) {
      throw new OfficialCadLayerBackfillError(error.message);
    }
    throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_FAILED);
  }
  throw new OfficialCadLayerBackfillError(OFFICIAL_CAD_LAYER_BACKFILL_WRONG_KIND);
}
