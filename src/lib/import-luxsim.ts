import { randomUUID } from "crypto";
import {
  collectReferencedLuminaireIds,
  prepareLuxsimImport,
  remapSceneLuminaireIds,
  type PreparedLuxsimImport,
  type ProjectSceneV2,
  type ResultsV2,
} from "@luxsim/project-io";

/** Official golden project used in parity testing — import must never write it. */
export const GOLDEN_PROJECT_ID = "cmwdr69ju0001fja2iowpyp13";

export type ImportLuminaireRow = {
  id: string;
  orgId: string;
  name: string;
  sourceFormat: string;
  fileKey: string;
  originalName: string;
  photometricJson: string;
  watts: number | null;
  lumens: number | null;
  origin?: string;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

export type ImportProjectRow = {
  orgId: string;
  name: string;
  sceneJson: string;
  resultsJson: string | null;
};

export type ImportLuxsimDeps = {
  findLuminaire: (id: string) => Promise<{ id: string; orgId: string } | null>;
  createLuminaire: (row: ImportLuminaireRow) => Promise<{ id: string }>;
  deleteLuminaire?: (id: string) => Promise<void>;
  createProject: (row: ImportProjectRow) => Promise<{ id: string; name: string; orgId: string }>;
  saveTextFile: (category: string, filename: string, content: string) => Promise<string>;
  removeFile?: (fileKey: string) => Promise<void>;
};

export type ImportLuxsimResult = {
  project: { id: string; name: string; orgId: string };
  scene: ProjectSceneV2;
  results: ResultsV2;
  warnings: string[];
  luminaireIdMap: Record<string, string>;
};

/**
 * Official open path: parse a valid `.lux` (or older `.luxsim` / `.luxsim.json`), restore photometry / source
 * files when present, and create a new project in the given workspace.
 * Invalid files throw before any write. Never updates an existing project.
 */
export async function importLuxsimToWorkspace(opts: {
  orgId: string;
  text: string;
  deps: ImportLuxsimDeps;
}): Promise<ImportLuxsimResult> {
  const prepared = prepareLuxsimImport(opts.text);
  return applyPreparedLuxsimImport({ orgId: opts.orgId, prepared, deps: opts.deps });
}

export async function applyPreparedLuxsimImport(opts: {
  orgId: string;
  prepared: PreparedLuxsimImport;
  deps: ImportLuxsimDeps;
}): Promise<ImportLuxsimResult> {
  const { orgId, prepared, deps } = opts;
  const referenced = collectReferencedLuminaireIds(prepared.scene);
  const oldIds = [...new Set([...referenced, ...Object.keys(prepared.photometry)])];

  const idMap: Record<string, string> = {};
  const toCreate: { oldId: string; newId: string }[] = [];

  for (const oldId of oldIds) {
    const existing = await deps.findLuminaire(oldId);
    if (existing?.orgId === orgId) {
      idMap[oldId] = oldId;
      continue;
    }
    const photo = prepared.photometry[oldId];
    if (!photo) {
      idMap[oldId] = oldId;
      continue;
    }
    const newId = existing ? newLuminaireId() : oldId;
    idMap[oldId] = newId;
    toCreate.push({ oldId, newId });
  }

  const writtenKeys: string[] = [];
  const createdLuminaireIds: string[] = [];

  try {
    for (const item of toCreate) {
      const photo = prepared.photometry[item.oldId]!;
      const source = prepared.sourceFiles[item.oldId];
      let fileKey = "";
      let originalName =
        (source?.filename && source.filename.trim()) ||
        photo.catalogNumber ||
        photo.description ||
        "imported";
      if (source?.text) {
        fileKey = await deps.saveTextFile(
          "luminaires",
          sanitizeFilename(source.filename || originalName),
          source.text
        );
        writtenKeys.push(fileKey);
      }
      const library = prepared.luminaireLibrary[item.oldId];
      const row: ImportLuminaireRow = {
        id: item.newId,
        orgId,
        name:
          photo.description?.trim() ||
          photo.catalogNumber?.trim() ||
          originalName,
        sourceFormat: photo.format,
        fileKey,
        originalName,
        photometricJson: JSON.stringify(photo),
        watts: photo.watts,
        lumens: photo.luminousFlux,
      };
      if (library?.origin) row.origin = library.origin;
      if (library && "libraryFamily" in library) row.libraryFamily = library.libraryFamily;
      if (library && "libraryBeamDeg" in library) row.libraryBeamDeg = library.libraryBeamDeg;
      await deps.createLuminaire(row);
      createdLuminaireIds.push(item.newId);
    }

    const scene = remapSceneLuminaireIds(prepared.scene, idMap);
    const resultsJson = hasStoredResults(prepared.results)
      ? JSON.stringify(prepared.results)
      : null;
    const project = await deps.createProject({
      orgId,
      name: prepared.name,
      sceneJson: JSON.stringify(scene),
      resultsJson,
    });
    if (project.id === GOLDEN_PROJECT_ID) {
      throw new Error("Refusing to write the golden project");
    }
    return {
      project,
      scene,
      results: prepared.results,
      warnings: prepared.warnings,
      luminaireIdMap: idMap,
    };
  } catch (error) {
    for (const id of createdLuminaireIds) {
      await deps.deleteLuminaire?.(id).catch(() => undefined);
    }
    for (const key of writtenKeys) {
      await deps.removeFile?.(key).catch(() => undefined);
    }
    throw error;
  }
}

export function hasStoredResults(results: ResultsV2): boolean {
  if (Object.keys(results.byRoomId).length > 0) return true;
  return Boolean(results.wallsByRoomId && Object.keys(results.wallsByRoomId).length > 0);
}

function newLuminaireId(): string {
  return `imp_${randomUUID().replace(/-/g, "")}`;
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "source.txt";
  return base.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "source.txt";
}
