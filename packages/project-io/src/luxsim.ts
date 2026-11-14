import type { PhotometricData } from "../../photometry/src/types";
import { isSceneV1, isSceneV2, normalizeResults, normalizeScene } from "./migrate";
import type { LuxsimProjectFile, ProjectSceneV2, ResultsV2 } from "./types";

export function serializeLuxsim(project: LuxsimProjectFile): string {
  return JSON.stringify(project, null, 2);
}

export function parseLuxsim(text: string): LuxsimProjectFile {
  const data = JSON.parse(stripBom(text)) as LuxsimProjectFile;
  if (data.format !== "luxsim") {
    throw new Error("Not a LUXSIM project file");
  }
  return data;
}

export class LuxsimImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LuxsimImportError";
  }
}

export type PreparedLuxsimImport = {
  name: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  photometry: Record<string, PhotometricData>;
  sourceFiles: Record<string, { filename: string; text: string }>;
  warnings: string[];
};

/**
 * Parse a LUXSIM project text for official open/import.
 * Rejects invalid files before any project is created. Does not invent a new
 * format, and ignores website / report footer fields (they are not stored).
 */
export function prepareLuxsimImport(text: string): PreparedLuxsimImport {
  let raw: unknown;
  try {
    raw = JSON.parse(stripBom(text));
  } catch {
    throw new LuxsimImportError("Not a LUXSIM project file: invalid JSON");
  }
  if (!isPlainObject(raw) || raw.format !== "luxsim") {
    throw new LuxsimImportError("Not a LUXSIM project file");
  }
  if (raw.version !== 1 && raw.version !== 2) {
    throw new LuxsimImportError(
      raw.version === undefined
        ? "Not a valid LUXSIM project file: missing version"
        : `Unsupported LUXSIM project version (${String(raw.version)})`
    );
  }
  if (typeof raw.name !== "string") {
    throw new LuxsimImportError("Not a valid LUXSIM project file: missing name");
  }
  if (!isSceneV2(raw.scene) && !isSceneV1(raw.scene)) {
    throw new LuxsimImportError("Not a valid LUXSIM project file: scene is not a LUXSIM project scene");
  }
  if (raw.results != null && !isPlainObject(raw.results)) {
    throw new LuxsimImportError("Not a valid LUXSIM project file: results must be an object or null");
  }
  if (raw.photometry != null && !isPlainObject(raw.photometry)) {
    throw new LuxsimImportError("Not a valid LUXSIM project file: photometry must be an object");
  }
  if (raw.sourceFiles != null && !isPlainObject(raw.sourceFiles)) {
    throw new LuxsimImportError("Not a valid LUXSIM project file: sourceFiles must be an object");
  }

  const photometry: Record<string, PhotometricData> = {};
  for (const [id, entry] of Object.entries(raw.photometry ?? {})) {
    if (!isPhotometryShape(entry)) {
      throw new LuxsimImportError(
        `Not a valid LUXSIM project file: photometry entry "${id}" is invalid`
      );
    }
    photometry[id] = entry;
  }

  const sourceFiles: Record<string, { filename: string; text: string }> = {};
  const warnings: string[] = [];
  for (const [id, entry] of Object.entries(raw.sourceFiles ?? {})) {
    if (
      !isPlainObject(entry) ||
      typeof entry.filename !== "string" ||
      typeof entry.text !== "string"
    ) {
      throw new LuxsimImportError(
        `Not a valid LUXSIM project file: source file "${id}" is invalid`
      );
    }
    if (!entry.text) {
      warnings.push(
        `Source file for ${entry.filename || id} is missing from the file and was not invented.`
      );
      continue;
    }
    sourceFiles[id] = { filename: entry.filename, text: entry.text };
  }

  const name = raw.name.trim().slice(0, 120) || "Imported project";
  const scene = normalizeScene(raw.scene);
  const results =
    raw.results == null
      ? { version: 2 as const, byRoomId: {} }
      : normalizeResults(raw.results, scene);

  const referencedIds = collectReferencedLuminaireIds(scene);
  for (const id of referencedIds) {
    if (!photometry[id]) {
      warnings.push(
        `Photometry for luminaire ${id} is missing from the file and was not invented.`
      );
    }
  }
  for (const id of new Set([...Object.keys(photometry), ...referencedIds])) {
    if (photometry[id] && !sourceFiles[id]) {
      const already = warnings.some(
        (w) => w.includes(id) && w.startsWith("Source file")
      );
      if (!already) {
        warnings.push(
          `Source file for luminaire ${id} is missing from the file and was not invented.`
        );
      }
    }
  }

  return { name, scene, results, photometry, sourceFiles, warnings };
}

export function collectReferencedLuminaireIds(scene: ProjectSceneV2): string[] {
  const ids = new Set<string>();
  for (const id of scene.fixtureLibraryIds) {
    if (id) ids.add(id);
  }
  for (const instance of scene.instances) {
    if (instance.luminaireId) ids.add(instance.luminaireId);
  }
  for (const rule of scene.fixtureCodeMap ?? []) {
    if (rule.luminaireId) ids.add(rule.luminaireId);
  }
  return [...ids];
}

export function remapSceneLuminaireIds(
  scene: ProjectSceneV2,
  idMap: Record<string, string>
): ProjectSceneV2 {
  const mapId = (id: string) => idMap[id] ?? id;
  return {
    ...scene,
    fixtureLibraryIds: scene.fixtureLibraryIds.map(mapId),
    instances: scene.instances.map((instance) => ({
      ...instance,
      luminaireId: mapId(instance.luminaireId),
    })),
    fixtureCodeMap: (scene.fixtureCodeMap ?? []).map((rule) => ({
      ...rule,
      luminaireId: mapId(rule.luminaireId),
    })),
  };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPhotometryShape(value: unknown): value is PhotometricData {
  if (!isPlainObject(value)) return false;
  if (value.format !== "ies" && value.format !== "ldt") return false;
  return (
    Array.isArray(value.verticalAngles) &&
    Array.isArray(value.horizontalAngles) &&
    Array.isArray(value.intensities)
  );
}
