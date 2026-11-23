import { officialCadAssetMetaJsonWithoutSourceEntities } from "@luxsim/project-io";
import { prisma } from "@/lib/prisma";
import { parseProjectResults, parseProjectScene } from "@/lib/project-scene";
import {
  officialIsoTimestamp,
  type OfficialEditorAssetRow,
  type OfficialProjectEditorPayload,
} from "@/lib/official-project-editor-state";

export {
  officialIsoTimestamp,
  officialProjectEditorEtag,
  officialProjectRevisionMatches,
  officialRevisionFromMeta,
  type OfficialEditorAssetRow,
  type OfficialProjectEditorPayload,
  type OfficialProjectRevision,
} from "@/lib/official-project-editor-state";

export function officialEditorAssetsForClient(
  assets: Array<{
    id: string;
    kind: string;
    fileName: string;
    metaJson: string;
    createdAt: Date | string;
  }>
): OfficialEditorAssetRow[] {
  return assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    fileName: asset.fileName,
    metaJson: officialCadAssetMetaJsonWithoutSourceEntities(asset.metaJson),
    createdAt:
      asset.createdAt instanceof Date
        ? asset.createdAt.toISOString()
        : officialIsoTimestamp(asset.createdAt),
  }));
}

/** Load the stripped editor payload. Migrates a leftover v1 sceneJson once. */
export async function officialLoadProjectEditorPayload(
  projectId: string
): Promise<OfficialProjectEditorPayload | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      sceneJson: true,
      resultsJson: true,
      assets: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          metaJson: true,
          createdAt: true,
        },
      },
    },
  });
  if (!project) return null;

  const scene = parseProjectScene(project.sceneJson);
  const results = parseProjectResults(project.resultsJson, scene);
  let updatedAt = project.updatedAt;

  if (!project.sceneJson.includes('"version":2')) {
    const migrated = await prisma.project.update({
      where: { id: projectId },
      data: {
        sceneJson: JSON.stringify(scene),
        resultsJson: JSON.stringify(results),
      },
      select: { updatedAt: true },
    });
    updatedAt = migrated.updatedAt;
  }

  return {
    id: project.id,
    name: project.name,
    updatedAt: officialIsoTimestamp(updatedAt),
    scene,
    results,
    assets: officialEditorAssetsForClient(project.assets),
  };
}
