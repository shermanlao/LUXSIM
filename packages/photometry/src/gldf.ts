import JSZip from "jszip";
import { parseIes } from "./parse-ies";
import { parseLdt } from "./parse-ldt";
import type { PhotometricData, SourceFormat } from "./types";

function parsePhotometricFile(text: string, format: SourceFormat) {
  return format === "ies" ? parseIes(text) : parseLdt(text);
}

/** Official schema used for GLDF we write. */
export const GLDF_SCHEMA_VERSION = "1.0.0-rc.3";
export const GLDF_SCHEMA_LOCATION = `https://gldf.io/xsd/gldf/${GLDF_SCHEMA_VERSION}/gldf.xsd`;
export const GLDF_CREATED_WITH = "LUXSIM";

export const GLDF_MAX_CONTAINER_BYTES = 10_000_000;
export const GLDF_MAX_ENTRY_BYTES = 2_000_000;
export const GLDF_MAX_UNCOMPRESSED_BYTES = 20_000_000;

export type GldfImportEntry = {
  productName: string;
  variantName: string | null;
  displayName: string;
  manufacturer: string;
  catalogNumber: string;
  photometryFileName: string;
  format: SourceFormat;
  text: string;
  data: PhotometricData;
  warnings: string[];
};

export type GldfParseResult = {
  entries: GldfImportEntry[];
  warnings: string[];
};

export type GldfExportInput = {
  manufacturer?: string | null;
  productName: string;
  catalogNumber?: string | null;
  variantName?: string | null;
  format: SourceFormat;
  photometryText: string;
  photometryFileName?: string;
  uniqueId?: string;
  createdAt?: Date;
};

export function isGldfFileName(name: string): boolean {
  return /\.gldf$/i.test(name.trim());
}

export function detectUploadFormat(filename: string): SourceFormat | "gldf" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gldf")) return "gldf";
  if (lower.endsWith(".ies")) return "ies";
  if (lower.endsWith(".ldt")) return "ldt";
  return null;
}

