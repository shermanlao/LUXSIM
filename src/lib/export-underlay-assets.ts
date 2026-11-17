import {
  collectReferencedAssetIds,
  embedLuxsimAsset,
  type LuxsimEmbeddedAsset,
  type ProjectSceneV2,
} from "@luxsim/project-io";

export type ExportAssetMeta = {
  id: string;
  fileName: string;
  kind: string;
  metaJson?: string;
};

export type LoadedAssetFile = {
  text?: string;
  bytes?: Uint8Array;
};

export type OfficialExportAssets = {
  assets: Record<string, LuxsimEmbeddedAsset>;
  missingAssetIds: string[];
};

/**
 * Embed underlay / CAD files referenced by the official scene.
 * Missing files are listed instead of inventing bytes.
 */
export async function collectOfficialExportAssets(opts: {
  assetIds: string[];
  assetMeta?: ExportAssetMeta[];
  loadAssetFile: (id: string, meta: ExportAssetMeta | undefined) => Promise<LoadedAssetFile | null>;
}): Promise<OfficialExportAssets> {
  const metaById = new Map((opts.assetMeta ?? []).map((row) => [row.id, row]));
  const assets: Record<string, LuxsimEmbeddedAsset> = {};
  const missingAssetIds: string[] = [];

  for (const id of opts.assetIds) {
    if (!id || assets[id]) continue;
    const meta = metaById.get(id);
    const loaded = await opts.loadAssetFile(id, meta);
    const embedded = embedLuxsimAsset({
      fileName: meta?.fileName || id,
      kind: meta?.kind || "",
      text: loaded?.text,
      bytes: loaded?.bytes,
      metaJson: meta?.metaJson,
    });
    if (!embedded) {
      missingAssetIds.push(id);
      continue;
    }
    assets[id] = embedded;
  }

  return { assets, missingAssetIds };
}

export function officialExportAssetIds(scene: ProjectSceneV2): string[] {
  return collectReferencedAssetIds(scene);
}

export function missingExportAssetStatus(
  missingIds: string[],
  names?: Record<string, string>
): string {
  const labels = missingIds.map((id) => names?.[id] || id).join(", ");
  return `.lux downloaded, but plan drawings are missing for: ${labels}. The file is incomplete.`;
}

export async function fetchProjectAssetMeta(projectId: string): Promise<ExportAssetMeta[]> {
  const res = await fetch(`/api/projects/${projectId}/assets`);
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<Partial<ExportAssetMeta> & { id?: string }>;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is ExportAssetMeta => typeof row.id === "string" && typeof row.fileName === "string")
    .map((row) => ({
      id: row.id,
      fileName: row.fileName,
      kind: typeof row.kind === "string" ? row.kind : "",
      metaJson: typeof row.metaJson === "string" ? row.metaJson : undefined,
    }));
}

export async function fetchProjectAssetFile(
  projectId: string,
  assetId: string,
  kind = ""
): Promise<LoadedAssetFile | null> {
  const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/file`);
  if (!res.ok) return null;
  if (kind === "dxf" || kind === "ifc") {
    const text = await res.text();
    return text ? { text } : null;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.byteLength ? { bytes } : null;
}
