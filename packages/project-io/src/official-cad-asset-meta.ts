/**
 * Full CAD source entities belong on the stored plan file (and, for older
 * rows, may still sit in asset.metaJson). They must not be persisted going
 * forward, and must not be sent when opening a project — the underlay already
 * holds the last applied visible linework, and the layer table is enough for
 * the Plan layers list.
 */
export function officialCadAssetMetaWithoutSourceEntities(
  meta: Record<string, unknown>
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(meta, "entities")) return meta;
  const { entities: _entities, ...rest } = meta;
  return rest;
}

export function officialCadAssetMetaJsonWithoutSourceEntities(
  metaJson?: string | null
): string {
  if (metaJson == null || metaJson === "") return "{}";
  try {
    const parsed = JSON.parse(metaJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return metaJson;
    }
    const rec = parsed as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(rec, "entities")) return metaJson;
    return JSON.stringify(officialCadAssetMetaWithoutSourceEntities(rec));
  } catch {
    return metaJson;
  }
}