export function gldfDownloadFileName(name: string): string {
  const base = name.replace(/[\r\n"]+/g, "").replace(/\.(gldf|ies|ldt)$/i, "").trim() || "luminaire";
  return `${base}.gldf`;
}

export async function parseGldfContainer(bytes: Uint8Array): Promise<GldfParseResult> {
  if (bytes.byteLength === 0) {
    throw new Error("This GLDF file is empty.");
  }
  if (bytes.byteLength > GLDF_MAX_CONTAINER_BYTES) {
    throw new Error("File too large (max 10MB)");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("This is not a GLDF container (expected a ZIP file with product.xml).");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("This GLDF file could not be opened as a ZIP container.");
  }

  const fileMap = new Map<string, Uint8Array>();
  let uncompressed = 0;
  const zipEntries = Object.values(zip.files);
  for (const entry of zipEntries) {
    if (entry.dir) continue;
    const name = normalizeZipPath(entry.name);
    if (!name || name.startsWith("__macosx/") || name.endsWith("/.ds_store") || name.endsWith("/thumbs.db")) {
      continue;
    }
    const data = await entry.async("uint8array");
    uncompressed += data.byteLength;
    if (data.byteLength > GLDF_MAX_ENTRY_BYTES && isProductXmlPath(name)) {
      throw new Error("product.xml in this GLDF file is too large.");
    }
    if (uncompressed > GLDF_MAX_UNCOMPRESSED_BYTES) {
      throw new Error("This GLDF file unpacks to more than the allowed size.");
    }
    fileMap.set(name, data);
  }

  const productEntry = [...fileMap.keys()].find((name) => isProductXmlPath(name));
  if (!productEntry) {
    throw new Error("This GLDF file has no product.xml.");
  }
  const xml = decodeXmlBytes(fileMap.get(productEntry)!);
  const stripped = stripComments(xml);
  if (!/<Root\b/i.test(stripped)) {
    throw new Error("product.xml is not a valid GLDF document.");
  }

  const warnings: string[] = [];
  const manufacturer = firstTagText(stripped, "Manufacturer") ?? "";
  const productName = localeText(innerOfFirst(stripped, "ProductMetaData") ?? "", "Name") ?? "";
  const catalogNumber = localeText(innerOfFirst(stripped, "ProductMetaData") ?? "", "ProductNumber") ?? "";

  const filesById = indexFiles(stripped);
  const photometriesById = indexPhotometries(stripped);
  const emittersById = indexById(stripped, "Emitter");
  const equipmentsById = indexById(stripped, "Equipment");
  const lightSourcesById = indexLightSources(stripped);

  const variantBlocks = matchBlocks(stripped, "Variant");
  const entries: GldfImportEntry[] = [];
  const usedPhotometry = new Set<string>();

  const addFromPhotometry = (
    photometryId: string,
    variantName: string | null,
  ) => {
    const phot = photometriesById.get(photometryId);
    if (!phot) {
      warnings.push(`Photometry "${photometryId}" was referenced but not defined.`);
      return;
    }
    const fileId = attr(phot, "PhotometryFileReference", "fileId");
    if (!fileId) {
      warnings.push(`Photometry "${photometryId}" has no embedded IES or LDT file.`);
      return;
    }
    const key = `${variantName ?? ""}::${fileId}`;
    if (usedPhotometry.has(key) || (variantName == null && usedPhotometry.has(`::${fileId}`))) return;

    const fileInfo = filesById.get(fileId);
    if (!fileInfo) {
      warnings.push(`File "${fileId}" was referenced but not defined.`);
      return;
    }
    if (fileInfo.type && fileInfo.type.toLowerCase() === "url") {
      warnings.push(`Photometry file "${fileInfo.name}" is a URL and was skipped.`);
      return;
    }
    const format = photometryFormat(fileInfo.contentType, fileInfo.name);
    if (!format) {
      warnings.push(
        `Photometry file "${fileInfo.name}" is not an embedded IES or LDT file and was skipped.`,
      );
      return;
    }
    if (looksTooLarge(fileMap, fileInfo.name)) {
      warnings.push(`Photometry file "${fileInfo.name}" is too large and was skipped.`);
      return;
    }
    const raw = resolveZipFile(fileMap, fileInfo.name);
    if (!raw) {
      warnings.push(`Photometry file "${fileInfo.name}" is missing from the container.`);
      return;
    }
    const text = decodeTextBytes(raw);
    try {
      const parsed = parsePhotometricFile(text, format);
      usedPhotometry.add(key);
      const displayName = gldfDisplayName(productName, variantName);
      const data = { ...parsed.data };
      if (!data.manufacturer && manufacturer) data.manufacturer = manufacturer;
      if (!data.catalogNumber && catalogNumber) data.catalogNumber = catalogNumber;
      if (!data.description && displayName) data.description = displayName;
      entries.push({
        productName,
        variantName,
        displayName,
        manufacturer,
        catalogNumber,
        photometryFileName: zipBaseName(fileInfo.name),
        format,
        text,
        data,
        warnings: parsed.warnings,
      });
    } catch (err) {
      warnings.push(
        `Photometry file "${fileInfo.name}" could not be parsed: ${
          err instanceof Error ? err.message : "invalid photometry"
        }`,
      );
    }
  };

  for (const variant of variantBlocks) {
    const variantName = localeText(variant.inner, "Name");
    const emitterIds = allAttrs(variant.inner, "EmitterReference", "emitterId");
    const photometryIds: string[] = [];
    for (const emitterId of emitterIds) {
      const emitter = emittersById.get(emitterId);
      if (!emitter) continue;
      photometryIds.push(
        ...photometryIdsFromEmitter(emitter, equipmentsById, lightSourcesById),
      );
    }
    for (const id of unique(photometryIds)) addFromPhotometry(id, variantName);
  }

  if (entries.length === 0) {
    for (const id of photometriesById.keys()) addFromPhotometry(id, null);
  }

  if (entries.length === 0) {
    throw new Error("This GLDF file has no embedded IES or LDT photometry.");
  }

  return { entries, warnings };
}

export async function buildGldfContainer(input: GldfExportInput): Promise<Uint8Array> {
  const format = input.format;
  const ext = format === "ies" ? "ies" : "ldt";
  const contentType = format === "ies" ? "ldc/ies" : "ldc/eulumdat";
  const photometryFileName =
    sanitizeFileName(input.photometryFileName?.replace(/\.(gldf|ies|ldt)$/i, "") || "photometry") +
    `.${ext}`;
  const zipPath = `ldc/${photometryFileName}`;
  const uniqueId = input.uniqueId?.trim() || newGldfId();
  const created = (input.createdAt ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const manufacturer = xmlEscape(input.manufacturer?.trim() || "Unknown");
  const productName = xmlEscape(input.productName.trim() || "Luminaire");
  const catalog = input.catalogNumber?.trim();
  const variantName = xmlEscape((input.variantName?.trim() || input.productName.trim() || "Default"));

  const catalogXml = catalog
    ? `\n      <ProductNumber>\n        <Locale language="en">${xmlEscape(catalog)}</Locale>\n      </ProductNumber>`
    : "";

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:noNamespaceSchemaLocation="${GLDF_SCHEMA_LOCATION}">
	<Header>
		<Manufacturer>${manufacturer}</Manufacturer>
		<FormatVersion major="1" minor="0" pre-release="3"></FormatVersion>
		<CreatedWithApplication>${GLDF_CREATED_WITH}</CreatedWithApplication>
		<GldfCreationTimeCode>${created}</GldfCreationTimeCode>
		<UniqueGldfId>${xmlEscape(uniqueId)}</UniqueGldfId>
	</Header>
	<GeneralDefinitions>
		<Files>
			<File id="photometryFile" contentType="${contentType}" type="localFileName">${xmlEscape(zipPath)}</File>
		</Files>
		<Photometries>
			<Photometry id="photometry">
				<PhotometryFileReference fileId="photometryFile" />
			</Photometry>
		</Photometries>
		<Emitters>
			<Emitter id="emitter-1">
				<ChangeableLightEmitter>
					<PhotometryReference photometryId="photometry" />
				</ChangeableLightEmitter>
			</Emitter>
		</Emitters>
	</GeneralDefinitions>
	<ProductDefinitions>
		<ProductMetaData>
			<UniqueProductId>${xmlEscape(uniqueId)}</UniqueProductId>${catalogXml}
			<Name>
				<Locale language="en">${productName}</Locale>
			</Name>
		</ProductMetaData>
		<Variants>
			<Variant id="variant-1">
				<Name>
					<Locale language="en">${variantName}</Locale>
				</Name>
				<Geometry>
					<EmitterReference emitterId="emitter-1" />
				</Geometry>
			</Variant>
		</Variants>
	</ProductDefinitions>
</Root>
`;

  const zip = new JSZip();
  zip.file("product.xml", xml);
  zip.file(zipPath, input.photometryText);
  const out = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return out;
}

function gldfDisplayName(productName: string, variantName: string | null): string {
  const product = productName.trim();
  const variant = variantName?.trim() || "";
  if (product && variant && variant.toLowerCase() !== product.toLowerCase()) {
    return `${product} — ${variant}`;
  }
  return product || variant;
}

function photometryIdsFromEmitter(
  emitterXml: string,
  equipmentsById: Map<string, string>,
  lightSourcesById: Map<string, string>,
): string[] {
  const ids = allAttrs(emitterXml, "PhotometryReference", "photometryId");
  for (const equipmentId of allAttrs(emitterXml, "EquipmentReference", "equipmentId")) {
    const equipment = equipmentsById.get(equipmentId);
    if (!equipment) continue;
    ids.push(...allAttrs(equipment, "PhotometryReference", "photometryId"));
    const sourceIds = [
      ...allAttrs(equipment, "LightSourceReference", "changeableLightSourceId"),
      ...allAttrs(equipment, "LightSourceReference", "fixedLightSourceId"),
      ...allAttrs(equipment, "LightSourceReference", "multiChannelLightSourceId"),
    ];
    for (const sourceId of sourceIds) {
      const source = lightSourcesById.get(sourceId);
      if (!source) continue;
      ids.push(...allAttrs(source, "PhotometryReference", "photometryId"));
    }
  }
  for (const sourceId of [
    ...allAttrs(emitterXml, "LightSourceReference", "fixedLightSourceId"),
    ...allAttrs(emitterXml, "LightSourceReference", "changeableLightSourceId"),
    ...allAttrs(emitterXml, "LightSourceReference", "multiChannelLightSourceId"),
  ]) {
    const source = lightSourcesById.get(sourceId);
    if (source) ids.push(...allAttrs(source, "PhotometryReference", "photometryId"));
  }
  return unique(ids);
}

function photometryFormat(contentType: string, fileName: string): SourceFormat | null {
  const type = contentType.trim().toLowerCase();
  if (type === "ldc/eulumdat" || type === "photometry/ldc" || type === "photometry/eulumdat") {
    return "ldt";
  }
  if (type === "ldc/ies" || type === "photometry/ies") return "ies";
  if (type === "ldc/iesxml" || type === "photometry/iesxml") return null;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ldt") || lower.endsWith(".ldc")) return "ldt";
  if (lower.endsWith(".ies")) return "ies";
  return null;
}

function indexFiles(xml: string): Map<string, { name: string; contentType: string; type: string }> {
  const map = new Map<string, { name: string; contentType: string; type: string }>();
  for (const block of matchBlocks(xml, "File")) {
    const id = block.attrs.id;
    if (!id) continue;
    map.set(id, {
      name: block.inner.trim(),
      contentType: block.attrs.contentType ?? "",
      type: block.attrs.type ?? "",
    });
  }
  return map;
}

function indexPhotometries(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of matchBlocks(xml, "Photometry")) {
    if (block.attrs.id) map.set(block.attrs.id, block.full);
  }
  return map;
}

function indexById(xml: string, tag: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of matchBlocks(xml, tag)) {
    if (block.attrs.id) map.set(block.attrs.id, block.full);
  }
  return map;
}

function indexLightSources(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of ["ChangeableLightSource", "FixedLightSource", "MultiChannelLightSource"]) {
    for (const block of matchBlocks(xml, tag)) {
      if (block.attrs.id) map.set(block.attrs.id, block.full);
    }
  }
  return map;
}

function matchBlocks(
  xml: string,
  tag: string,
): Array<{ attrs: Record<string, string>; inner: string; full: string }> {
  const out: Array<{ attrs: Record<string, string>; inner: string; full: string }> = [];
  const re = new RegExp(`<${tag}\\b([^>]*)\\/>|<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const rawAttrs = m[1] ?? m[2] ?? "";
    const inner = m[3] ?? "";
    out.push({ attrs: parseAttrs(rawAttrs), inner, full: m[0] });
  }
  return out;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1]!] = m[2] ?? m[3] ?? "";
  }
  return attrs;
}

