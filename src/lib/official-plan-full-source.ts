import fs from "fs/promises";
import {
  officialDxfEntitiesToWorld,
  officialDxfTextLabelsToWorld,
  officialDxfWorldEntitiesForRooms,
  type DxfEntity,
  type OfficialDxfRoomsUnderlay,
  type OfficialDxfTextLabel,
  type OfficialRoomAnalysisSourceUsed,
} from "@luxsim/project-io";
import { prisma } from "@/lib/prisma";
import { officialLoadStoredCadSourceEntities } from "@/lib/official-cad-layer-backfill";
import {
  officialCachedPlanTextLabels,
  officialLoadPlanTextLabels,
  officialParseMetaJson,
} from "@/lib/official-plan-text-labels";
import { absolutePath } from "@/lib/storage";

export type OfficialPlanFullSourceResult = {
  worldEntities: DxfEntity[];
  textLabels: OfficialDxfTextLabel[];
  sourceUsed: OfficialRoomAnalysisSourceUsed;
};

/**
 * Load world-mapped CAD entities for Create from plan / Create rooms from DXF.
 * Prefers the stored full source (metaJson.entities, or a re-parse of the
 * saved DXF/DWG) so hidden Plan layers are still used. Falls back to the
 * client-sent visible underlay entities when no full source is stored.
 * Does not write the database and does not invent geometry.
 */
export async function officialLoadPlanEntitiesForBuildFromPlan(input: {
  projectId: string;
  assetId?: string | null;
  underlay?: OfficialDxfRoomsUnderlay | null;
}): Promise<OfficialPlanFullSourceResult> {
  const placement = input.underlay ?? null;
  const loaded = input.assetId
    ? await loadStoredFullSource(input.projectId, input.assetId)
    : null;
  if (loaded && loaded.entities.length > 0) {
    return {
      worldEntities: officialDxfEntitiesToWorld(loaded.entities, placement),
      textLabels: officialDxfTextLabelsToWorld(loaded.labels, placement),
      sourceUsed: "full",
    };
  }
  return {
    worldEntities: officialDxfWorldEntitiesForRooms(placement),
    textLabels: [],
    sourceUsed: "visible-fallback",
  };
}

async function loadStoredFullSource(
  projectId: string,
  assetId: string
): Promise<{ entities: DxfEntity[]; labels: OfficialDxfTextLabel[] } | null> {
  const asset = await prisma.projectAsset.findFirst({
    where: { id: assetId, projectId },
  });
  if (!asset) return null;
  const kind = String(asset.kind || "").toLowerCase();
  if (kind !== "dxf" && kind !== "dwg") return null;

  const meta = officialParseMetaJson(asset.metaJson);
  let entities: DxfEntity[] | null =
    Array.isArray(meta.entities) && meta.entities.length > 0
      ? (meta.entities as DxfEntity[])
      : null;
  let labels = officialCachedPlanTextLabels(meta);

  if (entities && labels) {
    return { entities, labels };
  }

  let data: Buffer | null = null;
  try {
    data = await fs.readFile(absolutePath(asset.fileKey));
  } catch {
    data = null;
  }

  if (!data) {
    return entities && entities.length > 0 ? { entities, labels: labels ?? [] } : null;
  }

  if (!entities || entities.length === 0) {
    try {
      const parsed = await officialLoadStoredCadSourceEntities({
        kind,
        data,
        metaJson: asset.metaJson,
      });
      entities = parsed.length > 0 ? parsed : null;
    } catch {
      entities = null;
    }
  }

  if (!labels) {
    try {
      const loaded = await officialLoadPlanTextLabels({
        kind,
        data,
        metaJson: asset.metaJson,
      });
      labels = loaded.labels;
    } catch {
      labels = [];
    }
  }

  if (!entities || entities.length === 0) return null;
  return { entities, labels: labels ?? [] };
}
