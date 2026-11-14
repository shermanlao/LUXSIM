import type { PhotometricData } from "@luxsim/photometry";
import {
  compactLuminaireLibraryEntry,
  type LuxsimLuminaireLibraryEntry,
} from "@luxsim/project-io";

export type ExportSourceFile = { filename: string; text: string };

export type LuminaireLibraryFields = {
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

export type LuminaireExportPayload = {
  photometric: PhotometricData | null;
  source: ExportSourceFile | null;
} & LuminaireLibraryFields;

export type OfficialExportSources = {
  photometry: Record<string, PhotometricData>;
  sourceFiles: Record<string, ExportSourceFile>;
  luminaireLibrary: Record<string, LuxsimLuminaireLibraryEntry>;
  missingSourceIds: string[];
};

/** Library ids plus any instance luminaire not already listed, in first-seen order. */
export function officialExportLuminaireIds(scene: {
  fixtureLibraryIds: string[];
  instances: { luminaireId: string }[];
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of [...scene.fixtureLibraryIds, ...scene.instances.map((i) => i.luminaireId)]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Collect photometry and original IES/LDT text for official .luxsim / DIALux zip export.
 *
 * Already-cached sources are kept, so a later export after only scene fields change
 * does not drop them. If photometry is cached but the source file is not (stale or
 * never-committed React state), the loader is still called instead of silently omitting
 * the file. No placeholder source text is invented.
 */
export async function collectOfficialExportSources(opts: {
  luminaireIds: string[];
  photoCache?: Record<string, PhotometricData>;
  sourceCache?: Record<string, ExportSourceFile>;
  libraryCache?: Record<string, LuminaireLibraryFields>;
  loadLuminaire: (id: string) => Promise<LuminaireExportPayload>;
}): Promise<OfficialExportSources> {
  const sourceFiles: Record<string, ExportSourceFile> = { ...(opts.sourceCache ?? {}) };
  const photometry: Record<string, PhotometricData> = {};
  const luminaireLibrary: Record<string, LuxsimLuminaireLibraryEntry> = {};
  const missingSourceIds: string[] = [];

  for (const id of opts.luminaireIds) {
    if (opts.photoCache?.[id]) photometry[id] = opts.photoCache[id]!;
    const hasPhoto = Boolean(photometry[id]);
    const hasSource = Boolean(sourceFiles[id]?.text);
    const hasLibraryCache = Object.prototype.hasOwnProperty.call(opts.libraryCache ?? {}, id);
    if (hasLibraryCache) {
      const entry = compactLuminaireLibraryEntry(opts.libraryCache![id]);
      if (entry) luminaireLibrary[id] = entry;
    }
    if (hasPhoto && hasSource && hasLibraryCache) continue;

    const loaded = await opts.loadLuminaire(id);
    if (loaded.photometric) photometry[id] = loaded.photometric;
    if (loaded.source?.text) {
      sourceFiles[id] = loaded.source;
    } else if (!sourceFiles[id]?.text) {
      missingSourceIds.push(id);
    }
    if (!hasLibraryCache) {
      const entry = compactLuminaireLibraryEntry(loaded);
      if (entry) luminaireLibrary[id] = entry;
    }
  }

  return { photometry, sourceFiles, luminaireLibrary, missingSourceIds };
}

export function missingExportSourceStatus(
  kind: "luxsim" | "dialux",
  missingIds: string[],
  names?: Record<string, string>
): string {
  const labels = missingIds.map((id) => names?.[id] || id).join(", ");
  if (kind === "dialux") {
    return `Verification zip downloaded, but original IES/LDT files are missing for: ${labels}. The pack is incomplete.`;
  }
  return `.luxsim downloaded, but original IES/LDT files are missing for: ${labels}. The file is incomplete.`;
}
