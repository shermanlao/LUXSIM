import type { LuxsimEmbeddedAsset, ProjectSceneV2 } from "./types";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = new Uint8Array(256).fill(255);
for (let i = 0; i < BASE64_ALPHABET.length; i++) {
  BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(i)] = i;
}

/** DXF and IFC are stored as UTF-8 text; other underlay kinds are binary. */
export function luxsimAssetUsesTextEncoding(kind: string): boolean {
  return kind === "dxf" || kind === "ifc";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out +=
      BASE64_ALPHABET[(n >> 18) & 63]! +
      BASE64_ALPHABET[(n >> 12) & 63]! +
      BASE64_ALPHABET[(n >> 6) & 63]! +
      BASE64_ALPHABET[n & 63]!;
  }
  if (i < len) {
    const a = bytes[i]!;
    const b = i + 1 < len ? bytes[i + 1]! : 0;
    const n = (a << 16) | (b << 8);
    out += BASE64_ALPHABET[(n >> 18) & 63]! + BASE64_ALPHABET[(n >> 12) & 63]!;
    out += i + 1 < len ? BASE64_ALPHABET[(n >> 6) & 63]! : "=";
    out += "=";
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  const cleaned = text.replace(/\s+/g, "");
  if (!cleaned) return new Uint8Array(0);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new Error("Invalid base64");
  }
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  const outLen = (cleaned.length / 4) * 3 - padding;
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const n =
      (b64Value(cleaned.charCodeAt(i)) << 18) |
      (b64Value(cleaned.charCodeAt(i + 1)) << 12) |
      (b64Value(cleaned.charCodeAt(i + 2)) << 6) |
      b64Value(cleaned.charCodeAt(i + 3));
    if (o < outLen) out[o++] = (n >> 16) & 255;
    if (o < outLen) out[o++] = (n >> 8) & 255;
    if (o < outLen) out[o++] = n & 255;
  }
  return out;
}

export function missingLuxsimAssetWarning(label: string): string {
  return `Plan drawing for ${label} is missing from the file and was not invented.`;
}

export function unrestoredLuxsimAssetWarning(label: string): string {
  return `Plan drawing for ${label} could not be restored and was not invented.`;
}

export function collectReferencedAssetIds(scene: ProjectSceneV2): string[] {
  const ids = new Set<string>();
  for (const underlay of scene.underlays ?? []) {
    if (underlay.assetId) ids.add(underlay.assetId);
    if (underlay.pageRasterAssetId) ids.add(underlay.pageRasterAssetId);
  }
  return [...ids];
}

export function remapSceneAssetIds(
  scene: ProjectSceneV2,
  idMap: Record<string, string>
): ProjectSceneV2 {
  const mapId = (id: string | undefined) => (id ? idMap[id] ?? id : id);
  return {
    ...scene,
    underlays: (scene.underlays ?? []).map((underlay) => ({
      ...underlay,
      assetId: mapId(underlay.assetId) ?? underlay.assetId,
      pageRasterAssetId: underlay.pageRasterAssetId
        ? mapId(underlay.pageRasterAssetId)
        : underlay.pageRasterAssetId,
    })),
  };
}

export function embedLuxsimAsset(input: {
  fileName: string;
  kind: string;
  text?: string;
  bytes?: Uint8Array;
  metaJson?: string;
}): LuxsimEmbeddedAsset | null {
  const fileName = input.fileName.trim() || "underlay";
  const kind = input.kind.trim() || "image";
  if (luxsimAssetUsesTextEncoding(kind)) {
    const text =
      typeof input.text === "string"
        ? input.text
        : input.bytes
          ? new TextDecoder("utf-8").decode(input.bytes)
          : "";
    if (!text) return null;
    return compactEmbeddedAsset({
      fileName,
      kind,
      encoding: "text",
      content: text,
      metaJson: input.metaJson,
    });
  }
  const bytes = input.bytes;
  if (!bytes?.byteLength) return null;
  return compactEmbeddedAsset({
    fileName,
    kind,
    encoding: "base64",
    content: bytesToBase64(bytes),
    metaJson: input.metaJson,
  });
}

export function decodeLuxsimAssetContent(asset: LuxsimEmbeddedAsset): {
  text?: string;
  bytes: Uint8Array;
} {
  if (asset.encoding === "text") {
    return { text: asset.content, bytes: new TextEncoder().encode(asset.content) };
  }
  const bytes = base64ToBytes(asset.content);
  return { bytes };
}

function compactEmbeddedAsset(asset: LuxsimEmbeddedAsset): LuxsimEmbeddedAsset {
  if (typeof asset.metaJson === "string") return asset;
  const { metaJson: _unused, ...rest } = asset;
  return rest;
}

function b64Value(charCode: number): number {
  if (charCode === 61) return 0;
  const value = BASE64_LOOKUP[charCode] ?? 255;
  if (value === 255) throw new Error("Invalid base64");
  return value;
}
