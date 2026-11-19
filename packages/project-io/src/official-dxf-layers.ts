import type { DxfEntity, OfficialDxfLayer } from "./types";

/** Official fallback layer name when group 8 is omitted or blank. */
export const OFFICIAL_DXF_DEFAULT_LAYER = "0";

export function officialDxfLayerName(raw?: string | null): string {
  if (typeof raw !== "string") return OFFICIAL_DXF_DEFAULT_LAYER;
  const name = raw.trim();
  return name.length > 0 ? name : OFFICIAL_DXF_DEFAULT_LAYER;
}

export function officialEntityLayer(entity: Pick<DxfEntity, "layer">): string {
  return officialDxfLayerName(entity.layer);
}

/**
 * LAYER table from a DXF (or a DWG converted to DXF).
 * Group 2 is the name, group 70 bit 0 is frozen, a negative group 62 color
 * means the layer is off. Missing or unreadable entries are skipped.
 */
export function parseDxfLayers(text: string): OfficialDxfLayer[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const layers: OfficialDxfLayer[] = [];
  const seen = new Set<string>();
  let i = 0;
  let section: string | null = null;
  let inLayerTable = false;

  const readPair = (): { code: number; value: string } | null => {
    if (i + 1 >= lines.length) return null;
    const code = Number(lines[i++]!.trim());
    const value = lines[i++] ?? "";
    if (!Number.isFinite(code)) return null;
    return { code, value: value.trim() };
  };

  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code !== 0) continue;
    const type = pair.value.toUpperCase();
    if (type === "SECTION") {
      let name = "";
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
          i -= 2;
          break;
        }
        if (p.code === 2) name = p.value;
      }
      section = name.toUpperCase() || null;
      inLayerTable = false;
      continue;
    }
    if (type === "ENDSEC") {
      section = null;
      inLayerTable = false;
      continue;
    }
    if (type === "TABLE" && section === "TABLES") {
      let name = "";
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
          i -= 2;
          break;
        }
        if (p.code === 2) name = p.value;
      }
      inLayerTable = name.toUpperCase() === "LAYER";
      continue;
    }
    if (type === "ENDTAB") {
      inLayerTable = false;
      continue;
    }
    if (type === "LAYER" && inLayerTable) {
      let name = "";
      let flags = 0;
      let color = 7;
      let hasColor = false;
      while (i < lines.length) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
          i -= 2;
          break;
        }
        if (p.code === 2) name = p.value;
        if (p.code === 70) flags = Number(p.value);
        if (p.code === 62) {
          color = Number(p.value);
          hasColor = true;
        }
      }
      const layerName = officialDxfLayerName(name);
      if (seen.has(layerName)) continue;
      seen.add(layerName);
      layers.push({
        name: layerName,
        on: hasColor ? !(Number.isFinite(color) && color < 0) : true,
        frozen: Number.isFinite(flags) && (flags & 1) === 1,
      });
    }
  }
  return layers;
}

/** Entity and table layer names, defaulting unnamed entities to "0". */
export function officialCadLayerNames(
  entities: Array<Pick<DxfEntity, "layer">>,
  table?: OfficialDxfLayer[] | null
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    const name = officialDxfLayerName(raw);
    if (seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };
  for (const layer of table ?? []) add(layer.name);
  for (const entity of entities) add(entity.layer);
  if (names.length === 0) add(OFFICIAL_DXF_DEFAULT_LAYER);
  return names;
}

export function officialExtractVisibleCadEntities<T extends Pick<DxfEntity, "layer">>(
  entities: T[],
  hiddenLayers?: Iterable<string> | null
): T[] {
  const hidden = new Set(
    [...(hiddenLayers ?? [])].map((name) => officialDxfLayerName(name))
  );
  if (hidden.size === 0) return entities;
  return entities.filter((entity) => !hidden.has(officialEntityLayer(entity)));
}

/** Apply INSERT layer inheritance: block entities on layer 0 take the INSERT layer. */
export function officialInsertExplodedLayer(
  entityLayer: string | undefined,
  insertLayer: string | undefined
): string {
  const child = officialDxfLayerName(entityLayer);
  return child === OFFICIAL_DXF_DEFAULT_LAYER
    ? officialDxfLayerName(insertLayer)
    : child;
}