function attr(xml: string, tag: string, name: string): string | null {
  const blocks = matchBlocks(xml, tag);
  const value = blocks[0]?.attrs[name];
  return value || null;
}

function allAttrs(xml: string, tag: string, name: string): string[] {
  return matchBlocks(xml, tag)
    .map((block) => block.attrs[name])
    .filter((value): value is string => Boolean(value));
}

function innerOfFirst(xml: string, tag: string): string | null {
  return matchBlocks(xml, tag)[0]?.inner ?? null;
}

function firstTagText(xml: string, tag: string): string | null {
  const inner = innerOfFirst(xml, tag);
  return inner != null ? decodeEntities(inner).trim() || null : null;
}

function localeText(xml: string, tag: string): string | null {
  const block = matchBlocks(xml, tag)[0];
  if (!block) return null;
  const locales = matchBlocks(block.inner, "Locale");
  if (locales.length === 0) {
    const text = decodeEntities(block.inner).trim();
    return text || null;
  }
  const preferred = ["en", "en-us", "en-gb", "zh", "zh-hant", "zh-hk", "zh-tw", "zh-cn"];
  for (const lang of preferred) {
    const hit = locales.find((loc) => (loc.attrs.language ?? "").toLowerCase() === lang);
    if (hit) {
      const text = decodeEntities(hit.inner).trim();
      if (text) return text;
    }
  }
  for (const loc of locales) {
    const text = decodeEntities(loc.inner).trim();
    if (text) return text;
  }
  return null;
}

function stripComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  const head = bytes.subarray(0, Math.min(80, bytes.length));
  let nuls = 0;
  for (const b of head) if (b === 0) nuls += 1;
  if (head.length > 8 && nuls >= head.length / 4) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeTextBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase();
}

function isProductXmlPath(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return base === "product.xml";
}

function resolveZipFile(files: Map<string, Uint8Array>, fileName: string): Uint8Array | undefined {
  const want = normalizeZipPath(fileName);
  if (files.has(want)) return files.get(want);
  const base = want.split("/").pop() ?? want;
  const matches = [...files.keys()].filter((key) => (key.split("/").pop() ?? key) === base);
  if (matches.length === 1) return files.get(matches[0]!);
  return undefined;
}

function looksTooLarge(files: Map<string, Uint8Array>, fileName: string): boolean {
  const data = resolveZipFile(files, fileName);
  return Boolean(data && data.byteLength > GLDF_MAX_ENTRY_BYTES);
}

function zipBaseName(fileName: string): string {
  return fileName.replace(/\\/g, "/").split("/").pop() || fileName;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "photometry";
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function newGldfId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}
